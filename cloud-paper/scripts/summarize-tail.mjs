// Accept Cloudflare Wrangler tail NDJSON on stdin; emit only allowlisted paper telemetry.
// Never persist raw log messages, wallet balances, request headers, or secrets.
const counts={tailEvents:0,consoleEntries:0,unparsedMessages:0,ticks:0,errors:0,buys:0,sells:0,waits:0,tradeIds:0,persistedTrades:0,unverifiedTrades:0};
let buffer='';
function record(line){
  let outer;try{outer=JSON.parse(line);}catch{return;}
  if(outer&&typeof outer==='object')counts.tailEvents++;
  const logs=outer?.logs;
  if(!Array.isArray(logs))return;
  for(const entry of logs){
    counts.consoleEntries++;
    for(const arg of (Array.isArray(entry?.message)?entry.message:[entry?.message])){
      let msg;
      if(typeof arg==='object'&&arg!==null)msg=arg;
      else if(typeof arg==='string'){try{msg=JSON.parse(arg);}catch{counts.unparsedMessages++;continue;}}
      else {counts.unparsedMessages++;continue;}
      if(msg?.event==='paper_cron_tick'){
        counts.ticks++;
        if(msg.httpStatus!==200)counts.errors++;
        if(msg.signal==='BUY')counts.buys++;
        else if(msg.signal==='SELL')counts.sells++;
        else if(msg.signal==='WAIT')counts.waits++;
        if(typeof msg.tradeId==='string'&&/^cron_[0-9]+_(BTC|ETH|SOL)_(BUY|SELL)$/.test(msg.tradeId)){
          counts.tradeIds++;
          if(msg.tradePersisted===true)counts.persistedTrades++;
          else {counts.unverifiedTrades++;counts.errors++;}
        }
      } else if(msg?.event==='paper_cron_failure')counts.errors++;
    }
  }
}
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{
  buffer+=chunk;
  let n;while((n=buffer.indexOf('\n'))!==-1){record(buffer.slice(0,n));buffer=buffer.slice(n+1);}
  if(buffer.length>65536)buffer='';
});
process.stdin.on('end',()=>{
  if(buffer)record(buffer);
  console.log('PAPER_CRON_DIAGNOSTICS '+JSON.stringify(counts));
  if(counts.ticks===0)process.exitCode=2;
  else if(counts.errors>0)process.exitCode=1;
});
