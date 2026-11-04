"""Dynamic top-20 cryptocurrency discovery with public APIs only."""
from __future__ import annotations
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone

KNOWN_BASE = {
 'bitcoin':'XBT', 'ethereum':'ETH', 'tether':'USDT', 'ripple':'XRP',
 'binancecoin':'BNB', 'solana':'SOL', 'usd-coin':'USDC', 'dogecoin':'XDG',
 'tron':'TRX', 'cardano':'ADA', 'chainlink':'LINK', 'avalanche-2':'AVAX',
 'stellar':'XLM', 'sui':'SUI', 'toncoin':'TON', 'shiba-inu':'SHIB',
 'polkadot':'DOT', 'bitcoin-cash':'BCH', 'litecoin':'LTC',
 'uniswap':'UNI', 'near':'NEAR', 'pepe':'PEPE', 'aptos':'APT',
 'internet-computer':'ICP', 'ethereum-classic':'ETC', 'aave':'AAVE',
 'hedera-hashgraph':'HBAR', 'hyperliquid':'HYPE', 'wrapped-bitcoin':'WBTC',
 'leo-token':'LEO', 'ethena-usde':'USDE', 'dai':'DAI',
 'official-trump':'TRUMP', 'bittensor':'TAO', 'ondo-finance':'ONDO',
 'okb':'OKB', 'worldcoin-wld':'WLD', 'monero':'XMR',
}
STABLE_IDS = {'tether', 'usd-coin', 'dai', 'ethena-usde', 'first-digital-usd',
              'paypal-usd', 'usdd', 'true-usd'}

def public_json(url: str, max_bytes: int = 8_000_000) -> object:
    request = urllib.request.Request(url, headers={'User-Agent': 'CryptoPilot-Research/0.1',
                                                    'Accept':'application/json'})
    with urllib.request.urlopen(request, timeout=25) as response:
        if response.status != 200:
            raise ValueError('Public provider returned unexpected status')
        raw = response.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise ValueError('Public provider response too large')
    return json.loads(raw)

def parse_leaders(data: object) -> list[dict]:
    if not isinstance(data, list) or len(data) != 20:
        raise ValueError('Top-20 ranking unavailable or incomplete')
    leaders, ids = [], set()
    for pos, row in enumerate(data, 1):
        if not isinstance(row, dict):
            raise ValueError('Invalid market-cap entry')
        cid, symbol, name, cap = (row.get(k) for k in ('id','symbol','name','market_cap'))
        if not (isinstance(cid,str) and cid and cid not in ids
                and isinstance(symbol,str) and symbol.isalnum() and len(symbol)<=16
                and isinstance(name,str) and name
                and isinstance(cap,(int,float)) and not isinstance(cap,bool) and cap>0):
            raise ValueError('Invalid or duplicate market-cap entry')
        rank = row.get('market_cap_rank')
        if not isinstance(rank,int) or rank != pos:
            raise ValueError('Top-20 ranking is not consecutive')
        ids.add(cid)
        leaders.append({'rank':pos,'id':cid,'name':name,'symbol':symbol.upper(),
                        'market_cap_eur':cap, 'stablecoin':cid in STABLE_IDS})
    return leaders

def parse_kraken_pairs(data: object) -> dict[str,str]:
    if not isinstance(data,dict) or data.get('error') != [] or not isinstance(data.get('result'),dict):
        raise ValueError('Kraken AssetPairs unavailable')
    index: dict[str,set[str]] = {}
    for key, info in data['result'].items():
        if not isinstance(info,dict) or info.get('status','online') != 'online':
            continue
        wsname = info.get('wsname')
        if not isinstance(wsname,str) or not wsname.endswith('/EUR'):
            continue
        base = wsname.split('/')[0]
        if base and isinstance(key,str):
            index.setdefault(base,set()).add(key)
    return {base:next(iter(keys)) for base,keys in index.items() if len(keys)==1}

def combine(leaders: list[dict], kraken_pairs: dict[str,str]) -> dict:
    rows=[]
    for coin in leaders:
        base = KNOWN_BASE.get(coin['id'])
        pair = kraken_pairs.get(base) if base is not None else None
        state = ('stablecoin_excluded_from_trading' if coin['stablecoin'] else
                 'unmapped_asset' if base is None else
                 'eur_market_unavailable' if pair is None else 'eligible_for_research')
        rows.append({**coin,'kraken_pair':pair,'status':state})
    return {'captured_at_utc': datetime.now(timezone.utc).isoformat(),
            'ranking_source':'CoinGecko /coins/markets by market capitalization',
            'execution_source':'Kraken public EUR OHLC', 'universe':rows,
            'counts':{'top20':len(rows),'eligible':sum(x['status']=='eligible_for_research' for x in rows),
                      'not_eligible':sum(x['status']!='eligible_for_research' for x in rows)}}

def discover() -> dict:
    params=urllib.parse.urlencode({'vs_currency':'eur','order':'market_cap_desc',
                                   'per_page':20,'page':1,'sparkline':'false'})
    leaders = parse_leaders(public_json('https://api.coingecko.com/api/v3/coins/markets?'+params))
    pairs = parse_kraken_pairs(public_json('https://api.kraken.com/0/public/AssetPairs'))
    return combine(leaders,pairs)
