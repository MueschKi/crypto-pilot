// Deterministic, paper-only strategy. Inputs must be fresh and independently validated.
// No real exchange orders, credentials, network calls or side effects.
export function decidePaperTrade({prices,previousPrices,wallet,enabled,halted,nowMs,lastTradeMs=0}) {
  if(!enabled)return {action:'WAIT',reason:'disabled'};
  if(halted)return {action:'WAIT',reason:'halted'};
  if(!Number.isSafeInteger(nowMs)||nowMs<0||!Number.isSafeInteger(lastTradeMs)||lastTradeMs<0||lastTradeMs>nowMs)return {action:'WAIT',reason:'invalid_clock'};
  if(nowMs-lastTradeMs<300000)return {action:'WAIT',reason:'cooldown'};
  if(!wallet||!Number.isSafeInteger(wallet.cashCents)||wallet.cashCents<0||!wallet.positions||typeof wallet.positions!=='object')return {action:'WAIT',reason:'invalid_wallet'};
  for(const symbol of ['BTC','ETH','SOL']){
    const current=prices?.[symbol],prior=previousPrices?.[symbol];
    if(!Number.isSafeInteger(current)||current<=0||!Number.isSafeInteger(prior)||prior<=0)return {action:'WAIT',reason:'invalid_prices'};
  }
  const positions=wallet.positions;
  // 0.7% move threshold deliberately exceeds estimated round-trip fees.
  for(const symbol of ['BTC','ETH','SOL']){
    const price=prices[symbol],prior=previousPrices[symbol],position=positions[symbol];
    const change=(price-prior)/prior;
    if(position&&position.quantityUnits>0&&change<=-0.007){
      return {action:'SELL',symbol,quantityUnits:position.quantityUnits,reason:'momentum_exit'};
    }
  }
  const gross=Object.values(positions).reduce((sum,p)=>sum+(p?.costCents||0),0);
  if(!Number.isSafeInteger(gross)||gross>45000)return {action:'WAIT',reason:'invalid_exposure'};
  for(const symbol of ['BTC','ETH','SOL']){
    const change=(prices[symbol]-previousPrices[symbol])/previousPrices[symbol];
    if(change>=0.007&&!positions[symbol]&&Object.keys(positions).length<3&&gross<=40000&&wallet.cashCents>=5100){
      // Fixed €50 notional; execution adapter must quantize micro-units and add fees.
      return {action:'BUY',symbol,notionalCents:5000,reason:'momentum_entry'};
    }
  }
  return {action:'WAIT',reason:'no_signal'};
}
