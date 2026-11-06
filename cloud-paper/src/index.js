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
async function identity(request, keys) {
  // Only explicitly configured server-side keys may verify tokens.
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) return null;
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v2") return null;
  const [version, kid, payload, signature] = parts;
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(kid)
      || !/^[a-zA-Z0-9_-]{1,512}$/.test(payload)
      || !/^[a-f0-9]{64}$/.test(signature)) return null;
  if (!Object.prototype.hasOwnProperty.call(keys,kid)) return null;
  const secret = keys[kid];
  if (typeof secret !== "string" || secret.length < 32) return null;
  let claims;
  try {
    const base64 = payload.replace(/-/g,"+").replace(/_/g,"/");
    claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length/4)*4,"=")));
  } catch (_) { return null; }
  const now = Math.floor(Date.now()/1000);
  if (!claims || !/^[a-zA-Z0-9_-]{1,64}$/.test(claims.sub||"")
      || !Number.isSafeInteger(claims.iat) || claims.iat > now+30 || claims.iat < now-3600
      || !Number.isSafeInteger(claims.exp) || claims.exp <= now
      || claims.exp > claims.iat+3600
      || claims.aud !== "cryptopilot-cloud-paper-preview"
      || !/^[a-zA-Z0-9_-]{8,96}$/.test(claims.jti||"")) return null;
  const key = await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const actual = hex(await crypto.subtle.sign("HMAC",key,enc.encode(version+"."+kid+"."+payload)));
  let diff = 0;
  for (let i=0;i<64;i++) diff |= actual.charCodeAt(i)^signature.charCodeAt(i);
  return diff===0 ? {subject:claims.sub,tokenId:claims.jti,issuedAt:claims.iat} : null;
}

export default {
  async fetch(request, env) {
    let signingKeys;
    try { signingKeys=JSON.parse(env.PAPER_VERIFY_KEYS_JSON||"null"); }
    catch (_) { return denied(); }
    const identityClaims = await identity(request, signingKeys);
    if (!identityClaims) return denied();
    if (!env.PAPER_LEDGER || !env.PAPER_SESSIONS) return response({error:"storage unavailable"},503);
    const url = new URL(request.url);
    if (!["/v1/paper/status","/v1/paper/halt","/v1/paper/fill","/v1/paper/revoke"].includes(url.pathname))
      return response({error:"not found"},404);
    const method = url.pathname.endsWith("/status")?"GET":"POST";
    if (request.method !== method) return response({error:"method not allowed"},405);
    if (request.method === "POST") {
      const size = Number(request.headers.get("content-length")||0);
      if (size > LIMIT) return response({error:"payload too large"},413);
    }
    // A verified subject maps to a distinct persistent preview wallet.
    // Central per-subject session epoch is checked before every wallet operation.
    // A failed session store must deny access rather than fall back to the wallet.
    try {
      const sessionId=env.PAPER_SESSIONS.idFromName("session:v1:"+identityClaims.subject);
      const sessionRes=await env.PAPER_SESSIONS.get(sessionId).fetch(new Request("https://internal.invalid/check",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({tokenId:identityClaims.tokenId,issuedAt:identityClaims.issuedAt})
      }));
      if(sessionRes.status===401)return denied();
      if(!sessionRes.ok)return response({error:"session storage unavailable",mode:"PAPER_ONLY",realTrading:false},503);
    } catch (_) {return response({error:"session storage unavailable",mode:"PAPER_ONLY",realTrading:false},503);}
    const id = env.PAPER_LEDGER.idFromName("wallet:v1:"+identityClaims.subject);
    const forwarded = new Request(request);
    forwarded.headers.set("x-internal-paper-token-id",identityClaims.tokenId);
    try { return await env.PAPER_LEDGER.get(id).fetch(forwarded); }
    catch (_) { return response({error:"paper storage unavailable",mode:"PAPER_ONLY",realTrading:false},503); }
  }
};

class PaperRuleViolation extends Error { constructor(message) {super(message);this.name="PaperRuleViolation";} }
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
    if (!tokenId) return denied();
    try { if (await this.state.storage.get("revoked:"+tokenId)) return denied(); }
    catch (_) { return response({error:"paper storage unavailable",mode:"PAPER_ONLY",realTrading:false},503); }
    if (path === "/v1/paper/status" && request.method === "GET") {
      try {
        const state = await this.state.storage.get("state") || INITIAL;
        return response({...state, mode:"PAPER_ONLY", realTrading:false});
      } catch (_) { return response({error:"paper storage unavailable",mode:"PAPER_ONLY",realTrading:false},503); }
    }
    if (request.method !== "POST") return response({error:"method not allowed"},405);
    let raw;
    try {
      raw = await request.text();
      if (raw.length > LIMIT) return response({error:"payload too large"},413);
    } catch (_) { return response({error:"invalid payload"},400); }
    if (path === "/v1/paper/revoke") {
      // Self-revocation persists for this wallet; no API to re-enable a token.
      try { await this.state.storage.put("revoked:"+tokenId,true); }
      catch (_) { return response({error:"paper storage unavailable",mode:"PAPER_ONLY",realTrading:false},503); }
      return response({revoked:true,mode:"PAPER_ONLY",realTrading:false});
    }
    if (path === "/v1/paper/halt") {
      let state;
      try { state = await this.state.storage.transaction(async txn => {
        const prior = await txn.get("state") || INITIAL;
        const next = {...prior,halted:true};
        await txn.put("state",next);
        return next;
      }); } catch (_) { return response({error:"paper storage unavailable",mode:"PAPER_ONLY",realTrading:false},503); }
      return response({...state, mode:"PAPER_ONLY", realTrading:false});
    }
    if (path !== "/v1/paper/fill") return response({error:"not found"},404);
    let fill;
    try { fill=JSON.parse(raw); } catch (_) { return response({error:"invalid json"},400); }
    if (!validFill(fill)) return response({error:"invalid fill"},400);
    try {
      const result = await this.state.storage.transaction(async txn => {
        const state = await txn.get("state") || INITIAL;
        if (state.halted) throw new PaperRuleViolation("paper halted");
        const previous = await txn.get("order:"+fill.id);
        if (previous) {
          if (JSON.stringify(previous.fill) !== JSON.stringify(fill)) throw new PaperRuleViolation("idempotency conflict");
          return {state, duplicate:true};
        }
        if (fill.sequence !== state.sequence+1) throw new PaperRuleViolation("sequence conflict");
        // Integer micro-units; exact cent notional required, no rounding drift.
        const product = fill.quantityUnits*fill.priceCentsPerUnit;
        if (!Number.isSafeInteger(product) || product%1000000!==0) throw new PaperRuleViolation("invalid notional");
        const notional = product/1000000;
        if (fill.feeCents>notional) throw new PaperRuleViolation("invalid fee");
        const positions = {...state.positions};
        const current = positions[fill.symbol] || {quantityUnits:0,costCents:0};
        if (!Number.isSafeInteger(current.quantityUnits) || !Number.isSafeInteger(current.costCents) || current.quantityUnits<0 || current.costCents<0) throw new PaperRuleViolation("invalid stored position");
        if (!Number.isSafeInteger(state.cashCents) || state.cashCents<0 || !Number.isSafeInteger(state.sequence)) throw new PaperRuleViolation("invalid stored state");
        let cashCents = state.cashCents;
        if (fill.side === "BUY") {
          const cost = notional+fill.feeCents;
          if (!Number.isSafeInteger(cost) || !Number.isSafeInteger(current.costCents+cost) || cost>cashCents || current.costCents+cost>15000) throw new PaperRuleViolation("risk limit");
          if (!Number.isSafeInteger(current.quantityUnits+fill.quantityUnits)) throw new PaperRuleViolation("quantity overflow");
          if (!positions[fill.symbol] && Object.keys(positions).length>=3) throw new PaperRuleViolation("position limit");
          const gross = Object.values(positions).reduce((sum,p)=>sum+p.costCents,0);
          if (!Number.isSafeInteger(gross)) throw new PaperRuleViolation("gross overflow");
          if (gross+cost>45000) throw new PaperRuleViolation("gross limit");
          cashCents -= cost;
          positions[fill.symbol]={quantityUnits:current.quantityUnits+fill.quantityUnits,costCents:current.costCents+cost};
        } else {
          if (fill.quantityUnits>current.quantityUnits) throw new PaperRuleViolation("short sale blocked");
          if (!Number.isSafeInteger(cashCents+notional-fill.feeCents)) throw new PaperRuleViolation("cash overflow");
          cashCents += notional-fill.feeCents;
          const remaining=current.quantityUnits-fill.quantityUnits;
          if (!remaining) delete positions[fill.symbol];
          else positions[fill.symbol]={quantityUnits:remaining,costCents:Math.floor(current.costCents*remaining/current.quantityUnits)};
        }
        if (!Number.isSafeInteger(cashCents) || cashCents<0) throw new PaperRuleViolation("invalid balance");
        const next={sequence:fill.sequence,cashCents,positions,halted:false};
        await txn.put("state",next);
        await txn.put("order:"+fill.id,{fill});
        return {state:next,duplicate:false};
      });
      return response({...result,mode:"PAPER_ONLY",realTrading:false});
    } catch (e) {
      if (e && e.name === "PaperRuleViolation") return response({error:e.message,mode:"PAPER_ONLY"},409);
      return response({error:"paper transaction unavailable",mode:"PAPER_ONLY",realTrading:false},503);
    }
  }
}

export class PaperSessions {
  constructor(state) {this.state=state;}
  async fetch(request) {
    // The Durable Object is reachable only through a Worker binding; no public admin route.
    const path=new URL(request.url).pathname;
    if(request.method!=="POST")return response({error:"method not allowed"},405);
    let body;
    try {body=await request.json();}catch(_){return response({error:"invalid request"},400);}
    if(path==="/check"){
      if(!/^[a-zA-Z0-9_-]{8,96}$/.test(body?.tokenId||"")
          || !Number.isSafeInteger(body?.issuedAt))return denied();
      try {
        const cutoff=await this.state.storage.get("revokedBefore")||0;
        const revoked=await this.state.storage.get("revoked:"+body.tokenId);
        return cutoff>=body.issuedAt || revoked ? denied() : response({allowed:true});
      } catch (_){return response({error:"session storage unavailable"},503);}
    }
    // Privileged revocation is intentionally not exposed through the public Worker.
    // The binding is reachable only by a separately authenticated operator service.
    if(path==="/admin/revoke-token"){
      if(!/^[a-zA-Z0-9_-]{8,96}$/.test(body?.tokenId||""))return response({error:"invalid token id"},400);
      try {await this.state.storage.put("revoked:"+body.tokenId,true);}
      catch (_){return response({error:"session storage unavailable"},503);}
      return response({revoked:true,mode:"PAPER_ONLY",realTrading:false});
    }
    if(path==="/admin/revoke-all"){
      const cutoff=body?.revokedBefore;
      if(!Number.isSafeInteger(cutoff)||cutoff<1||cutoff>Math.floor(Date.now()/1000)+30)
        return response({error:"invalid cutoff"},400);
      try {
        await this.state.storage.transaction(async txn=>{
          const previous=await txn.get("revokedBefore")||0;
          await txn.put("revokedBefore",Math.max(previous,cutoff));
        });
      } catch (_){return response({error:"session storage unavailable"},503);}
      return response({revoked:true,mode:"PAPER_ONLY",realTrading:false});
    }
    return response({error:"not found"},404);
  }
}
