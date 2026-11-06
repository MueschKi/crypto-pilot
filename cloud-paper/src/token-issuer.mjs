// Server-only issuer primitive. NOT a public HTTP route or browser dependency.
// The caller must authenticate users and supply an immutable trusted subject.
import {createHmac,randomBytes} from "node:crypto";
const AUD="cryptopilot-cloud-paper-preview";
const subjectPattern=/^[a-zA-Z0-9_-]{1,64}$/;
const keyPattern=/^[a-zA-Z0-9_-]{1,32}$/;
export function issuePaperToken({subject,keyId,signingKey,ttlSeconds=600,now=Math.floor(Date.now()/1000)}){
 if(!subjectPattern.test(subject||""))throw Error("invalid trusted subject");
 if(!keyPattern.test(keyId||""))throw Error("invalid key ID");
 if(typeof signingKey!=="string"||signingKey.length<32)throw Error("invalid signing key");
 if(!Number.isSafeInteger(ttlSeconds)||ttlSeconds<1||ttlSeconds>3600)throw Error("invalid TTL");
 if(!Number.isSafeInteger(now)||now<0)throw Error("invalid clock");
 const jti=randomBytes(24).toString("base64url");
 const payload=Buffer.from(JSON.stringify({sub:subject,iat:now,exp:now+ttlSeconds,jti,aud:AUD})).toString("base64url");
 const head="v2."+keyId+"."+payload;
 return head+"."+createHmac("sha256",signingKey).update(head).digest("hex");
}
