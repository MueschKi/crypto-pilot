// Node-based integration harness: mocks the Durable Object transaction interface.
// No Cloudflare deployment, network, exchange API or real-money trading.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const {default: worker, PaperLedger, PaperSessions} = await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const secret = "test-signing-key-not-for-production-use-123456789";
const verifyKeys=JSON.stringify({test_k1:secret});
const adminKey="test-only-administrator-key-0123456789abcdef";
async function token(sub) {
 const payload = Buffer.from(JSON.stringify({sub,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600,aud:"cryptopilot-cloud-paper-preview",jti:"token_"+sub+"_0001"})).toString("base64url");
 const {createHmac}=await import("node:crypto");
 return "v2.test_k1."+payload+"."+createHmac("sha256",secret).update("v2.test_k1."+payload).digest("hex");
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
const sessionStores=new Map();
const env = {PAPER_VERIFY_KEYS_JSON:verifyKeys,PAPER_ADMIN_KEY:adminKey,PAPER_SESSIONS:{
 idFromName: name=>name,
 get: id=>({fetch: request=>{
   const s=sessionStores.get(id)||new Map();sessionStores.set(id,s);
   return new PaperSessions({storage:{
     get:async k=>s.get(k),
     put:async (k,v)=>s.set(k,v)
   }},env).fetch(request);
 }})
},PAPER_LEDGER:{
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
assert.equal((await new PaperLedger({storage},env).fetch(new Request("https://paper.invalid/v1/paper/status",{headers:{"x-internal-paper-token-id":"token_alice_0001"}}))).status,200);
assert.equal((await call("/v1/paper/status")).data.sequence,1);
const journal1=await call("/v1/paper/journal");
assert.equal(journal1.status,200);
assert.equal(journal1.data.entries.length,1);
assert.deepEqual(journal1.data.entries[0].fill,first);
assert.equal(journal1.data.entries[0].sequence,1);
assert.equal(journal1.data.truncated,false);
assert.equal((await call("/v1/paper/journal","GET",undefined,bob)).data.entries.length,0);
assert.equal((await call("/v1/paper/journal","POST",{})).status,405);
assert.equal((await call("/v1/paper/status","GET",undefined,bob)).data.sequence,0);
// Rejected overflows and maliciously invalid stored values must not mutate the ledger.
const overflow={id:"overflow",sequence:2,symbol:"BTC",side:"BUY",quantityUnits:Number.MAX_SAFE_INTEGER,priceCentsPerUnit:1,feeCents:0};
assert.equal((await call("/v1/paper/fill","POST",overflow)).status,409);
assert.equal((await call("/v1/paper/status")).data.sequence,1);
const previousState=structuredClone(store.get("state"));
store.set("state",{...previousState,cashCents:-1});
assert.equal((await call("/v1/paper/status")).status,503);
assert.equal((await call("/v1/paper/journal")).status,503);
assert.equal((await call("/v1/paper/halt","POST",{})).status,503);
assert.equal(store.get("state").cashCents,-1);
assert.equal((await call("/v1/paper/fill","POST",{...first,id:"corrupt",sequence:2})).status,409);
assert.equal(store.get("state").cashCents,-1);
store.set("state",previousState);
store.set("state",{...previousState,positions:{BTC:{quantityUnits:1000000,costCents:20000}}});
assert.equal((await call("/v1/paper/status")).status,503);
assert.equal((await call("/v1/paper/fill","POST",{...first,id:"invalidrisk",sequence:2})).status,409);
store.set("state",previousState);
store.set("state",{...previousState,sequence:0});
assert.equal((await call("/v1/paper/fill","POST",first)).status,409);
store.set("state",previousState);
assert.equal((await call("/v1/paper/status")).status,200);

const sell={id:"sell1",sequence:2,symbol:"BTC",side:"SELL",quantityUnits:1000000,priceCentsPerUnit:11000,feeCents:50};
assert.equal((await call("/v1/paper/fill","POST",sell)).status,200);
assert.equal((await call("/v1/paper/status")).data.cashCents,100900);
const journal2=await call("/v1/paper/journal");
assert.deepEqual(journal2.data.entries.map(e=>e.fill.id),["buy1","sell1"]);
assert.equal((await call("/v1/paper/fill","POST",sell)).data.duplicate,true);
assert.equal((await call("/v1/paper/journal")).data.entries.length,2);
const journalBackup=store.get("journal:2");
store.delete("journal:2");
assert.equal((await call("/v1/paper/journal")).status,503);
store.set("journal:2",journalBackup);
const orderBackup=store.get("order:sell1");
store.delete("order:sell1");
assert.equal((await call("/v1/paper/journal")).status,503);
store.set("order:sell1",{fill:{...sell,feeCents:51}});
assert.equal((await call("/v1/paper/journal")).status,503);
store.set("order:sell1",orderBackup);
assert.equal((await call("/v1/paper/journal")).status,200);
assert.equal((await call("/v1/paper/halt","POST",{})).data.halted,true);
assert.equal((await call("/v1/paper/fill","POST",{...first,id:"buy3",sequence:3})).status,409);
assert.equal((await call("/v1/paper/status")).data.halted,true);
assert.equal((await call("/v1/paper/status","GET",undefined,bob)).data.halted,false);
assert.equal((await call("/v1/paper/revoke","POST",{})).data.revoked,true);
assert.equal((await call("/v1/paper/status")).status,401);
assert.equal((await call("/v1/paper/fill","POST",{...first,id:"after_revoke",sequence:3})).status,401);
assert.equal((await call("/v1/paper/status","GET",undefined,bob)).status,200);
 // Privileged revocation must be denied without the separate administrator secret.
 const sessionDO=new PaperSessions({storage:{
   get:async k=>sessionStores.get("session:v1:alice").get(k),
   put:async(k,v)=>sessionStores.get("session:v1:alice").set(k,v),
   transaction:async callback=>callback({
     get:async k=>sessionStores.get("session:v1:alice").get(k),
     put:async(k,v)=>sessionStores.get("session:v1:alice").set(k,v)
   })
 }},env);
 const adminRequest=(path,body,authorized=false)=>new Request("https://internal.invalid"+path,{
   method:"POST",headers:{"content-type":"application/json",...(authorized?{"x-paper-admin-key":adminKey,"x-paper-admin-actor":"test_operator","x-paper-audit-id":"audit_test_"+path.split("/").pop()+"_001"}:{})},
   body:JSON.stringify(body)
 });
 assert.equal((await sessionDO.fetch(adminRequest("/admin/revoke-all",{revokedBefore:Math.floor(Date.now()/1000)}))).status,401);
 assert.equal((await sessionDO.fetch(adminRequest("/admin/revoke-token",{tokenId:"alice_token_0001"},true))).status,200);
 assert.equal((await sessionDO.fetch(adminRequest("/admin/revoke-all",{revokedBefore:Math.floor(Date.now()/1000)},true))).status,200);
 assert.equal((await sessionDO.fetch(adminRequest("/admin/revoke-all",{revokedBefore:Math.floor(Date.now()/1000)},true))).status,409);
 assert.equal(sessionStores.get("session:v1:alice").get("audit:audit_test_revoke-all_001").action,"revoke-all");
 assert.equal((await sessionDO.fetch(adminRequest("/admin/audit-entry",{auditId:"audit_test_revoke-all_001"}))).status,401);
 const auditResponse=await sessionDO.fetch(adminRequest("/admin/audit-entry",{auditId:"audit_test_revoke-all_001"},true));
 assert.equal(auditResponse.status,200);
 const audit=await auditResponse.json();
 assert.equal(audit.action,"revoke-all");
 assert.equal(audit.actor,"test_operator");
 assert.equal((await sessionDO.fetch(adminRequest("/admin/audit-entry",{auditId:"audit_nonexistent_0001"},true))).status,404);

 // Central session epoch revokes all previously issued Alice tokens, not Bob.
 const session=sessionStores.get("session:v1:alice");
 session.set("revokedBefore",Math.floor(Date.now()/1000));
 const aliceNew=await token("alice");
 assert.equal((await call("/v1/paper/status","GET",undefined,aliceNew)).status,401);
 assert.equal((await call("/v1/paper/status","GET",undefined,bob)).status,200);

// Simulate a Durable Object storage outage: fail closed, never claim a rule conflict.
const unavailable={get:async()=>{throw Error("disk unavailable")},put:async()=>{throw Error("disk unavailable")},transaction:async()=>{throw Error("disk unavailable")}};
const down=new PaperLedger({storage:unavailable},env);
const internal=(path,method="GET",body)=>new Request("https://paper.invalid"+path,{
 method,headers:{"x-internal-paper-token-id":"outage_test_token",...(body?{"content-type":"application/json"}:{})},
 ...(body?{body:JSON.stringify(body)}:{})
});
assert.equal((await down.fetch(internal("/v1/paper/status"))).status,503);
assert.equal((await down.fetch(internal("/v1/paper/journal"))).status,503);
assert.equal((await down.fetch(internal("/v1/paper/fill","POST",{...first,id:"outage",sequence:1}))).status,503);
assert.equal((await down.fetch(internal("/v1/paper/halt","POST",{}))).status,503);
assert.equal((await down.fetch(internal("/v1/paper/revoke","POST",{}))).status,503);
console.log("cloud paper integration harness: authentication, idempotency, limits, restart, halt OK");
