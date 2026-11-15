// Autonomous paper-only cron engine. No exchange credentials, real orders or user endpoints.
const symbols=['BTC','ETH','SOL'];
export async function runPaperCron(env, now=Date.now()) {
  if(!env?.PAPER_LEDGER || !Number.isSafeInteger(now)) return {ok:false,reason:'unavailable'};
  if(typeof env.PAPER_CRON_KEY!=='string'||env.PAPER_CRON_KEY.length<32)return {ok:false,reason:'disabled'};
  const prices=await fetchPaperPrices();
  const id=env.PAPER_LEDGER.idFromName('wallet:v1:cloud-cron');
  const stub=env.PAPER_LEDGER.get(id);
  return stub.fetch(new Request('https://internal.invalid/internal/cron',{method:'POST',headers:{'x-paper-cron-key':env.PAPER_CRON_KEY||''},body:JSON.stringify({now,prices})}));
}
export async function fetchPaperPrices(fetcher=fetch) {
  const res=await fetcher('https://api.kraken.com/0/public/Ticker?pair=XBTEUR,ETHEUR,SOLEUR',{headers:{accept:'application/json','cache-control':'no-cache'},cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw Error('market unavailable');
  const json=await res.json();if(json.error?.length || !json.result)throw Error('market invalid');
  // Kraken's public Ticker endpoint has no quote timestamp. Never claim a
  // historical response is fresh: reject a stale HTTP response Date when present.
  const responseDate=res.headers?.get?.('date');
  if(!responseDate)throw Error('market response date missing');
  // A cache may refresh its Date while retaining an older origin response.\n  // Respect Age even when Date looks current; malformed cache metadata fails closed.\n  const ageHeader=res.headers?.get?.('age');\n  if(ageHeader!==null && ageHeader!==undefined){\n    if(!/^(0|[1-9][0-9]*)$/.test(ageHeader))throw Error('invalid market cache age');\n    const ageSeconds=Number(ageHeader);\n    if(!Number.isSafeInteger(ageSeconds)||ageSeconds>120)throw Error('stale market cache');\n  }\n  const servedAt=Date.parse(responseDate);
  if(!Number.isFinite(servedAt)||Math.abs(Date.now()-servedAt)>120000)throw Error('stale market response');
  const result={};
  for(const [key,value] of Object.entries(json.result)){
    const symbol=key.includes('XBT')||key.includes('BTC')?'BTC':key.includes('ETH')?'ETH':key.includes('SOL')?'SOL':null;
    if(!symbol)continue;
    if(Object.hasOwn(result,symbol))throw Error('duplicate market symbol');
    const price=Number(value?.c?.[0]);
    if(!Number.isFinite(price)||price<=0||!Number.isSafeInteger(Math.round(price*100)))throw Error('invalid price');
    result[symbol]=Math.round(price*100);
  }
  if(symbols.some(s=>!Number.isSafeInteger(result[s])||result[s]<=0))throw Error('missing price');
  return result;
}
