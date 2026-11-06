// Node-based integration harness: mocks the Durable Object transaction interface.
// No Cloudflare deployment, network, exchange API or real-money trading.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const {default: worker, PaperLedger} = await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const secret = "test-signing-key-not-for-production-use-123456789";
async function token(sub) {
 const payload = Buffer.from(JSON.stringify({sub,exp:Math.floor(Date.now()/1000)+600,aud:"cryptopilot-cloud-paper-preview",jti:"token_"+sub+"_0001"})).toString("base64url");
 const {createHmac}=await import("node:crypto");
 return "v1."+payload+"."+createHmac("sha256",secret).update("v1."+payload).digest("hex");
}
const alice=await token("alice"), bob=await token("bob");
const stores = new Map();
let store = new Map();
const storage = {
  async get(k) { return structuredClone(store.get(k)); },
  async put(k,v) {store.set(k,structuredClone(v));},
  async transaction(callback) {
    const before = structuredClone([...store.entries()]);
    const txn = {
      get: async k => structuredClone(store.get(k)),
      put: async (k,v) => {store.set(k,structuredClone(v));}
    };
    try {return await callback(txn);}
    catch (e) {store.clear();for (const [k,v] of before)store.set(k,v);throw e;}
  }
};
const env = {PAPER_SIGNING_KEY:secret,PAPER_LEDGER:{
  idFromName: name => name,
  get: id => ({fetch: request => {store=stores.get(id)||new Map();stores.set(id,store);return new PaperLedger({storage},env).fetch(request)}})
}};
function request(path, method="GET", body, token=alice) {
  return new Request("https://paper.invalid"+path,{method,
    headers:{"authorization":"Bearer "+token,...(body?{"content-type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
}
async function call(path,method="GET",body,token=alice) {
  const res = await worker.fetch(request(path,method,body,token),env);
  return {status:res.status,data:await res.json()};
}
assert.equal((await call("/v1/paper/status","GET",undefined,"wrong")).status,401);
assert.equal((await worker.fetch(new Request("https://paper.invalid/v1/paper/status"),env)).status,401);
assert.equal((await call("/v1/paper/status")).data.cashCents,100000);
assert.equal((await call("/v1/paper/status","GET",undefined,bob)).data.cashCents,100000);
const first={id:"buy1",sequence:1,symbol:"BTC",side:"BUY",quantityUnits:1000000,priceCentsPerUnit:10000,feeCents:50};
let result=await call("/v1/paper/fill","POST",first);
assert.equal(result.status,200);
assert.equal(result.data.state.cashCents,89950);
assert.equal(result.data.state.positions.BTC.quantityUnits,1000000);
result=await call("/v1/paper/fill","POST",first);
assert.equal(result.status,200);
assert.equal(result.data.duplicate,true);
assert.equal((await call("/v1/paper/fill","POST",{...first,feeCents:60})).status,409);
assert.equal((await call("/v1/paper/fill","POST",{...first,id:"buy2",sequence:3})).status,409);
// New Durable Object instance reading same persistent storage after restart.
assert.equal((await new PaperLedger({storage},env).fetch(request("/v1/paper/status"))).status,200);
assert.equal((await call("/v1/paper/status")).data.sequence,1);
assert.equal((await call("/v1/paper/status","GET",undefined,bob)).data.sequence,0);
// Rejected overflows and maliciously invalid stored values must not mutate the ledger.
const overflow={id:"overflow",sequence:2,symbol:"BTC",side:"BUY",quantityUnits:Number.MAX_SAFE_INTEGER,priceCentsPerUnit:1,feeCents:0};
assert.equal((await call("/v1/paper/fill","POST",overflow)).status,409);
assert.equal((await call("/v1/paper/status")).data.sequence,1);
const previousState=structuredClone(store.get("state"));
store.set("state",{...previousState,cashCents:-1});
assert.equal((await call("/v1/paper/fill","POST",{...first,id:"corrupt",sequence:2})).status,409);
assert.equal(store.get("state").cashCents,-1);
store.set("state",previousState);

const sell={id:"sell1",sequence:2,symbol:"BTC",side:"SELL",quantityUnits:1000000,priceCentsPerUnit:11000,feeCents:50};
assert.equal((await call("/v1/paper/fill","POST",sell)).status,200);
assert.equal((await call("/v1/paper/status")).data.cashCents,100900);
assert.equal((await call("/v1/paper/halt","POST",{})).data.halted,true);
assert.equal((await call("/v1/paper/fill","POST",{...first,id:"buy3",sequence:3})).status,409);
assert.equal((await call("/v1/paper/status")).data.halted,true);
assert.equal((await call("/v1/paper/status","GET",undefined,bob)).data.halted,false);
assert.equal((await call("/v1/paper/revoke","POST",{})).data.revoked,true);
assert.equal((await call("/v1/paper/status")).status,401);
assert.equal((await call("/v1/paper/fill","POST",{...first,id:"after_revoke",sequence:3})).status,401);
assert.equal((await call("/v1/paper/status","GET",undefined,bob)).status,200);
console.log("cloud paper integration harness: authentication, idempotency, limits, restart, halt OK");
