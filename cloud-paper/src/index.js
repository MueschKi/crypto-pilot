// Cloud-Paper preview only. No exchange credentials, order execution, or public deployment.
// Production requires user-scoped authentication, operational review, and integration tests.
const JSON_HEADERS = {"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const response = (data, status=200) => new Response(JSON.stringify(data), {status, headers:JSON_HEADERS});
const denied = () => response({error:"unauthorized"},401);
const LIMIT = 16 * 1024;

async function authorized(request, secret) {
  if (!secret || typeof secret !== "string" || secret.length < 32) return false;
  const token = request.headers.get("authorization");
  if (!token || !token.startsWith("Bearer ")) return false;
  const encoder = new TextEncoder();
  const a = await crypto.subtle.digest("SHA-256", encoder.encode(token.slice(7)));
  const b = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let difference = 0;
  for (let i=0;i<x.length;i++) difference |= x[i]^y[i];
  return difference === 0;
}

export default {
  async fetch(request, env) {
    if (!await authorized(request, env.PAPER_API_TOKEN)) return denied();
    if (!env.PAPER_LEDGER) return response({error:"storage unavailable"},503);
    const url = new URL(request.url);
    if (!["/v1/paper/status","/v1/paper/halt","/v1/paper/fill"].includes(url.pathname))
      return response({error:"not found"},404);
    const method = url.pathname.endsWith("/status")?"GET":"POST";
    if (request.method !== method) return response({error:"method not allowed"},405);
    if (request.method === "POST") {
      const size = Number(request.headers.get("content-length")||0);
      if (size > LIMIT) return response({error:"payload too large"},413);
    }
    // Single fixed preview wallet. Not a multi-user implementation.
    const id = env.PAPER_LEDGER.idFromName("single-preview-wallet");
    return env.PAPER_LEDGER.get(id).fetch(request);
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
        let cashCents = state.cashCents;
        if (fill.side === "BUY") {
          const cost = notional+fill.feeCents;
          if (cost>cashCents || current.costCents+cost>15000) throw new Error("risk limit");
          if (!positions[fill.symbol] && Object.keys(positions).length>=3) throw new Error("position limit");
          const gross = Object.values(positions).reduce((sum,p)=>sum+p.costCents,0);
          if (gross+cost>45000) throw new Error("gross limit");
          cashCents -= cost;
          positions[fill.symbol]={quantityUnits:current.quantityUnits+fill.quantityUnits,costCents:current.costCents+cost};
        } else {
          if (fill.quantityUnits>current.quantityUnits) throw new Error("short sale blocked");
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
