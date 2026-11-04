/* CryptoPilot signal observability. Independent diagnostics; never places orders. */
(function(root){
"use strict";
function summarize(ticks,quote,now){
 const valid=(Array.isArray(ticks)?ticks:[]).filter(t=>t&&Number.isFinite(t.price)&&t.price>0&&Number.isFinite(t.time)&&t.time<=now&&t.time>=now-120000);
 const current=quote&&Number.isFinite(quote.last)&&quote.last>0&&Number.isFinite(quote.ask)&&Number.isFinite(quote.bid)&&quote.ask>=quote.bid&&quote.bid>0?quote:null;
 const age=current&&Number.isFinite(current.time)?Math.max(0,now-current.time):null;
 const spread=current?(current.ask-current.bid)/current.ask*100:null;
 const recent=valid.filter(t=>t.time>=now-60000);
 const base=recent[0],tail=recent[recent.length-1];
 const movement=base&&tail&&recent.length>=2?(tail.price/base.price-1)*100:null;
 const eligible=age!==null&&age<20000&&spread!==null&&spread<.8&&recent.length>=12&&tail.time-base.time>=10000;
 let state="WARTEN",reason="Noch keine verwertbaren Live-Ticks.";
 if(!current)reason="Kein gültiger Kraken-EUR-Kurs.";
 else if(age>=20000)reason="Marktdaten sind veraltet.";
 else if(spread>=.8)reason="Spread zu hoch (mindestens 0,8 %).";
 else if(recent.length<12)reason="Noch zu wenige unabhängige Kursticks.";
 else if(!base||!tail||tail.time-base.time<10000)reason="Zu kurzer Beobachtungszeitraum.";
 else if(movement!==null&&movement>.15){state="AUFWÄRTS";reason="Kurzfristiges positives Momentum, keine Kaufgarantie."}
 else if(movement!==null&&movement<-.15){state="ABWÄRTS";reason="Kurzfristig fallender Kurs, keine Verkaufsempfehlung."}
 else{state="SEITWÄRTS";reason="Keine klare kurzfristige Richtung."}
 return {state,reason,age,spread,movement,count:recent.length,eligible};
}
root.CryptoPilotSignals={summarize};
})(typeof window!=="undefined"?window:globalThis);
