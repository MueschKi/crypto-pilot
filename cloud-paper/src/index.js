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
      || !Number.isSafeInteger(claims.exp) || claims.exp <= claims.iat || claims.exp <= now
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
  async scheduled(event,env,ctx) {
    // Cron remains inactive unless an operator explicitly configures a secret.
    if(typeof env.PAPER_CRON_KEY!=='string'||env.PAPER_CRON_KEY.length<32)return;
    ctx.waitUntil(import('./cron.mjs').then(({runPaperCron})=>runPaperCron(env,Date.now())));
  },
  async fetch(request, env) {
    let signingKeys;
    try { signingKeys=JSON.parse(env.PAPER_VERIFY_KEYS_JSON||"null"); }
    catch (_) { return denied(); }
    const identityClaims = await identity(request, signingKeys);
    if (!identityClaims) return denied();
    if (!env.PAPER_LEDGER || !env.PAPER_SESSIONS) return response({error:"storage unavailable"},503);
    const url = new URL(request.url);
    if (!["/v1/paper/status","/v1/paper/journal","/v1/paper/halt","/v1/paper/fill","/v1/paper/revoke"].includes(url.pathname))
      return response({error:"not found"},404);
    const method = ["/v1/paper/status","/v1/paper/journal"].includes(url.pathname)?"GET":"POST";
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
// A corrupted persisted wallet must never be presented as a trustworthy balance.
function validState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)
      || !Number.isSafeInteger(state.sequence) || state.sequence < 0
      || !Number.isSafeInteger(state.cashCents) || state.cashCents < 0
      || typeof state.halted !== "boolean"
      || !state.positions || typeof state.positions !== "object" || Array.isArray(state.positions)) return false;
  const entries = Object.entries(state.positions);
  if (entries.length > 3) return false;
  let gross = 0;
  for (const [symbol,position] of entries) {
    if (!allowed.has(symbol) || !position
        || !Number.isSafeInteger(position.quantityUnits) || position.quantityUnits <= 0
        || !Number.isSafeInteger(position.costCents) || position.costCents <= 0
        || position.costCents > 15000) return false;
    gross += position.costCents;
  }
  return Number.isSafeInteger(gross) && gross <= 45000;
}
export class PaperLedger {
  constructor(state, env) { this.state=state; this.env=env; }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    // This endpoint exists only on the Durable Object binding, never the Worker router.
    if(path==='/internal/cron' && request.method==='POST') {
      const key=this.env?.PAPER_CRON_KEY;
      if(typeof key!=='string'||key.length<32||request.headers.get('x-paper-cron-key')!==key)return denied();
      if(this.env.PAPER_AUTOTRADE_ENABLED!=='true')return response({enabled:false,mode:'PAPER_ONLY'});
      try {
        const {now,prices}=await request.json();
        if(!Number.isSafeInteger(now)||Math.abs(Date.now()-now)>120000)return response({error:'invalid clock'},400);
        if(!prices||['BTC','ETH','SOL'].some(k=>!Number.isSafeInteger(prices[k])||prices[k]<=0))return response({error:'invalid prices'},400);
        const storage=this.state.storage;
        const wallet=await storage.get('state')||INITIAL;
        if(!validState(wallet)||wallet.halted)return response({error:'halted or corrupt wallet'},409);
        const last=await storage.get('cron:last');
        if(last && (!Number.isSafeInteger(last.now)||last.now>now))return response({error:'invalid checkpoint'},503);
        if(last && now-last.now<300000)return response({reason:'not_due',mode:'PAPER_ONLY'});
        const {decidePaperTrade}=await import('./strategy.mjs');
        const signal=decidePaperTrade({prices,previousPrices:last?.prices,wallet,enabled:true,halted:wallet.halted,nowMs:now,lastTradeMs:last?.lastTradeMs||0});
        let trade=null;
        if(signal.action!=='WAIT'){
          const price=prices[signal.symbol];
          // Integer cents / micro-units: quantize to an exactly representable cent amount.
          const gcd=(a,b)=>b?gcd(b,a%b):a;
          const divisor=gcd(price,1000000),stepUnits=1000000/divisor,stepCents=price/divisor;
          const units=signal.action==='BUY'?Math.floor(signal.notionalCents/stepCents)*stepUnits:Math.floor(signal.quantityUnits/stepUnits)*stepUnits;
          if(Number.isSafeInteger(units)&&units>0){
            const notional=units*price/1000000;
            if(Number.isSafeInteger(notional)&&notional>0){
              const fee=Math.max(1,Math.ceil(notional*0.0026));
              const fill={id:'cron_'+Math.floor(now/300000)+'_'+signal.symbol+'_'+signal.action,sequence:wallet.sequence+1,symbol:signal.symbol,side:signal.action,quantityUnits:units,priceCentsPerUnit:price,feeCents:fee};
              const filled=await this.fetch(new Request('https://internal.invalid/v1/paper/fill',{method:'POST',headers:{'x-internal-paper-token-id':'cloud_cron_internal'},body:JSON.stringify(fill)}));
              if(!filled.ok)return response({error:'fill rejected',status:filled.status},503);
              trade={id:fill.id,side:fill.side,symbol:fill.symbol};
            }
          }
        }
        await storage.put('cron:last',{now,prices,lastTradeMs:trade?now:(last?.lastTradeMs||0)});
        return response({mode:'PAPER_ONLY',signal:signal.action,reason:signal.reason,trade});
      } catch(_){return response({error:'cron storage or market processing unavailable'},503);}
    }
    // Per-wallet token revocation list; a revoked token cannot read or mutate.
    const tokenId = request.headers.get("x-internal-paper-token-id");
    if (!tokenId) return denied();
    try { if (await this.state.storage.get("revoked:"+tokenId)) return denied(); }
    catch (_) { return response({error:"paper storage unavailable",mode:"PAPER_ONLY",realTrading:false},503); }
    if (path === "/v1/paper/status" && request.method === "GET") {
      try {
        const state = await this.state.storage.get("state") || INITIAL;
        if (!validState(state)) return response({error:"invalid paper state",mode:"PAPER_ONLY",realTrading:false},503);
        return response({...state, mode:"PAPER_ONLY", realTrading:false});
      } catch (_) { return response({error:"paper storage unavailable",mode:"PAPER_ONLY",realTrading:false},503); }
    }
    if (path === "/v1/paper/journal" && request.method === "GET") {
      // Bounded, chronological, server-persisted history; missing entries fail closed.
      try {
        const current = await this.state.storage.get("state") || INITIAL;
        if (!validState(current))
          return response({error:"invalid journal state",mode:"PAPER_ONLY",realTrading:false},503);
        const start = Math.max(1,current.sequence-49);
        const entries=[];
        for (let seq=start;seq<=current.sequence;seq++) {
          const entry=await this.state.storage.get("journal:"+seq);
          if (!entry || entry.sequence!==seq || !validFill(entry.fill))
            return response({error:"journal integrity failure",mode:"PAPER_ONLY",realTrading:false},503);
          const order=await this.state.storage.get("order:"+entry.fill.id);
          if (!order || JSON.stringify(order.fill)!==JSON.stringify(entry.fill))
            return response({error:"journal integrity failure",mode:"PAPER_ONLY",realTrading:false},503);
          entries.push(entry);
        }
        return response({entries,fromSequence:entries.length?start:0,toSequence:current.sequence,
          truncated:start>1,mode:"PAPER_ONLY",realTrading:false});
      } catch (_) {return response({error:"paper storage unavailable",mode:"PAPER_ONLY",realTrading:false},503);}
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
        if (!validState(prior)) throw new PaperRuleViolation("invalid stored state");
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
        if (!validState(state)) throw new PaperRuleViolation("invalid stored state");
        if (state.halted) throw new PaperRuleViolation("paper halted");
        const previous = await txn.get("order:"+fill.id);
        if (previous) {
          if (JSON.stringify(previous.fill) !== JSON.stringify(fill)) throw new PaperRuleViolation("idempotency conflict");
          if (fill.sequence > state.sequence) throw new PaperRuleViolation("invalid stored order sequence");
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
        await txn.put("journal:"+fill.sequence,{sequence:fill.sequence,fill,recordedAt:new Date().toISOString()});
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
  constructor(state,env) {this.state=state;this.env=env;}
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
    if(path.startsWith("/admin/")) {
      const key=this.env?.PAPER_ADMIN_KEY;
      if(typeof key!=="string" || key.length<32 || request.headers.get("x-paper-admin-key")!==key)return denied();
    }
    const actor=request.headers.get("x-paper-admin-actor");
    const auditId=request.headers.get("x-paper-audit-id");
    if(path.startsWith("/admin/") && (!/^[a-zA-Z0-9_-]{3,64}$/.test(actor||"")
        || !/^[a-zA-Z0-9_-]{12,96}$/.test(auditId||"")))
      return response({error:"missing audit identity"},400);
    if(path==="/admin/audit-entry"){
      const lookupId=body?.auditId;
      if(!/^[a-zA-Z0-9_-]{12,96}$/.test(lookupId||""))
        return response({error:"invalid audit id"},400);
      try {
        const entry=await this.state.storage.get("audit:"+lookupId);
        if(!entry)return response({error:"audit entry not found"},404);
        return response({auditId:lookupId,...entry,mode:"PAPER_ONLY",realTrading:false});
      } catch (_) {return response({error:"session storage unavailable"},503);}
    }
    if(path==="/admin/revoke-token"){
      if(!/^[a-zA-Z0-9_-]{8,96}$/.test(body?.tokenId||""))return response({error:"invalid token id"},400);
      try {
        await this.state.storage.transaction(async txn=>{
          if(await txn.get("audit:"+auditId))throw new PaperRuleViolation("duplicate audit id");
          await txn.put("revoked:"+body.tokenId,true);
          await txn.put("audit:"+auditId,{action:"revoke-token",actor,tokenId:body.tokenId,at:Date.now()});
        });
      } catch (e){
        if(e?.name==="PaperRuleViolation")return response({error:"duplicate audit id"},409);
        return response({error:"session storage unavailable"},503);
      }
      return response({revoked:true,mode:"PAPER_ONLY",realTrading:false});
    }
    if(path==="/admin/revoke-all"){
      const cutoff=body?.revokedBefore;
      if(!Number.isSafeInteger(cutoff)||cutoff<1||cutoff>Math.floor(Date.now()/1000)+30)
        return response({error:"invalid cutoff"},400);
      try {
        await this.state.storage.transaction(async txn=>{
          if(await txn.get("audit:"+auditId))throw new PaperRuleViolation("duplicate audit id");
          const previous=await txn.get("revokedBefore")||0;
          await txn.put("revokedBefore",Math.max(previous,cutoff));
          await txn.put("audit:"+auditId,{action:"revoke-all",actor,cutoff,at:Date.now()});
        });
      } catch (e){
        if(e?.name==="PaperRuleViolation")return response({error:"duplicate audit id"},409);
        return response({error:"session storage unavailable"},503);
      }
      return response({revoked:true,mode:"PAPER_ONLY",realTrading:false});
    }
    return response({error:"not found"},404);
  }
}
