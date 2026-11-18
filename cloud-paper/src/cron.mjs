// Autonomous paper-only cron engine. No exchange credentials, real orders or user endpoints.
const symbols=['BTC','ETH','SOL'];
export async function runPaperCron(env, now=Date.now()) {
  if(!env?.PAPER_LEDGER || typeof env.PAPER_LEDGER.idFromName!=='function' || typeof env.PAPER_LEDGER.get!=='function' || !Number.isSafeInteger(now) || now < 0) return {ok:false,reason:'unavailable'};
  if(typeof env.PAPER_CRON_KEY!=='string'||env.PAPER_CRON_KEY.length<32)return {ok:false,reason:'disabled'};
  const prices=await fetchPaperPrices();
  const id=env.PAPER_LEDGER.idFromName('wallet:v1:cloud-cron');
  const stub=env.PAPER_LEDGER.get(id);
  return stub.fetch(new Request('https://internal.invalid/internal/cron',{method:'POST',headers:{'x-paper-cron-key':env.PAPER_CRON_KEY||''},body:JSON.stringify({now,prices})}));
}
export async function fetchPaperPrices(fetcher=fetch) {
  const res=await fetcher('https://api.kraken.com/0/public/Ticker?pair=XBTEUR,ETHEUR,SOLEUR',{headers:{accept:'application/json','cache-control':'no-cache'},cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw Error('market unavailable');
  const json=await res.json();
  // Kraken's envelope must be well formed; malformed error fields must not
  // accidentally be interpreted as a successful response.
  if(!json || typeof json!=='object' || Array.isArray(json)
    || !Array.isArray(json.error) || json.error.length!==0
    || !json.result || typeof json.result!=='object' || Array.isArray(json.result))
    throw Error('market invalid');
  // Kraken's public Ticker endpoint has no quote timestamp. Never claim a
  // historical response is fresh: reject a stale HTTP response Date when present.
  const responseDate=res.headers?.get?.('date');
  if(!responseDate)throw Error('market response date missing');
  // A cache may refresh its Date while retaining an older origin response.
  // Respect Age even when Date looks current; malformed cache metadata fails closed.
  const ageHeader=res.headers?.get?.('age');
  let cacheAgeMs=0;
  if(ageHeader!==null && ageHeader!==undefined){
    if(!/^(0|[1-9][0-9]*)$/.test(ageHeader))throw Error('invalid market cache age');
    const ageSeconds=Number(ageHeader);
    if(!Number.isSafeInteger(ageSeconds))throw Error('invalid market cache age');
    if(ageSeconds>120)throw Error('stale market cache');
    cacheAgeMs=ageSeconds*1000;
  }
  const servedAt=Date.parse(responseDate);
  const responseAgeMs=Date.now()-servedAt;
  // Date and Age are independent signals. A cache may report a recent Date
  // for a response that has already spent time in an intermediary cache.
  if(!Number.isFinite(servedAt)||responseAgeMs < -120000 ||
     Math.max(0,responseAgeMs)+cacheAgeMs>120000)throw Error('stale market response');
  const result={};
  for(const [key,value] of Object.entries(json.result)){
    // Accept only the three explicitly requested Kraken EUR instruments.
    // Substring matching could silently interpret an unrelated asset as BTC/ETH/SOL.
    const symbol=({XXBTZEUR:'BTC',XBTZEUR:'BTC',XETHZEUR:'ETH',ETHEUR:'ETH',SOLEUR:'SOL'})[key]||null;
    if(!symbol)continue;
    if(Object.hasOwn(result,symbol))throw Error('duplicate market symbol');
    const rawPrice=value?.c?.[0];
    // Kraken publishes decimal strings. Reject booleans, nulls and exponent
    // notation rather than coercing malformed market payloads into prices.
    if(typeof rawPrice!=='string'||!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(rawPrice))throw Error('invalid price');
    const price=Number(rawPrice);
    if(!Number.isFinite(price)||price<=0||!Number.isSafeInteger(Math.round(price*100))||Math.round(price*100)<=0)throw Error('invalid price');
    result[symbol]=Math.round(price*100);
  }
  if(symbols.some(s=>!Number.isSafeInteger(result[s])||result[s]<=0))throw Error('missing price');
  return result;
}
