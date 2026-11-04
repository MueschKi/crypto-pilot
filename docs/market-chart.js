/* CryptoPilot minute candles: real Kraken REST history + live WebSocket ticks.
   Visual only; never generates trading signals or orders. */
(function(){
"use strict";
const state={selected:null,pair:null,candles:[],lastTick:null,token:0,pending:false,status:"Wähle einen Coin",trades:[],lastHistoricalLoad:0,cache:new Map(),activeController:null,recentTicks:[]};
const canvas=()=>document.getElementById("marketChart");
const label=()=>document.getElementById("marketChartStatus");
const euro=new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:2});
const clock=t=>new Date(t*1000).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
function status(s){state.status=s;if(label())label().textContent=s}
function validate(row){if(!Array.isArray(row)||row.length<7)return null;
 const [ts,o,h,l,c,v]=[Number(row[0]),Number(row[1]),Number(row[2]),Number(row[3]),Number(row[4]),Number(row[6])];
 if(![ts,o,h,l,c,v].every(Number.isFinite)||ts<1||Math.min(o,h,l,c)<=0||v<0||l>Math.min(o,c)||h<Math.max(o,c))return null;
 return {t:Math.floor(ts/60)*60,o,h,l,c,v};}
async function select(id,pair,symbol){
 const token=++state.token;
 if(state.activeController){state.activeController.abort();state.activeController=null}
 state.selected=id;state.pair=pair;state.lastTick=null;state.recentTicks=[];
 document.getElementById("marketChartTitle").textContent=(symbol||id).toUpperCase()+" / EUR";
 const cached=state.cache.get(id);
 // Immediately show THIS coin's verified earlier candles if present.
 state.candles=cached?cached.candles.map(x=>({...x})):[];
 status(cached?"Zeige gespeicherte echte Kraken-Kerzen · aktualisiere …":"Lade echte Kraken-1-Minuten-Kerzen …");
 draw();
 if(!pair){status("Für diesen Coin ist kein Kraken-EUR-Markt zugeordnet.");return}
 // 1m REST data is not pushed at each tick; only reload the snapshot when stale.
 if(cached&&cached.pair===pair&&Date.now()-cached.time<20000){
  status("Kraken-Historie · 1-Minuten-Kerzen · Live-Ticks erscheinen automatisch");
  return;
 }
 for(let attempt=0;attempt<2;attempt++){
  const ctrl=new AbortController();state.activeController=ctrl;
  const kill=setTimeout(()=>ctrl.abort(),12000);
  try{
   const response=await fetch("https://api.kraken.com/0/public/OHLC?"+new URLSearchParams({pair,interval:"1"}),{signal:ctrl.signal,cache:"no-store"});
   if(!response.ok)throw Error("HTTP "+response.status);
   const body=await response.json();
   if(token!==state.token)return;
   if(!body||!Array.isArray(body.error)||body.error.length||!body.result)throw Error("Kraken hat keine OHLC-Kerzen geliefert");
   const keys=Object.keys(body.result).filter(k=>k!=="last");
   if(keys.length!==1||!Array.isArray(body.result[keys[0]]))throw Error("Kerzenantwort unbekannt");
   const raw=body.result[keys[0]];
   // A single corrupt interval must not empty an otherwise valid chart.
   const valid=raw.map(validate).filter(Boolean);
   const unique=new Map();
   for(const bar of valid)unique.set(bar.t,bar);
   const ordered=[...unique.values()].sort((a,b)=>a.t-b.t);
   if(ordered.length<2)throw Error("Zu wenige gültige Kerzen für diesen Markt");
   const previous=state.candles;
   // Keep any confirmed live candle that is newer than the HTTP snapshot.
   const live=previous.filter(c=>c.t>ordered[ordered.length-1].t);
   state.candles=[...ordered.slice(-180),...live].slice(-180);
   state.cache.set(id,{pair,time:Date.now(),candles:state.candles.map(x=>({...x}))});
   state.lastHistoricalLoad=Date.now();
   status("Kraken-Historie · "+state.candles.length+" echte 1-Minuten-Kerzen · Live-Ticks aktiv");
   draw();
   return;
  }catch(err){
   if(token!==state.token)return;
   if(attempt===1){
    status(state.candles.length
      ?"Historie vorübergehend nicht aktualisierbar; zeige zuletzt geladene echte Kerzen."
      :"Kraken-Kerzen nicht verfügbar ("+String(err.message)+"). Erneut Coin wählen oder neu laden.");
    draw();
   }
  }finally{clearTimeout(kill);if(state.activeController===ctrl)state.activeController=null}
  if(token===state.token)await new Promise(resolve=>setTimeout(resolve,500));
 }
}
function tick(id,price,time){
 if(id!==state.selected||!Number.isFinite(price)||price<=0)return;
 state.lastTick=time;state.recentTicks.push({t:time,p:price});
 while(state.recentTicks.length>110||(state.recentTicks.length>1&&time-state.recentTicks[0].t>120000))state.recentTicks.shift();
 state.pending=true;
 if(!state.candles.length)return;
 const timeSec=Math.floor(time/1000),minute=Math.floor(timeSec/60)*60;
 const last=state.candles[state.candles.length-1];
 if(minute<last.t)return;
 if(minute>last.t){
  // No synthetic missing-minute candles. The first tick opens a real observed bar.
  state.candles.push({t:minute,o:price,h:price,l:price,c:price,v:0});
  if(state.candles.length>180)state.candles.shift();
 }else{last.h=Math.max(last.h,price);last.l=Math.min(last.l,price);last.c=price;}
 state.pending=true;
}
function trades(list){state.trades=Array.isArray(list)?list:[];state.pending=true}
function draw(){
 const el=canvas();if(!el)return;
 const rect=el.getBoundingClientRect(),w=Math.max(280,Math.floor(rect.width||600)),h=Math.max(220,Math.floor(rect.height||330)),dpr=Math.min(2,window.devicePixelRatio||1);
 if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr)}
 const ctx=el.getContext("2d");if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const L=14,R=76,T=20,B=32,pw=w-L-R,ph=h-T-B;
 ctx.fillStyle="#0a172c";ctx.fillRect(0,0,w,h);
 const visibleCount=w<500?44:w<750?65:100;
 const data=state.candles.slice(-visibleCount);
 if(!data.length){
  ctx.fillStyle="#99aecd";ctx.font="13px system-ui";
  ctx.fillText(state.recentTicks.length?"Echte Live-Ticks · OHLC-Historie wird geladen":"Warte auf echte Kraken-Kerzen …",16,25);
  if(state.recentTicks.length>=2){
   const ticks=state.recentTicks,low=Math.min(...ticks.map(t=>t.p)),high=Math.max(...ticks.map(t=>t.p));
   const delta=Math.max(high-low,high*.00001);
   ctx.strokeStyle="#50c5fb";ctx.lineWidth=2.5;ctx.beginPath();
   ticks.forEach((item,i)=>{const x=20+i*(w-115)/Math.max(1,ticks.length-1),yy=150-(item.p-low)/delta*92;i?ctx.lineTo(x,yy):ctx.moveTo(x,yy)});
   ctx.stroke();
   ctx.fillStyle="#a7b9d3";ctx.font="12px system-ui";ctx.fillText("Nur echte WebSocket-Ticks – keine künstlichen Kerzen",16,187);
  }
  return;
 }
 let lo=Math.min(...data.map(c=>c.l)),hi=Math.max(...data.map(c=>c.h));
 if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo<=0)return;
 const pad=Math.max((hi-lo)*.1,hi*.0005);lo=Math.max(.00000001,lo-pad);hi+=pad;
 const y=p=>T+ph-(p-lo)/(hi-lo)*ph;
 for(let i=0;i<=4;i++){
  const yy=T+i*ph/4;ctx.strokeStyle="#263751";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(L,yy);ctx.lineTo(w-R,yy);ctx.stroke();
  const p=hi-i*(hi-lo)/4;ctx.fillStyle="#9db2cf";ctx.font="11px system-ui";ctx.fillText(p>=1?p.toFixed(2):p.toPrecision(4),w-R+7,yy+4)
 }
 const step=pw/data.length,barW=Math.max(2,Math.min(12,step*.65));
 data.forEach((c,i)=>{
  const x=L+step*(i+.5),up=c.c>=c.o,color=up?"#3cdaa3":"#ff758d";
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x,y(c.h));ctx.lineTo(x,y(c.l));ctx.stroke();
  const y1=y(Math.max(c.o,c.c)),y2=y(Math.min(c.o,c.c));ctx.fillRect(x-barW/2,y1,barW,Math.max(1,y2-y1));
 });
 for(let i=0;i<4;i++){
  const item=data[Math.floor(i*(data.length-1)/3)];
  if(!item)continue;const x=L+step*(i*(data.length-1)/3+.5);
  ctx.fillStyle="#91a6c5";ctx.font="11px system-ui";ctx.fillText(clock(item.t),Math.min(w-115,x-18),h-11);
 }
 const first=data[0].t,last=data[data.length-1].t;
 for(const trade of state.trades){
  if(!trade||typeof trade.time!=="number"||trade.time/1000<first||trade.time/1000>last+60)continue;
  if(trade.id!==state.selected)continue;
  const idx=data.findIndex(c=>Math.floor(trade.time/60000)*60===c.t);
  if(idx<0)continue;
  const x=L+step*(idx+.5),buy=trade.type==="KAUF",yy=buy?Math.min(h-B-10,y(data[idx].l)+12):Math.max(T+10,y(data[idx].h)-12);
  ctx.fillStyle=buy?"#43e7a0":"#ff8799";ctx.beginPath();
  if(buy){ctx.moveTo(x,yy-7);ctx.lineTo(x-7,yy+5);ctx.lineTo(x+7,yy+5)}
  else{ctx.moveTo(x,yy+7);ctx.lineTo(x-7,yy-5);ctx.lineTo(x+7,yy-5)}
  ctx.closePath();ctx.fill();
 }
 // Visual minute progress uses wall-clock time; never modifies a real OHLC value.
 const progress=(Date.now()/1000%60)/60;
 const progressWidth=pw*progress;
 ctx.fillStyle="#1e3556";ctx.fillRect(L,T+ph+6,pw,3);
 ctx.fillStyle="#489bf0";ctx.fillRect(L,T+ph+6,progressWidth,3);
 const sweepX=L+pw*progress;
 ctx.strokeStyle="rgba(95,174,255,.18)";ctx.lineWidth=1;ctx.setLineDash([3,7]);
 ctx.beginPath();ctx.moveTo(sweepX,T+23);ctx.lineTo(sweepX,T+ph);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle="#76baff";ctx.beginPath();ctx.arc(sweepX,T+ph+7.5,3,0,Math.PI*2);ctx.fill();
 // Highlight the last genuine candle with a clock-driven halo, not an invented price.
 const lastVisible=data[data.length-1],endX=L+step*(data.length-.5),endY=y(lastVisible.c);
 const active=state.lastTick!==null&&Date.now()-state.lastTick<20000;
 const glow=active?5+3*(1+Math.sin(Date.now()/220)):4;
 ctx.fillStyle=active?"rgba(68,232,167,.14)":"rgba(168,184,207,.08)";
 ctx.beginPath();ctx.arc(endX,endY,glow+5,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=active?"#4cf3b1":"#8aa0be";ctx.beginPath();ctx.arc(endX,endY,3.5,0,Math.PI*2);ctx.fill();
 // This inset displays only genuine, individually received Kraken WebSocket ticks.
 const ticks=state.recentTicks;
 if(ticks.length>=2){
  const boxX=Math.max(19,w-165),boxY=38,boxW=132,boxH=58;
  ctx.fillStyle="rgba(9,20,39,.88)";ctx.fillRect(boxX-8,boxY-16,boxW+16,boxH+29);
  const low=Math.min(...ticks.map(v=>v.p)),high=Math.max(...ticks.map(v=>v.p)),range=Math.max(high-low,high*.00001);
  ctx.strokeStyle="#6de1bd";ctx.lineWidth=1.8;ctx.beginPath();
  ticks.forEach((v,i)=>{const x=boxX+i*boxW/Math.max(1,ticks.length-1),yy=boxY+boxH-(v.p-low)/range*boxH;i?ctx.lineTo(x,yy):ctx.moveTo(x,yy)});
  ctx.stroke();ctx.font="10px system-ui";ctx.fillStyle="#9ebbd1";ctx.fillText("ECHTE LIVE-TICKS",boxX,boxY-4);
 }
 const lastC=data[data.length-1];ctx.fillStyle="#dceaff";ctx.font="bold 13px system-ui";ctx.fillText(euro.format(lastC.c),L+8,T+16);
 // Visible heartbeat based only on the clock. Prices move ONLY on genuine Kraken ticks.
 const now=Date.now();
 const age=state.lastTick===null?null:Math.max(0,Math.floor((now-state.lastTick)/1000));
 const secondsToNext=60-(Math.floor(now/1000)%60);
 const feedLabel=age===null?"Letzter Tick: noch keiner":age>20?"Tick veraltet: "+age+"s":"Letzter Tick: "+age+"s";
 const heartbeat=w<530?"Kerze "+secondsToNext+"s · Tick "+(age===null?"—":age+"s"):"Nächste Minute in "+secondsToNext+"s  ·  "+feedLabel;
 ctx.font="11px system-ui";const tw=ctx.measureText(heartbeat).width;
 ctx.fillStyle=age!==null&&age<=20?"#40dfa3":"#f2be73";
 ctx.fillText(heartbeat,Math.max(L+6,w-R-tw-5),T+16);
 ctx.fillStyle="#8ea5c5";ctx.font="11px system-ui";ctx.fillText("▲ Kauf   ▼ Verkauf (virtuell)",L+8,h-11);
}
window.CryptoPilotChart={select,tick,trades,draw,get selected(){return state.selected}};
window.addEventListener("resize",()=>{state.pending=true});
// Tick-driven canvas refresh: up to five visible frames per second.
setInterval(()=>{if(!document.hidden){state.pending=false;draw();const el=document.getElementById("chartLiveStatus");if(el){const age=state.lastTick===null?null:Math.floor((Date.now()-state.lastTick)/1000);el.textContent="Chart 5×/Sek. · "+(age===null?"Noch keine echten Live-Ticks":age<=20?"Letzter echter Kraken-Tick vor "+age+"s":"Warte auf neue Kraken-Kurse · letzter Tick vor "+age+"s")}}},200);
// Independent one-second heartbeat so countdown and feed age keep moving
// even when Kraken sends no price change. Never alter candle prices here.
setInterval(()=>{if(!document.hidden)state.pending=true},1000);
})();