/* CryptoPilot v4.0: deterministic paper-only execution rules.
   Illustrative heuristic, not optimized or validated for profit. No exchange calls. */
(function(root){
"use strict";
const P={minTicks:12,minDurationMs:20000,maxAgeMs:20000,maxSpreadPct:.35,
 minMomentumPct:1.15,maxRangePct:3.5,stopLossPct:-2.5,
 targetPct:3.5,trailArmedPct:2,trailFromPeakPct:1,
 timeStopMs:45*60000,minHoldingMs:30000,cooldownMs:10*60000};
function inspectEntry(ticks,q,now,lastTradeAt){
 const no=reason=>({buy:false,reason,momentumPct:null,spreadPct:null});
 if(!q||![q.bid,q.ask,q.last,q.time].every(Number.isFinite)||q.bid<=0||q.last<=0||q.ask<q.bid||now-q.time>P.maxAgeMs||q.time>now+1000)return no("Kein aktueller gültiger Kraken-Spread.");
 const spreadPct=100*(q.ask-q.bid)/q.ask;
 if(spreadPct>P.maxSpreadPct)return {...no("Spread über 0,35 %."),spreadPct};
 if(now-lastTradeAt<P.cooldownMs)return {...no("Coin-Abkühlzeit aktiv."),spreadPct};
 const fresh=(Array.isArray(ticks)?ticks:[]).filter(t=>t&&Number.isFinite(t.price)&&t.price>0&&Number.isFinite(t.time)&&t.time>=now-90000&&t.time<=now);
 if(fresh.length<P.minTicks)return {...no("Zu wenige echte Kursticks."),spreadPct};
 const first=fresh[0],last=fresh[fresh.length-1],duration=last.time-first.time;
 if(duration<P.minDurationMs)return {...no("Beobachtungsfenster zu kurz."),spreadPct};
 const prices=fresh.map(t=>t.price);
 const momentumPct=100*(last.price/first.price-1);
 const rangePct=100*(Math.max(...prices)/Math.min(...prices)-1);
 const lastThree=prices.slice(-3),early=prices.slice(0,Math.max(1,prices.length-3));
 const trendOk=lastThree.reduce((a,b)=>a+b,0)/lastThree.length >early.reduce((a,b)=>a+b,0)/early.length;
 const buy=momentumPct>=P.minMomentumPct&&rangePct<=P.maxRangePct&&trendOk&&q.last>=last.price*.998;
 return {buy,reason:buy?"Momentum + enger Spread + Datenqualität bestätigt.":"Momentum-/Volatilitätsfilter nicht erfüllt.",momentumPct,spreadPct};
}
function inspectExit(position,q,now){
 if(!position||!Number.isFinite(position.qty)||position.qty<=0||!Number.isFinite(position.cost)||position.cost<=0||!q||![q.bid,q.ask,q.last,q.time].every(Number.isFinite)||q.bid<=0||q.last<=0||q.ask<q.bid||q.time>now+1000||now-q.time>P.maxAgeMs)return {sell:false,reason:"Kein gültiger Kurs – kein fiktiver Verkauf.",peak:null};
 const net=q.bid*.999*.996;
 const baseline=position.cost/position.qty;
 const pnlPct=100*(net/baseline-1);
 const peak=Math.max(Number.isFinite(position.peakBid)&&position.peakBid>0?position.peakBid:q.bid,q.bid);
 const peakNet=peak*.999*.996;
 const age=Math.max(0,now-(Number.isFinite(position.openedAt)?position.openedAt:now));
 if(pnlPct<=P.stopLossPct)return {sell:true,reason:"Verluststopp (Demo)",peak,pnlPct};
 if(pnlPct>=P.targetPct)return {sell:true,reason:"Gewinnziel (Demo)",peak,pnlPct};
 const peakGainPct=100*(peakNet/baseline-1);
 const trailDropPct=100*(q.bid/peak-1);
 if(peakGainPct>=P.trailArmedPct&&trailDropPct<=-P.trailFromPeakPct&&age>=P.minHoldingMs)return {sell:true,reason:"Nachziehender Gewinnschutz (Demo)",peak,pnlPct};
 if(age>=P.timeStopMs&&pnlPct<0)return {sell:true,reason:"Zeitstopp bei Verlust (Demo)",peak,pnlPct};
 return {sell:false,reason:"Position beobachten.",peak,pnlPct};
}
root.CryptoPilotPaperRules={P,inspectEntry,inspectExit};
})(typeof window!=="undefined"?window:globalThis);
