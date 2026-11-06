import assert from "node:assert/strict";
import {issuePaperToken} from "../src/token-issuer.mjs";
const key="test-key-with-more-than-32-characters-123456789";
const params={subject:"alice",keyId:"key_1",signingKey:key,now:1800000000,ttlSeconds:300};
const a=issuePaperToken(params),b=issuePaperToken(params);
assert.notEqual(a,b,"each token needs a fresh random jti");
assert.equal(a.split(".").length,4);
const claims=JSON.parse(Buffer.from(a.split(".")[2],"base64url").toString("utf8"));
assert.equal(claims.sub,"alice");
assert.equal(claims.exp-claims.iat,300);
assert.equal(claims.aud,"cryptopilot-cloud-paper-preview");
for(const bad of [
 {...params,subject:"../../other"},
 {...params,signingKey:"short"},
 {...params,keyId:"../key"},
 {...params,ttlSeconds:3601},
 {...params,ttlSeconds:0},
 {...params,now:-1}
])assert.throws(()=>issuePaperToken(bad));
console.log("offline token issuer: fresh random jti, bounded claims and validation OK");
