/* CryptoPilot v4.2: audit-friendly analog forecast based only on CLOSED Kraken candles.
 * No network calls, no orders, no claims of calibrated probabilities. */
(function(root){
"use strict";
const LOOKBACK=24,HORIZON=6,ROUND_TRIP_PCT=(1-(.999*.996)/(1.001*1.004))*100;
function ensure(rows,period){
 if(!Array.isArray(rows)||rows.length<160||![60,240].includes(period))throw Error("Mindestens 160 vollständige 1h-/4h-Kerzen nötig.");
 const step=period*60,out=[];
 for(const r of rows){
  if(!Array.isArray(r)||r.length<5)throw Error("Unvollständige Kraken-Kerze.");
  const t=Number(r[0]),o=Number(r[1]),h=Number(r[2]),l=Number(r[3]),c=Number(r[4]);
  if(![t,o,h,l,c].every(Number.isFinite)||t<=0||Math.min(o,h,l,c)<=0||l>Math.min(o,c)||h<Math.max(o,c))throw Error("Ungültige OHLC-Daten.");
  if(out.length&&t-out[out.length-1].t!==step)throw Error("Zeitlücke oder doppelte Kerze: Prognose gesperrt.");
  out.push({t,o,h,l,c});
 }
 return out;
}
function features(rows,i){
 if(i<LOOKBACK)return null;
 const current=rows[i].c,prev=rows[i-12].c,window=rows.slice(i-LOOKBACK+1,i+1);
 const returns=[];
 for(let j=i-LOOKBACK+1;j<=i;j++)returns.push(Math.log(rows[j].c/rows[j-1].c));
 const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
 const variance=returns.reduce((a,b)=>a+(b-mean)**2,0)/returns.length;
 const min=Math.min(...window.map(x=>x.l)),max=Math.max(...window.map(x=>x.h));
 return [(current/prev-1)/.04,Math.sqrt(variance)/.015,(current-min)/Math.max(.000001,max-min)/.4];
}
function quantile(sorted,q){
 if(!sorted.length)return null;
 const p=(sorted.length-1)*q,a=Math.floor(p),b=Math.ceil(p),f=p-a;
 return sorted[a]*(1-f)+sorted[b]*f;
}
function estimate(rows,at){
 const current=rows[at],f=features(rows,at);
 if(!f)throw Error("Noch zu wenig Historie.");
 const analogs=[];
 for(let i=LOOKBACK;i<=at-HORIZON;i+=Math.max(1,Math.floor(HORIZON/2))){
  const p=features(rows,i),dist=Math.sqrt(f.reduce((sum,x,j)=>sum+(x-p[j])**2,0));
  if(dist>3.4)continue;
  const future=rows.slice(i+1,i+1+HORIZON);
  analogs.push({dist,close:100*(future.at(-1).c/rows[i].c-1),
    low:100*(Math.min(...future.map(x=>x.l))/rows[i].c-1),
    high:100*(Math.max(...future.map(x=>x.h))/rows[i].c-1)});
 }
 analogs.sort((a,b)=>a.dist-b.dist);
 const selected=analogs.slice(0,30);
 if(selected.length<18)throw Error("Zu wenige vergleichbare historische Marktphasen.");
 const sorted=key=>selected.map(x=>x[key]).sort((a,b)=>a-b);
 const close=sorted("close"),low=sorted("low"),high=sorted("high");
 const median=quantile(close,.5),lower=quantile(close,.1),upper=quantile(close,.9);
 const support=quantile(low,.2),resistance=quantile(high,.8);
 return {at:current.t,price:current.c,horizon:HORIZON,samples:selected.length,
  expectedReturnPct:median,closeBandPct:[lower,upper],
  lowScenarioPct:support,highScenarioPct:resistance,
  closeBand:[current.c*(1+lower/100),current.c*(1+upper/100)],
  lowScenario:current.c*(1+support/100),highScenario:current.c*(1+resistance/100),
  costPct:ROUND_TRIP_PCT,
  stance:median>ROUND_TRIP_PCT?"Aufwärtsszenario":median<-ROUND_TRIP_PCT?"Abwärtsszenario":"Kein ausreichender erwarteter Vorteil"};
}
function backcheck(rows){
 const results=[];
 // Only non-overlapping forward outcomes, each model uses examples fully resolved BEFORE cutoff.
 for(let at=Math.max(LOOKBACK+HORIZON+70,Math.floor(rows.length*.55));at+HORIZON<rows.length;at+=HORIZON){
  let p;try{p=estimate(rows,at)}catch(_){continue}
  const actual=rows[at+HORIZON].c;
  results.push({errorPct:100*Math.abs(p.price*(1+p.expectedReturnPct/100)-actual)/actual,
   baselinePct:100*Math.abs(p.price-actual)/actual,
   covered:actual>=p.closeBand[0]&&actual<=p.closeBand[1]});
 }
 if(results.length<8)return {count:results.length,validated:false};
 const mean=key=>results.reduce((sum,x)=>sum+x[key],0)/results.length;
 const maePct=mean("errorPct"),baselineMaePct=mean("baselinePct");
 return {count:results.length,validated:false,maePct,baselineMaePct,
  coveragePct:100*mean("covered"),beatsBaseline:maePct<baselineMaePct};
}
function forecast(input){
 const period=Number(input?.period),rows=ensure(input?.rows,period);
 const latest=estimate(rows,rows.length-1);
 return {...latest,period,checked:backcheck(rows),until:latest.at+period*60*HORIZON};
}
function settle(record,rows){
 if(!record||!Number.isFinite(record.at)||![60,240].includes(record.period)||!Number.isFinite(record.until)||!Number.isFinite(record.price)||record.price<=0)return null;
 const past=ensure(rows,record.period);
 const base=past.findIndex(x=>x.t===record.at),last=base+HORIZON;
 if(base<0||last>=past.length||past[last].t!==record.until)return null;
 const actual=past[last].c;
 return {actual,actualLow:Math.min(...past.slice(base+1,last+1).map(x=>x.l)),
  actualHigh:Math.max(...past.slice(base+1,last+1).map(x=>x.h)),
  errorPct:100*Math.abs(record.price*(1+record.expectedReturnPct/100)-actual)/actual,
  baselinePct:100*Math.abs(record.price-actual)/actual,
  covered:actual>=record.closeBand[0]&&actual<=record.closeBand[1]};
}
function scoreJournal(records){
 // Strictly completed forecasts only. Each result is paired with an immutable original issue.
 const checked=(Array.isArray(records)?records:[]).filter(r=>
  r&&r.actual&&Number.isFinite(r.actual.actual)&&r.actual.actual>0
  &&Number.isFinite(r.actual.errorPct)&&r.actual.errorPct>=0
  &&Number.isFinite(r.actual.baselinePct)&&r.actual.baselinePct>=0
  &&Number.isFinite(r.price)&&r.price>0&&Number.isFinite(r.expectedReturnPct)
  &&Array.isArray(r.closeBand)&&r.closeBand.length===2
  &&r.closeBand.every(Number.isFinite));
 const count=checked.length;
 if(!count)return {count:0,meaningful:false,maePct:null,baselineMaePct:null,
  directionPct:null,coveragePct:null,betterPct:null,meanRealizedPct:null};
 const avg=f=>checked.reduce((sum,r)=>sum+f(r),0)/count;
 const directionPct=100*avg(r=>{
  const predicted=Math.sign(r.expectedReturnPct),observed=Math.sign(r.actual.actual/r.price-1);
  return predicted===observed?1:0;
 });
 return {count,meaningful:count>=30,maePct:avg(r=>r.actual.errorPct),
  baselineMaePct:avg(r=>r.actual.baselinePct),directionPct,
  coveragePct:100*avg(r=>r.actual.actual>=r.closeBand[0]&&r.actual.actual<=r.closeBand[1]?1:0),
  betterPct:100*avg(r=>r.actual.errorPct<r.actual.baselinePct?1:0),
  meanRealizedPct:avg(r=>100*(r.actual.actual/r.price-1))};
}
root.CryptoPilotForecast={forecast,ensure,estimate,backcheck,settle,scoreJournal,roundTripPct:ROUND_TRIP_PCT};
})(typeof window!=="undefined"?window:globalThis);
