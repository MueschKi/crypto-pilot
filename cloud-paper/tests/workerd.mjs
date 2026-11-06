// Real workerd/Miniflare integration. No deployment, exchange connection, or live orders.
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {Miniflare} from "miniflare";

const secret = "integration-only-signing-key-0123456789abcdef";
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
   bindings:{PAPER_VERIFY_KEYS_JSON:verifyKeys},
   durableObjects:{PAPER_LEDGER:{className:"PaperLedger",useSQLite:true}},
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
 assert.equal((await call(mf,"/v1/paper/status")).data.sequence,0);
 assert.equal((await call(mf,"/v1/paper/status","GET",bob)).data.sequence,0);
 const fill={id:"first",sequence:1,symbol:"BTC",side:"BUY",quantityUnits:1000000,priceCentsPerUnit:10000,feeCents:50};
 assert.equal((await call(mf,"/v1/paper/fill","POST",alice,fill)).status,200);
 assert.equal((await call(mf,"/v1/paper/fill","POST",alice,fill)).data.duplicate,true);
 assert.equal((await call(mf,"/v1/paper/status","GET",bob)).data.sequence,0);
 assert.equal((await call(mf,"/v1/paper/revoke","POST",alice,{})).status,200);
 assert.equal((await call(mf,"/v1/paper/status","GET",alice)).status,401);
 await mf.dispose();
 mf=runtime(); // full workerd restart with persisted SQLite-backed DO state
 assert.equal((await call(mf,"/v1/paper/status","GET",alice)).status,401);
 assert.equal((await call(mf,"/v1/paper/status","GET",bob)).data.sequence,0);
 const alice2=await signed("alice","alice_token_0002");
 assert.equal((await call(mf,"/v1/paper/status","GET",alice2)).data.sequence,1);
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
