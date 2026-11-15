import assert from 'node:assert/strict';
import {fetchPaperPrices} from '../src/cron.mjs';
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

console.log('Public quote freshness and ambiguity gates passed');
