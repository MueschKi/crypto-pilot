import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const strategy=await readFile(new URL('../src/strategy.mjs',import.meta.url),'utf8');
let source=await readFile(new URL('../src/index.js',import.meta.url),'utf8');
source=source.replace("import('./strategy.mjs')",'import('+JSON.stringify('data:text/javascript;base64,'+Buffer.from(strategy).toString('base64'))+')');
const {PaperLedger}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let data=new Map();
const storage={get:async k=>structuredClone(data.get(k)),put:async(k,v)=>{data.set(k,structuredClone(v));},transaction:async fn=>{const old=structuredClone([...data]);try{return await fn({get:storage.get,put:storage.put});}catch(e){data=new Map(old);throw e;}}};
const env={PAPER_CRON_KEY:'test-cron-secret-0123456789abcdef0123456789',PAPER_AUTOTRADE_ENABLED:'true'};
const ledger=new PaperLedger({storage},env);
const now=Date.now();
const tick=(t,prices,key=env.PAPER_CRON_KEY)=>ledger.fetch(new Request('https://internal.invalid/internal/cron',{method:'POST',headers:{'x-paper-cron-key':key},body:JSON.stringify({now:t,prices})}));
const p0={BTC:100000,ETH:10000,SOL:1000};
assert.equal((await tick(now,p0,'wrong')).status,401);
assert.equal((await tick(now,p0)).status,200);
assert.equal(data.get('state'),undefined);
assert.equal((await tick(now,p0)).status,200);
assert.equal((await tick(now+300000,{...p0,BTC:101000})).status,400); // future clock rejected
// Simulate elapsed ticks by supplying current-time checkpoint in storage.
await storage.put('cron:last',{now:now-300000,prices:p0,lastTradeMs:0});
const result=await tick(now,{...p0,BTC:101000});
assert.equal(result.status,200,await result.clone().text());
assert.equal((await result.clone().json()).trade?.persisted,true);
assert.equal(data.get('state').sequence,1);
assert.equal(data.get('journal:1').fill.side,'BUY');
assert.equal((await tick(now,{...p0,BTC:101000})).status,200);
assert.equal(data.get('state').sequence,1);
await storage.put('state',{...data.get('state'),halted:true});
assert.equal((await tick(now,{...p0,BTC:102000})).status,409);
env.PAPER_AUTOTRADE_ENABLED='false';
assert.equal((await tick(now,p0)).status,200);
assert.equal(data.get('state').sequence,1);
env.PAPER_AUTOTRADE_ENABLED='true'; // Reset after disabled-mode assertion.
// Regression: realistic BTC prices (e.g. €85,000) must allow a €50
// fractional paper BUY; previously exact-cent quantization yielded zero units.
data=new Map();
const realistic={BTC:8500000,ETH:300000,SOL:15000};
await storage.put('cron:last',{now:now-300000,prices:realistic,lastTradeMs:0});
const realisticBuy=await tick(now,{...realistic,BTC:8600000});
assert.equal(realisticBuy.status,200,await realisticBuy.clone().text());
assert.equal((await realisticBuy.clone().json()).trade?.persisted,true);
assert.equal(data.get('state')?.sequence,1,'fractional BTC BUY must persist');
assert.equal(data.get('journal:1')?.fill.side,'BUY');
assert.ok(data.get('journal:1')?.fill.quantityUnits>0);
assert.equal((await tick(now,{...realistic,BTC:8600000})).status,200);
assert.equal(data.get('state').sequence,1,'duplicate cron must not duplicate BUY');
await storage.put('cron:last',{now:now-300000,prices:{...realistic,BTC:8700000},lastTradeMs:0});
const realisticSell=await tick(now,{...realistic,BTC:8600000});
assert.equal(realisticSell.status,200,await realisticSell.clone().text());
assert.equal((await realisticSell.clone().json()).trade?.persisted,true);
assert.equal(data.get('state')?.sequence,2,'fractional BTC SELL must persist');
assert.equal(data.get('journal:2')?.fill.side,'SELL');
assert.equal(Object.keys(data.get('state').positions).length,0);

// Smoke mode executes real persistent paper fills without artificial price changes.
data=new Map();
env.PAPER_SMOKE_TRADES_ENABLED='true';
await storage.put('cron:last',{now:now-300000,prices:realistic,lastTradeMs:0});
const smokeBuy=await tick(now,realistic);
assert.equal(smokeBuy.status,200,await smokeBuy.clone().text());
assert.equal((await smokeBuy.json()).trade?.persisted,true);
assert.equal(data.get('journal:1')?.fill.side,'BUY');
assert.equal(data.get('state')?.sequence,1);
await storage.put('cron:last',{now:now-300000,prices:realistic,lastTradeMs:0});
const smokeSell=await tick(now,realistic);
assert.equal(smokeSell.status,200,await smokeSell.clone().text());
assert.equal((await smokeSell.json()).trade?.persisted,true);
assert.equal(data.get('journal:2')?.fill.side,'SELL');
assert.equal(data.get('state')?.sequence,2);
env.PAPER_SMOKE_TRADES_ENABLED='false';
console.log('Cloud cron wallet integration passed');

// Scheduled Worker must surface a rejected cron as an observable failure.
const workerSource=await readFile(new URL('../src/index.js',import.meta.url),'utf8');
const cronMock='data:text/javascript;base64,'+Buffer.from('export async function runPaperCron(){return new Response(JSON.stringify({error:"simulated rejection"}),{status:503})}').toString('base64');
const workerModule=await import('data:text/javascript;base64,'+Buffer.from(workerSource.replace("import('./cron.mjs')",'import('+JSON.stringify(cronMock)+')')).toString('base64'));
const messages=[];
const originalError=console.error;
console.error=(...args)=>messages.push(args.join(' '));
try {
  const pending=[];
  await workerModule.default.scheduled({}, {PAPER_CRON_KEY:'0123456789abcdef0123456789abcdef',PAPER_LEDGER:{idFromName:()=> 'test',get:()=>({fetch:async()=>new Response(JSON.stringify({error:'simulated rejection'}),{status:503})})}}, {waitUntil:p=>pending.push(p)});
  assert.equal(pending.length,1);
  await assert.rejects(pending[0]);
  assert.ok(messages.some(m=>m.includes('paper_cron_failure')));
} finally {console.error=originalError;}


// A missing deployment secret must be an observable failure, never a silent success.
{
  const errors=[];
  const original=console.error;
  console.error=(...args)=>errors.push(args.join(' '));
  try {
    const pending=[];
    await assert.rejects(workerModule.default.scheduled({}, {PAPER_LEDGER:{}}, {waitUntil:p=>pending.push(p)}),/credential unavailable/);
    assert.equal(pending.length,0);
    assert.ok(errors.some(line=>line.includes('paper_cron_failure')&&line.includes('credential unavailable')));
  } finally {console.error=original;}
}
