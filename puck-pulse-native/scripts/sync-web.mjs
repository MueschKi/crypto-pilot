import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
// Use exactly the same source files for the Cloudflare website and both native WebViews.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const target=path.join(root,'puck-pulse-native','www');
const source=path.join(root,'puck-pulse');
const filenames=['index.html','manifest.webmanifest','icon.svg'];
fs.mkdirSync(target,{recursive:true});
for(const filename of filenames){
 const src=path.join(source,filename),dst=path.join(target,filename);
 const content=fs.readFileSync(src);fs.writeFileSync(dst,content);
 if(!fs.readFileSync(dst).equals(content))throw new Error('Copied asset differs: '+filename);
 const checksum=createHash('sha256').update(content).digest('hex').slice(0,16);
 console.log(filename+' '+checksum);
}
console.log('Native WebView assets synced from deployed browser source. No remote server URL.');
