import assert from 'node:assert/strict';
import {runPaperCron} from '../src/cron.mjs';
// Invalid scheduled clocks fail before network I/O or Durable Object access.
for (const badClock of [-1, -300000, 0, Date.now()-300000, NaN, Infinity, 1.5, Date.now()+300000]) {
  const result = await runPaperCron({PAPER_LEDGER:{idFromName(){throw Error('unexpected storage access');}}, PAPER_CRON_KEY:'0123456789abcdef0123456789abcdef'}, badClock);
  assert.deepEqual(result,{ok:false,reason:'unavailable'});
}
// Missing or malformed credentials must stop before fetching public prices.
for (const invalidKey of [undefined, null, '', 'short', ' '.repeat(32), '\t'.repeat(32), 123, {}]) {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('unexpected market request');};
  try {
    const result=await runPaperCron({
      PAPER_LEDGER:{idFromName(){throw Error('unexpected durable object access');},get(){throw Error('unexpected durable object access');}},
      PAPER_CRON_KEY:invalidKey
    },Date.now());
    assert.deepEqual(result,{ok:false,reason:'disabled'});
  } finally {globalThis.fetch=originalFetch;}
}
// Durable Object lookup exceptions must fail closed without fetching market data.
for (const brokenStage of ['idFromName','get']) {
  const originalFetch=globalThis.fetch;
  let marketRequests=0;
  globalThis.fetch=async()=>{marketRequests++;throw Error('unexpected market request');};
  try {
    const result=await runPaperCron({
      PAPER_LEDGER:{
        idFromName(){if(brokenStage==='idFromName')throw Error('binding lookup failed');return 'wallet-id';},
        get(){if(brokenStage==='get')throw Error('binding stub failed');return {fetch(){throw Error('unexpected wallet call');}};}
      },
      PAPER_CRON_KEY:'0123456789abcdef0123456789abcdef'
    },Date.now());
    assert.deepEqual(result,{ok:false,reason:'unavailable'});
    assert.equal(marketRequests,0);
  } finally {globalThis.fetch=originalFetch;}
}

// Broken Durable Object stubs fail before any public market request.
for (const brokenStub of [undefined, null, {}, {fetch:42}]) {
  const originalFetch=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async()=>{requests++;throw Error('unexpected market request');};
  try {
    const result=await runPaperCron({
      PAPER_LEDGER:{idFromName:()=> 'wallet-id',get:()=>brokenStub},
      PAPER_CRON_KEY:'0123456789abcdef0123456789abcdef'
    },Date.now());
    assert.deepEqual(result,{ok:false,reason:'unavailable'});
    assert.equal(requests,0,'invalid persistent wallet binding must not fetch prices');
  } finally {globalThis.fetch=originalFetch;}
}

// A public-market network outage must fail before touching the persistent wallet.
// The scheduled handler will report this rejection; it must never synthesize a quote.
{
  const originalFetch=globalThis.fetch;
  let attempts=0;
  globalThis.fetch=async()=>{attempts++;throw Error('simulated public ticker outage');};
  try {
    const result=runPaperCron({
      PAPER_LEDGER:{idFromName(){return 'wallet-id';},get(){return {fetch(){throw Error('unexpected wallet request');}};}},
      PAPER_CRON_KEY:'0123456789abcdef0123456789abcdef'
    },Date.now());
    await assert.rejects(result,/simulated public ticker outage/);
    assert.equal(attempts,1,'network outage must not trigger unbounded retries');
  } finally {globalThis.fetch=originalFetch;}
}

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
// Cron cadence must follow scheduled five-minute buckets, not exact elapsed time.
// A previous tick 299 seconds earlier in the preceding bucket is due;
// a duplicate within the current bucket is not.
const boundaryNow=now;
const precedingBucket=Math.floor(now/300000)*300000-1000;
await storage.put('cron:last',{now:precedingBucket,prices:p0,lastTradeMs:0});
const boundaryTick=await tick(boundaryNow,p0);
assert.equal(boundaryTick.status,200,await boundaryTick.clone().text());
assert.notEqual((await boundaryTick.json()).reason,'not_due');
assert.equal(data.get('cron:last')?.now,boundaryNow);
const boundaryDuplicate=await tick(boundaryNow,p0);
assert.equal((await boundaryDuplicate.json()).reason,'not_due');
data=new Map();

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

// Regression: an otherwise valid momentum signal with a price too large to
// purchase even one micro-unit must fail visibly, without a phantom BUY.
data=new Map();
const hugePrices={BTC:6000000000,ETH:300000,SOL:15000};
await storage.put('cron:last',{now:now-300000,prices:hugePrices,lastTradeMs:0});
const unfillable=await tick(now,{...hugePrices,BTC:6100000000});
assert.equal(unfillable.status,503,'unfillable BUY must fail, not report success');
assert.match((await unfillable.json()).error,/invalid execution quantity/);
assert.equal(data.get('state'),undefined,'unfillable BUY must not mutate wallet');
assert.equal(data.get('journal:1'),undefined,'unfillable BUY must not write journal');
assert.equal(data.get('cron:last')?.now,now,'failed execution must reserve tick to prevent replay');
assert.equal((await (await tick(now,{...hugePrices,BTC:6100000000})).json()).reason,'not_due');
data=new Map();

// A corrupted persisted checkpoint must fail closed without overwriting it or trading.
for (const bad of [
  {now:now-300000,prices:{...realistic,BTC:-1},lastTradeMs:0},
  {now:now-300000,prices:realistic,lastTradeMs:now+1},
  {now:now-300000,prices:realistic,lastTradeMs:NaN},
  {now:-1,prices:realistic,lastTradeMs:0},
  false,
  null,
  0,
  'invalid',
  []
]) {
  data=new Map();
  await storage.put('cron:last',bad);
  const rejected=await tick(now,{...realistic,BTC:8600000});
  assert.equal(rejected.status,503,'corrupt checkpoint must reject cron');
  assert.deepEqual(data.get('cron:last'),bad,'corrupt checkpoint must not be overwritten');
  assert.equal(data.get('state'),undefined,'corrupt checkpoint must not create fills');
  assert.equal(data.get('journal:1'),undefined);
}

// Null wallet must fail closed on every authenticated read, not just Cron.
data=new Map();
await storage.put('state',null);
for(const endpoint of ['/v1/paper/status','/v1/paper/journal']){
  const res=await ledger.fetch(new Request('https://internal.invalid'+endpoint,{
    method:'GET',headers:{'x-internal-paper-token-id':'test_operator'}
  }));
  assert.equal(res.status,503,endpoint+' must reject a persisted null wallet');
  assert.equal((await res.json()).mode,'PAPER_ONLY');
  assert.equal(data.get('state'),null,'read must not reset corrupt wallet');
}
data=new Map();

// Corrupt null wallets must also block operator controls and direct fills.
data=new Map();
await storage.put('state',null);
for (const path of ['pause','resume','halt']) {
  const rejected=await ledger.fetch(new Request('https://internal.invalid/v1/paper/'+path,{
    method:'POST',headers:{'x-internal-paper-token-id':'test_operator'}
  }));
  assert.equal(rejected.status,503,'null wallet must block '+path);
  assert.equal(data.get('state'),null,'operator control must not reset null wallet');
}
const rejectedFill=await ledger.fetch(new Request('https://internal.invalid/v1/paper/fill',{
  method:'POST',headers:{'x-internal-paper-token-id':'test_operator'},
  body:JSON.stringify({id:'null_wallet_fill',sequence:1,symbol:'BTC',side:'BUY',quantityUnits:1000,priceCentsPerUnit:8500000,feeCents:1})
}));
assert.notEqual(rejectedFill.status,200,'null wallet must block direct fill');
assert.equal(data.get('state'),null);
assert.equal(data.get('journal:1'),undefined);
assert.equal(data.get('order:null_wallet_fill'),undefined);
data=new Map();

// Explicitly persisted null must not be interpreted as a fresh €1,000 wallet.
data=new Map();
await storage.put('state',null);
await storage.put('cron:last',{now:now-300000,prices:realistic,lastTradeMs:0});
const nullWalletTick=await tick(now,{...realistic,BTC:8600000});
assert.equal(nullWalletTick.status,409);
assert.equal(data.get('state'),null);
assert.equal(data.get('cron:last').now,now-300000);
assert.equal(data.get('journal:1'),undefined);
const nullWalletDiagnostics=await ledger.fetch(new Request('https://internal.invalid/internal/cron/status',{
  method:'GET',headers:{'x-internal-paper-token-id':'test_operator'}
}));
assert.equal(nullWalletDiagnostics.status,503);
data=new Map();

// Corrupt persisted wallet state must fail closed before reserving a tick or filling.
for (const corrupt of [
  {sequence:0,cashCents:-1,positions:{},halted:false},
  {sequence:0,cashCents:100000,positions:{BTC:{quantityUnits:-1,costCents:5000}},halted:false},
  {sequence:0,cashCents:100000,positions:{},halted:'false'}
]) {
  data=new Map();
  await storage.put('state',corrupt);
  await storage.put('cron:last',{now:now-300000,prices:realistic,lastTradeMs:0});
  const rejected=await tick(now,{...realistic,BTC:8600000});
  assert.equal(rejected.status,409,'corrupt wallet must reject cron');
  assert.deepEqual(data.get('state'),corrupt,'corrupt wallet must not be overwritten');
  assert.equal(data.get('cron:last')?.now,now-300000,'corrupt wallet must not reserve tick');
  assert.equal(data.get('journal:1'),undefined,'corrupt wallet must not fill');
}

// A malformed persisted pause flag must never silently enable automatic trading.
for (const corruptPause of [null, 'false', 0, {}, []]) {
  data=new Map();
  await storage.put('cron:paused',corruptPause);
  await storage.put('cron:last',{now:now-300000,prices:realistic,lastTradeMs:0});
  const rejected=await tick(now,{...realistic,BTC:8600000});
  assert.equal(rejected.status,503,'corrupt pause state must fail closed');
  assert.equal(data.get('state'),undefined,'corrupt pause state must not trade');
  assert.equal(data.get('cron:last')?.now,now-300000,'corrupt pause state must not reserve tick');
}
data=new Map();

// Checkpoint storage failure must never produce a paper fill.
data=new Map();
await storage.put('cron:last',{now:now-300000,prices:realistic,lastTradeMs:0});
const originalPut=storage.put;
storage.put=async (key,value)=>{
  if(key==='cron:last')throw Error('simulated checkpoint outage');
  return originalPut(key,value);
};
const checkpointFailure=await tick(now,{...realistic,BTC:8600000});
assert.equal(checkpointFailure.status,503);
assert.equal(data.get('state'),undefined,'no fill may precede checkpoint persistence');
assert.equal(data.get('journal:1'),undefined,'no journal may precede checkpoint persistence');
storage.put=originalPut;
// A restarted object must recognize the persisted tick reservation.
const recovered=await tick(now,{...realistic,BTC:8600000});
assert.equal(recovered.status,200);
assert.equal(data.get('state')?.sequence,1);
const afterRestart=new PaperLedger({storage},env);
const duplicate=await afterRestart.fetch(new Request('https://internal.invalid/internal/cron',{method:'POST',headers:{'x-paper-cron-key':env.PAPER_CRON_KEY},body:JSON.stringify({now,prices:{...realistic,BTC:8600000}})}));
assert.equal(duplicate.status,200);
assert.equal(data.get('state')?.sequence,1,'restart must not replay a committed tick');

// Operator pause/resume is persisted and survives new Durable Object instances.
data=new Map();
const operator=async path=>ledger.fetch(new Request('https://internal.invalid/v1/paper/'+path,{method:'POST',headers:{'x-internal-paper-token-id':'test_operator'}}));
assert.equal((await operator('pause')).status,200);
assert.equal(data.get('cron:paused'),true);
await storage.put('cron:last',{now:now-300000,prices:realistic,lastTradeMs:0});
const restarted=new PaperLedger({storage},env);
const paused=await restarted.fetch(new Request('https://internal.invalid/internal/cron',{method:'POST',headers:{'x-paper-cron-key':env.PAPER_CRON_KEY},body:JSON.stringify({now,prices:{...realistic,BTC:8600000}})}));
assert.equal((await paused.json()).reason,'operator_paused');
assert.equal(data.get('state'),undefined,'paused Cron must not trade');
assert.equal((await operator('resume')).status,200);
assert.equal(data.get('cron:paused'),false);
assert.equal((await tick(now,{...realistic,BTC:8600000})).status,200);
assert.equal(data.get('state')?.sequence,1,'resumed Cron should trade');
assert.equal((await operator('halt')).status,200);
assert.equal((await operator('resume')).status,503,'resume cannot override emergency halt');
assert.equal(data.get('state')?.halted,true);
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
// A failed atomic journal write must roll back the wallet and must not replay
// the reserved cron bucket after recovery (fail closed rather than double-fill).
data=new Map();
await storage.put('cron:last',{now:now-300000,prices:realistic,lastTradeMs:0});
const stableTransaction=storage.transaction;
storage.transaction=async fn=>stableTransaction(async txn=>fn({
  get:txn.get,
  put:async (key,value)=>{
    if(key==='journal:1')throw Error('simulated journal outage');
    return txn.put(key,value);
  }
}));
const failedJournal=await tick(now,{...realistic,BTC:8600000});
assert.equal(failedJournal.status,503,'journal outage must reject the tick');
assert.equal(data.get('state'),undefined,'failed transaction must not change wallet');
assert.equal(data.get('journal:1'),undefined,'failed transaction must not leave journal');
assert.equal(data.get('order:cron_'+Math.floor(now/300000)+'_BTC_BUY'),undefined);
assert.equal(data.get('cron:last')?.now,now,'failed trade must retain reserved tick');
storage.transaction=stableTransaction;
const noReplay=await tick(now,{...realistic,BTC:8600000});
assert.equal((await noReplay.json()).reason,'not_due','recovery must not replay failed bucket');
assert.equal(data.get('state'),undefined);
// Wallet-write failure must roll back the journal and order atomically.
data=new Map();
await storage.put('cron:last',{now:now-300000,prices:realistic,lastTradeMs:0});
storage.transaction=async fn=>stableTransaction(async txn=>fn({
  get:txn.get,
  put:async (key,value)=>{
    if(key==='state')throw Error('simulated wallet persistence outage');
    return txn.put(key,value);
  }
}));
const failedWalletWrite=await tick(now,{...realistic,BTC:8600000});
assert.equal(failedWalletWrite.status,503,'wallet write outage must reject the tick');
assert.equal(data.get('state'),undefined,'wallet write failure must not persist wallet');
assert.equal(data.get('journal:1'),undefined,'wallet write failure must roll back journal');
assert.equal(data.get('order:cron_'+Math.floor(now/300000)+'_BTC_BUY'),undefined,'wallet write failure must roll back order');
assert.equal(data.get('cron:last')?.now,now,'failed wallet write must retain reserved tick');
storage.transaction=stableTransaction;
assert.equal((await (await tick(now,{...realistic,BTC:8600000})).json()).reason,'not_due','failed wallet write must not replay bucket');

// Authenticated Cron status must expose real persisted evidence, not a separate user wallet.
data=new Map();
await storage.put('cron:last',{now:now-300000,prices:realistic,lastTradeMs:0});
const observedFill=await tick(now,{...realistic,BTC:8600000});
assert.equal((await observedFill.json()).trade?.persisted,true);
const diagnosticRequest=()=>new Request('https://internal.invalid/internal/cron/status',{
  method:'GET',headers:{'x-internal-paper-token-id':'test_operator'}
});
const diagnostics=await ledger.fetch(diagnosticRequest());
assert.equal(diagnostics.status,200,await diagnostics.clone().text());
const details=await diagnostics.json();
assert.equal(details.mode,'PAPER_ONLY');
assert.equal(details.realTrading,false);
assert.equal(details.persistedTrades,1);
assert.equal(details.lastTickMs,now);
assert.equal(details.lastTrade?.side,'BUY');
assert.equal(details.lastTrade?.id,data.get('journal:1').fill.id);
assert.equal(details.halted,false);
// Verify the same diagnostics after a persisted SELL and a fresh DO instance.
// Use an earlier checkpoint to simulate the next eligible market interval.
await storage.put('cron:last',{now:now-300000,prices:{...realistic,BTC:8700000},lastTradeMs:0});
const observedSell=await tick(now,{...realistic,BTC:8600000});
assert.equal(observedSell.status,200,await observedSell.clone().text());
assert.equal((await observedSell.json()).trade?.persisted,true);
const sellDetails=await (await new PaperLedger({storage},env).fetch(diagnosticRequest())).json();
assert.equal(sellDetails.persistedTrades,2);
assert.equal(sellDetails.lastTrade?.side,'SELL');
assert.equal(sellDetails.lastTrade?.id,data.get('journal:2').fill.id);
assert.equal(sellDetails.realTrading,false);
// Return to a single-trade fixture for the corruption checks below.
data=new Map();
await storage.put('cron:last',{now:now-300000,prices:realistic,lastTradeMs:0});
assert.equal((await (await tick(now,{...realistic,BTC:8600000})).json()).trade?.persisted,true);
// Diagnostics must not claim a verified trade if its persisted order is missing
// or disagrees with the journal. A restart must preserve the verified result.
const restartedDiagnostics=new PaperLedger({storage},env);
assert.equal((await (await restartedDiagnostics.fetch(diagnosticRequest())).json()).persistedTrades,1);
const originalOrder=structuredClone(data.get('order:'+details.lastTrade.id));
data.delete('order:'+details.lastTrade.id);
assert.equal((await ledger.fetch(diagnosticRequest())).status,503);
data.set('order:'+details.lastTrade.id,{fill:{...originalOrder.fill,feeCents:originalOrder.fill.feeCents+1}});
assert.equal((await ledger.fetch(diagnosticRequest())).status,503);
data.set('order:'+details.lastTrade.id,originalOrder);
assert.equal((await ledger.fetch(diagnosticRequest())).status,200);

await storage.put('cron:paused',true);
assert.equal((await (await ledger.fetch(diagnosticRequest())).json()).paused,true);
await storage.put('cron:paused',null);
assert.equal((await ledger.fetch(diagnosticRequest())).status,503);
await storage.put('cron:paused','corrupt');
assert.equal((await ledger.fetch(diagnosticRequest())).status,503);
await storage.put('cron:paused',false);
await storage.put('cron:last',{now:-1,prices:realistic,lastTradeMs:0});
assert.equal((await ledger.fetch(diagnosticRequest())).status,503);

// A null checkpoint is persisted corruption, not an absent first-run record.
data=new Map();
await storage.put('cron:last',null);
const nullCheckpointTick=await tick(now,{...realistic,BTC:8600000});
assert.equal(nullCheckpointTick.status,503);
assert.equal(data.get('state'),undefined);
assert.equal(data.get('journal:1'),undefined);
assert.equal((await ledger.fetch(diagnosticRequest())).status,503);

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
