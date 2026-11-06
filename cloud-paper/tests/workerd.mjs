// Real workerd/Miniflare integration. No deployment, exchange connection, or live orders.
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {Miniflare} from "miniflare";

const secret = "integration-only-signing-key-0123456789abcdef";
const adminKey="integration-admin-key-0123456789abcdef";
const verifyKeys=JSON.stringify({test_k1:secret});
const path = resolve("cloud-paper/src/index.js");
const dir = await mkdtemp(join(tmpdir(),"cryptopilot-workerd-"));
async function signed(sub, jti) {
 const payload=Buffer.from(JSON.stringify({sub,jti,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600,aud:"cryptopilot-cloud-paper-preview"})).toString("base64url");
 return "v2.test_k1."+payload+"."+createHmac("sha256",secret).update("v2.test_k1."+payload).digest("hex");
}
const alice=await signed("alice","alice_token_0001");
const bob=await signed("bob","bob_token_0001");
function runtime() {
 return new Miniflare({
   modules:true,scriptPath:path,
   compatibilityDate:"2026-10-01",
   bindings:{PAPER_VERIFY_KEYS_JSON:verifyKeys,PAPER_ADMIN_KEY:adminKey},
   durableObjects:{PAPER_LEDGER:{className:"PaperLedger",useSQLite:true},PAPER_SESSIONS:{className:"PaperSessions",useSQLite:true}},
   durableObjectsPersist:join(dir,"durable"),
 });
}
async function call(mf,route,method="GET",token=alice,body) {
 const res=await mf.dispatchFetch("https://preview.invalid"+route,{
  method,headers:{"authorization":"Bearer "+token,...(body?{"content-type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const data=await res.json();
 return {status:res.status,data};
}
let mf;
try {
 mf=runtime();
 assert.equal((await call(mf,"/v1/paper/status","GET","bad")).status,401);
 const expired=Buffer.from(JSON.stringify({sub:"alice",jti:"expired_token_0001",iat:Math.floor(Date.now()/1000)-1200,exp:Math.floor(Date.now()/1000)-600,aud:"cryptopilot-cloud-paper-preview"})).toString("base64url");
 const expiredHead="v2.test_k1."+expired;
 const expiredToken=expiredHead+"."+createHmac("sha256",secret).update(expiredHead).digest("hex");
 assert.equal((await call(mf,"/v1/paper/status","GET",expiredToken)).status,401);
 const unknownKey=alice.replace("v2.test_k1.","v2.unknown_kid.");
 assert.equal((await call(mf,"/v1/paper/status","GET",unknownKey)).status,401);
 assert.equal((await call(mf,"/v1/paper/status")).data.sequence,0);
 assert.equal((await call(mf,"/v1/paper/status","GET",bob)).data.sequence,0);
 // Real workerd session DO: unauthorized admin requests must not change state.
 const sessionNs=await mf.getDurableObjectNamespace("PAPER_SESSIONS");
 const sessionStub=sessionNs.get(sessionNs.idFromName("session:v1:bob"));
 const adminReq=(authorized)=>new Request("https://internal.invalid/admin/revoke-token",{
  method:"POST",headers:{"content-type":"application/json",...(authorized?{
   "x-paper-admin-key":adminKey,"x-paper-admin-actor":"operator_test",
   "x-paper-audit-id":"workerd_audit_0001"
  }:{})},body:JSON.stringify({tokenId:"bob_token_0001"})
 });
 assert.equal((await sessionStub.fetch(adminReq(false))).status,401);
 assert.equal((await call(mf,"/v1/paper/status","GET",bob)).status,200);
 assert.equal((await sessionStub.fetch(adminReq(true))).status,200);
 assert.equal((await sessionStub.fetch(adminReq(true))).status,409);
 assert.equal((await call(mf,"/v1/paper/status","GET",bob)).status,401);

 const fill={id:"first",sequence:1,symbol:"BTC",side:"BUY",quantityUnits:1000000,priceCentsPerUnit:10000,feeCents:50};
 assert.equal((await call(mf,"/v1/paper/fill","POST",alice,fill)).status,200);
 const impossible={...fill,id:"too_expensive",sequence:2,priceCentsPerUnit:999999999};
 assert.equal((await call(mf,"/v1/paper/fill","POST",alice,impossible)).status,409);
 assert.equal((await call(mf,"/v1/paper/status")).data.sequence,1);
 // Two conflicting transactions with the same sequence: exactly one may commit.
 const raceA={...fill,id:"race_a",sequence:2,symbol:"ETH"};
 const raceB={...fill,id:"race_b",sequence:2,symbol:"SOL"};
 const race=await Promise.all([call(mf,"/v1/paper/fill","POST",alice,raceA),call(mf,"/v1/paper/fill","POST",alice,raceB)]);
 assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 assert.equal((await call(mf,"/v1/paper/status")).data.sequence,2);

 assert.equal((await call(mf,"/v1/paper/fill","POST",alice,fill)).data.duplicate,true);
 assert.equal((await call(mf,"/v1/paper/status","GET",bob)).data.sequence,0);
 assert.equal((await call(mf,"/v1/paper/revoke","POST",alice,{})).status,200);
 assert.equal((await call(mf,"/v1/paper/status","GET",alice)).status,401);
 await mf.dispose();
 mf=runtime(); // full workerd restart with persisted SQLite-backed DO state
 assert.equal((await call(mf,"/v1/paper/status","GET",alice)).status,401);
 assert.equal((await call(mf,"/v1/paper/status","GET",bob)).status,401);
 const alice2=await signed("alice","alice_token_0002");
 assert.equal((await call(mf,"/v1/paper/status","GET",alice2)).data.sequence,2);
 assert.equal((await call(mf,"/v1/paper/halt","POST",alice2,{})).data.halted,true);
 await mf.dispose();
 mf=runtime();
 const alice3=await signed("alice","alice_token_0003");
 assert.equal((await call(mf,"/v1/paper/status","GET",alice3)).data.halted,true);
 assert.equal((await call(mf,"/v1/paper/fill","POST",alice3,{...fill,id:"second",sequence:2})).status,409);
 console.log("real workerd SQLite DO: isolated tenants, replay, revocation, persisted restart and halt OK");
} finally {
 if(mf)await mf.dispose();
 await rm(dir,{recursive:true,force:true});
}
