/* CryptoPilot v4.4: pure coordination for forecast-outcome verification.
 * This module never fetches prices, places orders or creates forecasts. */
(function(root){
"use strict";
function dueGroups(records,now,maxGroups=4){
 if(!Array.isArray(records)||!Number.isFinite(now)||!Number.isInteger(maxGroups)||maxGroups<1)return [];
 const groups=new Map();
 for(const record of records){
  if(!record||record.actual||typeof record.coin!=="string"||typeof record.pair!=="string"
   ||![60,240].includes(record.period)||!Number.isFinite(record.until))continue;
  const due=(record.until+record.period*60)*1000;
  if(due>now)continue;
  const key=JSON.stringify([record.coin,record.pair,record.period]);
  const prev=groups.get(key);
  if(prev)prev.count++;
  else groups.set(key,{coin:record.coin,pair:record.pair,period:record.period,
   oldestDue:due,count:1});
 }
 return [...groups.values()].sort((a,b)=>a.oldestDue-b.oldestDue).slice(0,maxGroups);
}
function mergeOutcomes(records,group,closed,engine){
 if(!Array.isArray(records)||!group||!engine||typeof engine.settle!=="function")throw Error("Ungültige Prognoseprüfung.");
 let settled=0;
 const updated=records.map(record=>{
  if(!record||record.actual||record.coin!==group.coin||record.pair!==group.pair||record.period!==group.period)return record;
  const result=engine.settle(record,closed);
  if(!result)return record;
  settled++;
  return {...record,actual:result};
 });
 return {records:updated,settled};
}
function status(records,now){
 const pending=records.filter(x=>x&&!x.actual),due=dueGroups(records,now,1000);
 return {count:records.length,verified:records.length-pending.length,pending:pending.length,
  due:due.reduce((sum,x)=>sum+x.count,0),markets:due.length};
}
root.CryptoPilotForecastJournal={dueGroups,mergeOutcomes,status};
})(typeof window!=="undefined"?window:globalThis);
