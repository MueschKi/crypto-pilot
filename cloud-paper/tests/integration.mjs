// Node-based integration harness: mocks the Durable Object transaction interface.
// No Cloudflare deployment, network, exchange API or real-money trading.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const {default: worker, PaperLedger} = await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const secret = "test-token-not-for-production-use-123456789";
const store = new Map();
const storage = {
  async get(k) { return structuredClone(store.get(k)); },
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
const env = {PAPER_API_TOKEN:secret,PAPER_LEDGER:{
  idFromName: name => name,
  get: id => ({fetch: request => new PaperLedger({storage},env).fetch(request)})
}};
function request(path, method="GET", body, token=secret) {
  return new Request("https://paper.invalid"+path,{method,
    headers:{"authorization":"Bearer "+token,...(body?{"content-type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
}
async function call(path,method="GET",body,token=secret) {
  const res = await worker.fetch(request(path,method,body,token),env);
  return {status:res.status,data:await res.json()};
}
assert.equal((await call("/v1/paper/status","GET",undefined,"wrong")).status,401);
assert.equal((await worker.fetch(new Request("https://paper.invalid/v1/paper/status"),env)).status,401);
assert.equal((await call("/v1/paper/status")).data.cashCents,100000);
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
const sell={id:"sell1",sequence:2,symbol:"BTC",side:"SELL",quantityUnits:1000000,priceCentsPerUnit:11000,feeCents:50};
assert.equal((await call("/v1/paper/fill","POST",sell)).status,200);
assert.equal((await call("/v1/paper/status")).data.cashCents,100900);
assert.equal((await call("/v1/paper/halt","POST",{})).data.halted,true);
assert.equal((await call("/v1/paper/fill","POST",{...first,id:"buy3",sequence:3})).status,409);
assert.equal((await call("/v1/paper/status")).data.halted,true);
console.log("cloud paper integration harness: authentication, idempotency, limits, restart, halt OK");
