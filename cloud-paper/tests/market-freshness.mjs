import assert from 'node:assert/strict';
import {fetchPaperPrices, runPaperCron} from '../src/cron.mjs';
const values={XXBTZEUR:{c:['85000']},XETHZEUR:{c:['3000']},SOLEUR:{c:['150']}};
const make=(result,date=new Date().toUTCString())=>async()=>({ok:true,headers:{get:k=>k==='date'?date:null},json:async()=>({error:[],result})});
assert.deepEqual(await fetchPaperPrices(make(values)),{BTC:8500000,ETH:300000,SOL:15000});
await assert.rejects(fetchPaperPrices(make(values,new Date(Date.now()-300000).toUTCString())),/stale market response/);
await assert.rejects(fetchPaperPrices(make(values,null)),/market response date missing/);
await assert.rejects(fetchPaperPrices(make(values,'invalid-date')),/stale market response/);
await assert.rejects(fetchPaperPrices(make({...values,XBTZEUR:{c:['86000']}})),/duplicate market symbol/);
await assert.rejects(fetchPaperPrices(make({XXBTZEUR:values.XXBTZEUR})),/missing price/);
// Never reinterpret an unrelated instrument whose name happens to contain BTC.
await assert.rejects(fetchPaperPrices(make({BTCUSDT:values.XXBTZEUR,XETHZEUR:values.XETHZEUR,SOLEUR:values.SOLEUR})),/missing price/);
await assert.rejects(fetchPaperPrices(make({...values,SOLEUR:{c:['NaN']}})),/invalid price/);
const cached=age=>async()=>({ok:true,headers:{get:k=>k==='date'?new Date().toUTCString():k==='age'?age:null},json:async()=>({error:[],result:values})});
await assert.rejects(fetchPaperPrices(cached('121')),/stale market cache/);
const agedResponse=async()=>({ok:true,headers:{get:k=>k==='date'?new Date(Date.now()-90000).toUTCString():k==='age'?'45':null},json:async()=>({error:[],result:values})});
await assert.rejects(fetchPaperPrices(agedResponse),/stale market response/);
await assert.rejects(fetchPaperPrices(cached('-1')),/invalid market cache age/);
await assert.rejects(fetchPaperPrices(cached('garbled')),/invalid market cache age/);
await assert.deepEqual(await fetchPaperPrices(cached('0')),{BTC:8500000,ETH:300000,SOL:15000});

// Reject transport failures, exchange-side errors, and prices that cannot be
// represented safely in integer cents. Never hand an ambiguous quote to Cron.
const failedHttp=async()=>({ok:false,status:503});
await assert.rejects(fetchPaperPrices(failedHttp),/market unavailable/);
const exchangeError=async()=>({ok:true,headers:{get:k=>k==='date'?new Date().toUTCString():null},json:async()=>({error:['EGeneral:Temporary lockout'],result:values})});
await assert.rejects(fetchPaperPrices(exchangeError),/market invalid/);
await assert.rejects(fetchPaperPrices(make({...values,SOLEUR:{c:['0']}})),/invalid price/);
await assert.rejects(fetchPaperPrices(make({...values,SOLEUR:{c:['0.001']}})),/invalid price/); // positive but rounds to zero cents
await assert.rejects(fetchPaperPrices(make({...values,SOLEUR:{c:['Infinity']}})),/invalid price/);
await assert.rejects(fetchPaperPrices(make({...values,SOLEUR:{c:['100000000000000']}})),/invalid price/);
const futureDate=new Date(Date.now()+300000).toUTCString();
await assert.rejects(fetchPaperPrices(make(values,futureDate)),/stale market response/);

// Fail closed on absent transport metadata and ambiguous/unsafe Kraken payloads.
const noHeaders=async()=>({ok:true,json:async()=>({error:[],result:values})});
await assert.rejects(fetchPaperPrices(noHeaders),/market response date missing/);
await assert.rejects(fetchPaperPrices(cached('999999999999999999999999999999')),/invalid market cache age/);
await assert.rejects(fetchPaperPrices(make({...values,SOLEUR:{c:[]}})),/invalid price/);
await assert.rejects(fetchPaperPrices(make({...values,SOLEUR:{c:['-1']}})),/invalid price/);
await assert.rejects(fetchPaperPrices(make({...values,SOLEUR:{c:['1e309']}})),/invalid price/);
const malformedJson=async()=>({ok:true,headers:{get:k=>k==='date'?new Date().toUTCString():null},json:async()=>{throw new SyntaxError('invalid JSON')}});
await assert.rejects(fetchPaperPrices(malformedJson),/invalid JSON/);


// A malformed Kraken error envelope must never be accepted as success.
for(const error of [undefined,null,{},'unexpected',0]) {
  const malformed=async()=>({ok:true,headers:{get:k=>k==='date'?new Date().toUTCString():null},json:async()=>({error,result:values})});
  await assert.rejects(fetchPaperPrices(malformed),/market invalid/);
}
for(const result of [null,[],42,'invalid']) {
  const malformed=async()=>({ok:true,headers:{get:k=>k==='date'?new Date().toUTCString():null},json:async()=>({error:[],result})});
  await assert.rejects(fetchPaperPrices(malformed),/market invalid/);
}

// Reject type coercion and ambiguous numeric encodings from the exchange.
for(const bad of [true,false,null,1,{},'1e2','+150',' 150','0150']) {
  await assert.rejects(fetchPaperPrices(make({...values,SOLEUR:{c:[bad]}})),/invalid price/);
}

// Reject an exchange response that appears fresh but carries malformed HTTP
// cache metadata. No quote may reach the persistent wallet in these cases.
for (const age of ['01', '+1', '1.5', ' 1', '1 ', '1e2', 'Infinity', 'NaN']) {
  await assert.rejects(fetchPaperPrices(cached(age)),/invalid market cache age/);
}
// A cache Age of exactly two minutes is the upper permitted boundary;
// anything beyond it must never be treated as a fresh market observation.
await assert.rejects(fetchPaperPrices(cached('120')),/stale market response|stale market cache/);

console.log('Public quote freshness and ambiguity gates passed');

// Integration boundary: no Durable Object invocation or virtual fill may occur
// if public market transport is unavailable. No private exchange credentials.
{
  const priorFetch=globalThis.fetch;
  let ledgerCalls=0;
  globalThis.fetch=async()=>({ok:false,status:503});
  try {
    const env={
      PAPER_CRON_KEY:'test-cron-secret-0123456789abcdef0123456789',
      PAPER_LEDGER:{
        idFromName:()=>{ledgerCalls++;return 'wallet';},
        get:()=>{ledgerCalls++;return {fetch:async()=>{ledgerCalls++;return new Response('unexpected');}};}
      }
    };
    await assert.rejects(runPaperCron(env,Date.now()),/market unavailable/);
    assert.equal(ledgerCalls,0,'market outage must never reach the paper ledger');
  } finally { globalThis.fetch=priorFetch; }
}

// Missing or undersized Cron credentials must fail before fetching public prices
// or touching persistent storage. A disabled deployment cannot trade.
for (const key of [undefined, '', 'short']) {
  const previousFetch=globalThis.fetch;
  let marketCalls=0;
  let ledgerCalls=0;
  globalThis.fetch=async()=>{marketCalls++;throw Error('market must not be called');};
  try {
    const disabled=await runPaperCron({
      PAPER_CRON_KEY:key,
      PAPER_LEDGER:{idFromName:()=>{ledgerCalls++;return 'wallet';},get:()=>{ledgerCalls++;throw Error('ledger must not be called');}}
    },Date.now());
    assert.deepEqual(disabled,{ok:false,reason:'disabled'});
    assert.equal(marketCalls,0);
    assert.equal(ledgerCalls,0);
  } finally { globalThis.fetch=previousFetch; }
}
// Missing Durable Object binding must also avoid an external market request.
{
  const previousFetch=globalThis.fetch;
  let marketCalls=0;
  globalThis.fetch=async()=>{marketCalls++;throw Error('market must not be called');};
  try {
    assert.deepEqual(await runPaperCron({PAPER_CRON_KEY:'x'.repeat(32)},Date.now()),{ok:false,reason:'unavailable'});
    assert.equal(marketCalls,0);
  } finally {globalThis.fetch=previousFetch;}
}
