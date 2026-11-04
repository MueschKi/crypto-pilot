/* CryptoPilot minute candles: real Kraken REST history + live WebSocket ticks.
   Visual only; never generates trading signals or orders. */
(function(){
"use strict";
const state={selected:null,pair:null,candles:[],lastTick:null,token:0,pending:false,status:"Wähle einen Coin",trades:[],lastHistoricalLoad:0};
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
 const token=++state.token;state.selected=id;state.pair=pair;state.candles=[];state.lastTick=null;
 document.getElementById("marketChartTitle").textContent=(symbol||id).toUpperCase()+" / EUR";
 status("Lade echte Kraken-1-Minuten-Kerzen …");draw();
 if(!pair){status("Für diesen Coin ist kein Kraken-EUR-Markt zugeordnet.");return}
 try{
  const ctrl=new AbortController(),kill=setTimeout(()=>ctrl.abort(),12000);
  let response;
  try{response=await fetch("https://api.kraken.com/0/public/OHLC?"+new URLSearchParams({pair,interval:"1"}),{signal:ctrl.signal,cache:"no-store"})}
  finally{clearTimeout(kill)}
  if(!response.ok)throw Error("HTTP "+response.status);
  const body=await response.json();
  if(token!==state.token)return;
  if(!body||!Array.isArray(body.error)||body.error.length||!body.result)throw Error("Kraken hat keine OHLC-Kerzen geliefert");
  const keys=Object.keys(body.result).filter(k=>k!=="last");
  if(keys.length!==1||!Array.isArray(body.result[keys[0]]))throw Error("Kerzenantwort unbekannt");
  const rows=body.result[keys[0]].map(validate);
  if(rows.some(r=>!r))throw Error("Ungültige OHLC-Kerze");
  const ordered=rows.filter((r,i)=>i===0||r.t>rows[i-1].t);
  state.candles=ordered.slice(-120);
  state.lastHistoricalLoad=Date.now();
  status("Kraken-Historie · 1-Minuten-Kerzen · Live-Ticks erscheinen automatisch");
  draw();
 }catch(err){if(token!==state.token)return;status("Kerzen aktuell nicht verfügbar ("+String(err.message)+").");draw()}
}
function tick(id,price,time){
 if(id!==state.selected||!Number.isFinite(price)||price<=0||!state.candles.length)return;
 const timeSec=Math.floor(time/1000),minute=Math.floor(timeSec/60)*60;
 const last=state.candles[state.candles.length-1];
 if(minute<last.t)return;
 if(minute>last.t){
  // No synthetic missing-minute candles. The first tick opens a real observed bar.
  state.candles.push({t:minute,o:price,h:price,l:price,c:price,v:0});
  if(state.candles.length>120)state.candles.shift();
 }else{last.h=Math.max(last.h,price);last.l=Math.min(last.l,price);last.c=price;}
 state.lastTick=time;state.pending=true;
}
function trades(list){state.trades=Array.isArray(list)?list:[];state.pending=true}
function draw(){
 const el=canvas();if(!el)return;
 const rect=el.getBoundingClientRect(),w=Math.max(280,Math.floor(rect.width||600)),h=Math.max(220,Math.floor(rect.height||330)),dpr=Math.min(2,window.devicePixelRatio||1);
 if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr)}
 const ctx=el.getContext("2d");if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const L=14,R=76,T=20,B=32,pw=w-L-R,ph=h-T-B;
 ctx.fillStyle="#0a172c";ctx.fillRect(0,0,w,h);
 const data=state.candles.slice(-90);
 if(!data.length){ctx.fillStyle="#99aecd";ctx.font="13px system-ui";ctx.fillText("Warte auf echte Kraken-Kerzen …",20,h/2);return}
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
 const lastC=data[data.length-1];ctx.fillStyle="#dceaff";ctx.font="bold 13px system-ui";ctx.fillText(euro.format(lastC.c),L+8,T+16);
 ctx.fillStyle="#8ea5c5";ctx.font="11px system-ui";ctx.fillText("▲ Kauf   ▼ Verkauf (virtuell)",L+8,h-11);
}
window.CryptoPilotChart={select,tick,trades,draw,get selected(){return state.selected}};
window.addEventListener("resize",()=>{state.pending=true});
setInterval(()=>{if(state.pending&&!document.hidden){state.pending=false;draw()}},200);
})();