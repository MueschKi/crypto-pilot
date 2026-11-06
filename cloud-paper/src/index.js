// Cloud-Paper preview only. No exchange credentials, order execution, or public deployment.
// Production requires user-scoped authentication, operational review, and integration tests.
const JSON_HEADERS = {"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const response = (data, status=200) => new Response(JSON.stringify(data), {status, headers:JSON_HEADERS});
const denied = () => response({error:"unauthorized"},401);
const LIMIT = 16 * 1024;

// Preview identity: short-lived HMAC-SHA256 signed bearer token.
// Production must replace token issuance with a trusted external identity provider.
const enc = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("");
async function identity(request, secret) {
  if (typeof secret !== "string" || secret.length < 32) return null;
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [version, payload, signature] = parts;
  if (!/^[a-zA-Z0-9_-]{1,512}$/.test(payload) || !/^[a-f0-9]{64}$/.test(signature)) return null;
  let claims;
  try {
    const base64 = payload.replace(/-/g,"+").replace(/_/g,"/");
    claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length/4)*4,"=")));
  } catch (_) { return null; }
  if (!claims || !/^[a-zA-Z0-9_-]{1,64}$/.test(claims.sub||"")
      || !Number.isSafeInteger(claims.exp) || claims.exp <= Math.floor(Date.now()/1000)
      || claims.exp > Math.floor(Date.now()/1000)+3600
      || claims.aud !== "cryptopilot-cloud-paper-preview"
      || !/^[a-zA-Z0-9_-]{8,96}$/.test(claims.jti||"")) return null;
  const key = await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const actual = hex(await crypto.subtle.sign("HMAC",key,enc.encode(version+"."+payload)));
  let diff = 0;
  for (let i=0;i<64;i++) diff |= actual.charCodeAt(i)^signature.charCodeAt(i);
  return diff===0 ? {subject:claims.sub,tokenId:claims.jti} : null;
}

export default {
  async fetch(request, env) {
    const identityClaims = await identity(request, env.PAPER_SIGNING_KEY);
    if (!identityClaims) return denied();
    if (!env.PAPER_LEDGER) return response({error:"storage unavailable"},503);
    const url = new URL(request.url);
    if (!["/v1/paper/status","/v1/paper/halt","/v1/paper/fill","/v1/paper/revoke"].includes(url.pathname))
      return response({error:"not found"},404);
    const method = url.pathname.endsWith("/status")?"GET":"POST";
    if (request.method !== method) return response({error:"method not allowed"},405);
    if (request.method === "POST") {
      const size = Number(request.headers.get("content-length")||0);
      if (size > LIMIT) return response({error:"payload too large"},413);
    }
    // Single fixed preview wallet. Not a multi-user implementation.
    const id = env.PAPER_LEDGER.idFromName("wallet:v1:"+identityClaims.subject);
    const forwarded = new Request(request);
    forwarded.headers.set("x-internal-paper-token-id",identityClaims.tokenId);
    return env.PAPER_LEDGER.get(id).fetch(forwarded);
  }
};

const INITIAL = {sequence:0,cashCents:100000,positions:{},halted:false};
const allowed = new Set(["BTC","ETH","SOL","NEAR"]);
function validFill(f) {
  return f && typeof f === "object" && !Array.isArray(f)
    && typeof f.id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(f.id)
    && Number.isSafeInteger(f.sequence) && f.sequence > 0
    && allowed.has(f.symbol) && ["BUY","SELL"].includes(f.side)
    && Number.isSafeInteger(f.quantityUnits) && f.quantityUnits > 0
    && Number.isSafeInteger(f.priceCentsPerUnit) && f.priceCentsPerUnit > 0
    && Number.isSafeInteger(f.feeCents) && f.feeCents >= 0;
}
export class PaperLedger {
  constructor(state, env) { this.state=state; this.env=env; }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    // Per-wallet token revocation list; a revoked token cannot read or mutate.
    const tokenId = request.headers.get("x-internal-paper-token-id");
    if (!tokenId || await this.state.storage.get("revoked:"+tokenId)) return denied();
    if (path === "/v1/paper/status" && request.method === "GET") {
      const state = await this.state.storage.get("state") || INITIAL;
      return response({...state, mode:"PAPER_ONLY", realTrading:false});
    }
    if (request.method !== "POST") return response({error:"method not allowed"},405);
    let raw;
    try {
      raw = await request.text();
      if (raw.length > LIMIT) return response({error:"payload too large"},413);
    } catch (_) { return response({error:"invalid payload"},400); }
    if (path === "/v1/paper/revoke") {
      // Self-revocation persists for this wallet; no API to re-enable a token.
      await this.state.storage.put("revoked:"+tokenId,true);
      return response({revoked:true,mode:"PAPER_ONLY",realTrading:false});
    }
    if (path === "/v1/paper/halt") {
      const state = await this.state.storage.transaction(async txn => {
        const prior = await txn.get("state") || INITIAL;
        const next = {...prior,halted:true};
        await txn.put("state",next);
        return next;
      });
      return response({...state, mode:"PAPER_ONLY", realTrading:false});
    }
    if (path !== "/v1/paper/fill") return response({error:"not found"},404);
    let fill;
    try { fill=JSON.parse(raw); } catch (_) { return response({error:"invalid json"},400); }
    if (!validFill(fill)) return response({error:"invalid fill"},400);
    try {
      const result = await this.state.storage.transaction(async txn => {
        const state = await txn.get("state") || INITIAL;
        if (state.halted) throw new Error("paper halted");
        const previous = await txn.get("order:"+fill.id);
        if (previous) {
          if (JSON.stringify(previous.fill) !== JSON.stringify(fill)) throw new Error("idempotency conflict");
          return {state, duplicate:true};
        }
        if (fill.sequence !== state.sequence+1) throw new Error("sequence conflict");
        // Integer micro-units; exact cent notional required, no rounding drift.
        const product = fill.quantityUnits*fill.priceCentsPerUnit;
        if (!Number.isSafeInteger(product) || product%1000000!==0) throw new Error("invalid notional");
        const notional = product/1000000;
        if (fill.feeCents>notional) throw new Error("invalid fee");
        const positions = {...state.positions};
        const current = positions[fill.symbol] || {quantityUnits:0,costCents:0};
        if (!Number.isSafeInteger(current.quantityUnits) || !Number.isSafeInteger(current.costCents) || current.quantityUnits<0 || current.costCents<0) throw new Error("invalid stored position");
        if (!Number.isSafeInteger(state.cashCents) || state.cashCents<0 || !Number.isSafeInteger(state.sequence)) throw new Error("invalid stored state");
        let cashCents = state.cashCents;
        if (fill.side === "BUY") {
          const cost = notional+fill.feeCents;
          if (!Number.isSafeInteger(cost) || !Number.isSafeInteger(current.costCents+cost) || cost>cashCents || current.costCents+cost>15000) throw new Error("risk limit");
          if (!Number.isSafeInteger(current.quantityUnits+fill.quantityUnits)) throw new Error("quantity overflow");
          if (!positions[fill.symbol] && Object.keys(positions).length>=3) throw new Error("position limit");
          const gross = Object.values(positions).reduce((sum,p)=>sum+p.costCents,0);
          if (!Number.isSafeInteger(gross)) throw new Error("gross overflow");
          if (gross+cost>45000) throw new Error("gross limit");
          cashCents -= cost;
          positions[fill.symbol]={quantityUnits:current.quantityUnits+fill.quantityUnits,costCents:current.costCents+cost};
        } else {
          if (fill.quantityUnits>current.quantityUnits) throw new Error("short sale blocked");
          if (!Number.isSafeInteger(cashCents+notional-fill.feeCents)) throw new Error("cash overflow");
          cashCents += notional-fill.feeCents;
          const remaining=current.quantityUnits-fill.quantityUnits;
          if (!remaining) delete positions[fill.symbol];
          else positions[fill.symbol]={quantityUnits:remaining,costCents:Math.floor(current.costCents*remaining/current.quantityUnits)};
        }
        if (!Number.isSafeInteger(cashCents) || cashCents<0) throw new Error("invalid balance");
        const next={sequence:fill.sequence,cashCents,positions,halted:false};
        await txn.put("state",next);
        await txn.put("order:"+fill.id,{fill});
        return {state:next,duplicate:false};
      });
      return response({...result,mode:"PAPER_ONLY",realTrading:false});
    } catch (e) { return response({error:String(e.message),mode:"PAPER_ONLY"},409); }
  }
}
