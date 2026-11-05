/* CryptoPilot v4.5: historical, cost-aware SHADOW strategy only.
 * No orders, no stored holdings, and no strategy parameters selected on the test set. */
(function(root){
"use strict";
const COST={fee:.004,slippage:.001,bufferPct:.5};
function mark(qty,cash,close){
 return cash+(qty?qty*close*(1-COST.slippage)*(1-COST.fee):0);
}
function buy(cash,open){
 return cash*(1-COST.fee)/(open*(1+COST.slippage));
}
function sell(qty,open){
 return qty*open*(1-COST.slippage)*(1-COST.fee);
}
function simulate(input,forecastEngine){
 if(!forecastEngine||typeof forecastEngine.ensure!=="function"||typeof forecastEngine.estimate!=="function")
  throw Error("Unabhängige Prognosekomponente fehlt.");
 const period=Number(input?.period),rows=forecastEngine.ensure(input?.rows,period);
 if(rows.length<300)throw Error("Für einen getrennten Test sind mindestens 300 abgeschlossene Kerzen erforderlich.");
 const split=Math.max(180,Math.floor(rows.length*.60));
 // Historical analogy parameters are fixed, never optimized on the holdout.
 const threshold=forecastEngine.roundTripPct+COST.bufferPct;
 let cash=1000,qty=0,entryPrice=null,entryTime=null,exitAt=-1;
 let signals=0,trades=0,wins=0,gross=0,estimatedCosts=0,peak=1000,dd=0;
 const curve=[];
 const baselineQty=buy(1000,rows[split].o);
 let baselinePeak=1000,baselineDD=0,baselineCurve=[];
 for(let i=split;i<rows.length;i++){
  const bar=rows[i];
  if(qty&&i>=exitAt){
   const before=qty*bar.o,after=sell(qty,bar.o);
   estimatedCosts+=before-after;
   if(after>gross)wins++;
   cash=after;qty=0;entryPrice=null;trades++;
  }
  if(!qty&&i+6<rows.length){
   let prediction=null;
   try{prediction=forecastEngine.estimate(rows.slice(0,i),i-1)}catch(_){}
   // Signal at prior CLOSED candle only; buy at next bar open if edge exceeds
   // both sides' fee+slippage and a precommitted 0.5 percentage-point buffer.
   if(prediction&&prediction.expectedReturnPct>threshold){
    const capital=cash;
    const units=buy(capital,bar.o);
    estimatedCosts+=capital-units*bar.o;
    entryPrice=bar.o;entryTime=bar.t;gross=capital;
    qty=units;cash=0;exitAt=i+6;signals++;
   }
  }
  const equity=mark(qty,cash,bar.c);
  peak=Math.max(peak,equity);
  dd=Math.min(dd,100*(equity/peak-1));
  curve.push({t:bar.t,value:equity});
  const baseline=mark(baselineQty,0,bar.c);
  baselinePeak=Math.max(baselinePeak,baseline);
  baselineDD=Math.min(baselineDD,100*(baseline/baselinePeak-1));
  baselineCurve.push({t:bar.t,value:baseline});
 }
 const last=rows.at(-1),final=mark(qty,cash,last.c),baselineFinal=mark(baselineQty,0,last.c);
 // Unrealized positions remain open and are only net-valued hypothetically.
 return {period,bars:rows.length,split,barsTested:rows.length-split,start:rows[split].t,end:last.t,
  thresholdPct:threshold,forecast: {value:final,returnPct:100*(final/1000-1),drawdownPct:dd,
   signals,closedTrades:trades,winRatePct:trades?100*wins/trades:null,
   estimatedExecutedCosts:estimatedCosts,openPosition:qty>0,curve},
  hold:{value:baselineFinal,returnPct:100*(baselineFinal/1000-1),drawdownPct:baselineDD,curve:baselineCurve},
  betterThanHold:final>baselineFinal, noSignal:signals===0,
  notice:"Schatten-Backtest: keine ausführbaren Orders, keine Prognose-Garantie und kein bestätigter Gewinnvorteil."};
}
root.CryptoPilotShadow={simulate};
})(typeof window!=="undefined"?window:globalThis);
