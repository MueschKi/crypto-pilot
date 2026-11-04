/* CryptoPilot Strategy Lab v3.9
   Pure offline-style backtests on public OHLC only. No orders or exchange accounts.
   Kraken includes an uncommitted last candle: the caller MUST remove it. */
(function(root){
"use strict";
const FEE=.004,SLIP=.001,START=1000;
function candles(raw){
 if(!Array.isArray(raw))throw Error("Kraken-Kerzen fehlen.");
 const seen=new Set(),out=[];
 for(const x of raw){
  if(!Array.isArray(x)||x.length<5)throw Error("Ungültige Kerzenantwort.");
  const t=Number(x[0]),o=Number(x[1]),h=Number(x[2]),l=Number(x[3]),c=Number(x[4]);
  if(![t,o,h,l,c].every(Number.isFinite)||t<=0||Math.min(o,h,l,c)<=0||l>Math.min(o,c)||h<Math.max(o,c)||seen.has(t))throw Error("Ungültige oder doppelte Kerze.");
  seen.add(t);out.push({t,o,h,l,c});
 }
 for(let i=1;i<out.length;i++)if(out[i].t<=out[i-1].t)throw Error("Kerzen nicht chronologisch.");
 return out;
}
function strategySignal(name,history){
 const n=history.length;if(name==="hold")return n>=1;
 if(name==="ema"){
  if(n<25)return false;
  // EMAs use only previous CLOSED candles, never current/future OHLC.
  const ema=(period)=>{const k=2/(period+1);let v=history[0].c;for(let i=1;i<n;i++)v=history[i].c*k+v*(1-k);return v};
  return ema(8)>ema(21);
 }
 if(name==="breakout"){
  if(n<21)return false;
  const last=history[n-1].c,previous=history.slice(n-21,n-1);
  return last>Math.max(...previous.map(x=>x.h));
 }
 throw Error("Unbekannte Strategie.");
}
function simulate(data,name,start,end){
 // Deterministic, long-or-cash, trades at next OPEN after completed previous candle.
 // No shorting, leverage or optimistic intrabar assumptions.
 let cash=START,qty=0,entryCost=0,peak=START,worst=0,buys=0,sells=0,wins=0,costs=0;
 const equityCurve=[],trades=[];
 const openTrade=(price,t)=>{
  const buyPrice=price*(1+SLIP),commission=cash*FEE;
  const invested=cash-commission;
  if(invested<=0)return;
  qty=invested/buyPrice;entryCost=cash;costs+=commission+qty*(buyPrice-price);
  cash=0;buys++;trades.push({t,side:"Kauf",price:buyPrice});
 };
 const closeTrade=(price,t)=>{
  const sellPrice=price*(1-SLIP),gross=qty*sellPrice,commission=gross*FEE,proceeds=gross-commission;
  costs+=commission+qty*(price-sellPrice);
  if(proceeds>entryCost)wins++;
  cash=proceeds;qty=0;entryCost=0;sells++;trades.push({t,side:"Verkauf",price:sellPrice});
 };
 for(let i=start;i<end;i++){
  // At open(i), signals are based only on the candles with indexes < i.
  const want=strategySignal(name,data.slice(0,i));
  if(want&&!qty)openTrade(data[i].o,data[i].t);
  else if(!want&&qty)closeTrade(data[i].o,data[i].t);
  const eq=cash+qty*data[i].c*(1-SLIP)*(1-FEE);
  peak=Math.max(peak,eq);worst=Math.min(worst,(eq/peak-1)*100);
  equityCurve.push({t:data[i].t,value:eq});
 }
 if(qty){
  // At end of evaluation, mark to actual theoretical net exit, without counting as executed trade.
  const p=data[end-1].c;
  const exit=p*(1-SLIP)*(1-FEE);const v=qty*exit;
  // Unrealized position remains open, and its liquidation costs are already in equity.
  if(!Number.isFinite(v))throw Error("Ungültiger Portfolio-Wert.");
 }
 const final=equityCurve.at(-1).value;
 return {name,capital:final,returnPct:(final/START-1)*100,drawdownPct:worst,buys,sells,winRate:sells?100*wins/sells:null,estimatedCosts:costs,curve:equityCurve,trades};
}
function compare(input){
 if(!input||!Array.isArray(input.rows))throw Error("Keine historische Datenbasis.");
 const data=candles(input.rows);
 const period=Number(input.period);
 if(![60,240].includes(period))throw Error("Zeitraum nicht unterstützt.");
 const seconds=period*60;
 for(let i=1;i<data.length;i++)if(data[i].t-data[i-1].t!==seconds)throw Error("Lücke in historischen Kurskerzen. Kein belastbarer Backtest.");
 if(data.length<180)throw Error("Mindestens 180 abgeschlossene Stunden-/Vierstundenkerzen erforderlich.");
 // Chronological split fixed upfront: 60% development, 40% unseen holdout.
 const split=Math.floor(data.length*.6),models=["hold","ema","breakout"];
 const development=models.map(name=>simulate(data,name,25,split));
 const holdout=models.map(name=>simulate(data,name,split,data.length));
 // Three chronologically ordered expanding-history evaluation windows.
 // Parameters are fixed, NOT optimized in-sample: no claim of ML validation.
 const foldStarts=[.4,.6,.8].map(f=>Math.floor(data.length*f));
 const walkForward=models.map(name=>{
  const windows=foldStarts.map((start,i)=>simulate(data,name,start,i<2?foldStarts[i+1]:data.length));
  return {name,windows,positiveWindows:windows.filter(w=>w.returnPct>0).length};
 });
 return {bars:data.length,period,split,from:data[0].t,to:data.at(-1).t,feePct:FEE*100,slippagePct:SLIP*100,development,holdout,holdoutStart:data[split].t,walkForward};
}
root.CryptoPilotStrategyLab={candles,compare,simulate,strategySignal};
})(typeof window!=="undefined"?window:globalThis);
