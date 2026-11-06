import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
import bot
from bot import Candle, backtest, parse_kraken, signal, synthetic
from universe import parse_leaders, parse_kraken_pairs, combine

def leaders():
    return [{'market_cap_rank':i,'id':f'asset-{i}', 'symbol':f'coin{i}',
             'name':f'Asset {i}', 'market_cap':100000000/i} for i in range(1,21)]

class SafeResearchTests(unittest.TestCase):
    def test_offline_demo(self):
        result=backtest(synthetic())
        self.assertEqual(result['initial_eur'],1000.0)
        self.assertGreater(result['final_eur'],0)
        self.assertGreaterEqual(result['max_drawdown_pct'],0)
        self.assertLess(result['max_drawdown_pct'],100)

    def test_incomplete_candle_discarded(self):
        rows=[[c.stamp,str(c.opening),str(c.high),str(c.low),str(c.close),'0',str(c.volume),'1'] for c in synthetic(80)]
        result=parse_kraken({'error':[],'result':{'XXBTZEUR':rows,'last':999}})
        self.assertEqual(len(result),79)
        self.assertNotEqual(result[-1].stamp,rows[-1][0])

    def test_future_close_does_not_change_previous_signal(self):
        data=synthetic();original=signal(data,100)
        last=data[-1];data[-1]=Candle(last.stamp,100000,100001,99999,100000,10)
        self.assertEqual(signal(data,100),original)

    def test_reject_duplicate_stamps(self):
        data=synthetic();data[-1]=data[-2]
        with self.assertRaises(ValueError):backtest(data)

    def test_reject_bad_ohlc(self):
        rows=[[c.stamp,'1','0.5','0.4','0.7','0','100','1'] for c in synthetic(80)]
        with self.assertRaises(ValueError):parse_kraken({'error':[],'result':{'XXBTZEUR':rows,'last':999}})

    def test_parse_top20(self):
        parsed=parse_leaders(leaders())
        self.assertEqual(len(parsed),20)
        self.assertEqual(parsed[0]['rank'],1)

    def test_provider_rank_gaps_preserved_without_filling_missing_coins(self):
        data=leaders()
        # The endpoint may skip rank 7 while returning exactly 20 ordered assets.
        for row in data[6:]:
            row['market_cap_rank'] += 1
        parsed=parse_leaders(data)
        self.assertEqual(len(parsed),20)
        self.assertEqual(parsed[6]['rank'],8)
        self.assertEqual(parsed[-1]['rank'],21)
        self.assertEqual([row['id'] for row in parsed],
                         [row['id'] for row in data])

    def test_duplicate_or_reordered_provider_ranks_still_rejected(self):
        data=leaders()
        data[5]['market_cap_rank']=5
        with self.assertRaises(ValueError):parse_leaders(data)
        data=leaders()
        data[5]['market_cap_rank']=True
        with self.assertRaises(ValueError):parse_leaders(data)
        data=leaders()
        data[5]['market_cap_rank']=0
        with self.assertRaises(ValueError):parse_leaders(data)

    def test_incomplete_or_invalid_top20_fails_closed(self):
        for values in (leaders()[:19],leaders()+leaders()[:1]):
            with self.assertRaises(ValueError):parse_leaders(values)
        bad=leaders();bad[2]['id']=bad[0]['id']
        with self.assertRaises(ValueError):parse_leaders(bad)

    def test_kraken_resolution_with_duplicate_markets_removed(self):
        raw={'error':[],'result':{
            'XBTZEUR':{'wsname':'XBT/EUR','status':'online'},
            'ETHEUR':{'wsname':'ETH/EUR'},
            'ETHZEUR2':{'wsname':'ETH/EUR'},
            'ETHUSD':{'wsname':'ETH/USD'},
            'SOLZEUR':{'wsname':'SOL/EUR','status':'cancel_only'}}}
        resolved=parse_kraken_pairs(raw)
        self.assertEqual(resolved,{'XBT':'XBTZEUR'})

    def test_unmapped_stablecoins_still_in_top20(self):
        data=leaders();data[0].update({'id':'bitcoin','symbol':'btc'})
        data[1].update({'id':'tether','symbol':'usdt'})
        combined=combine(parse_leaders(data),{'XBT':'XBTZEUR','USDT':'USDTZEUR'})
        self.assertEqual(len(combined['universe']),20)
        self.assertEqual(combined['universe'][0]['kraken_pair'],'XBTZEUR')
        self.assertEqual(combined['universe'][1]['status'],'stablecoin_excluded_from_trading')
        self.assertEqual(combined['universe'][2]['status'],'unmapped_asset')

    def test_market_report_retains_all_leaders_on_missing_candles(self):
        data=leaders();data[0].update({'id':'bitcoin','symbol':'btc'})
        snap=combine(parse_leaders(data),{'XBT':'XBTZEUR'})
        with patch('universe.discover',return_value=snap),patch.object(bot,'fetch_daily',side_effect=ValueError('Unavailable')):
            report=bot.market_report()
        self.assertEqual(len(report['universe']),20)
        self.assertEqual(report['counts']['analyzed'],0)
        self.assertEqual(report['universe'][0]['status'],'data_unavailable')

    def test_no_private_order_code_or_secrets(self):
        text='\n'.join(p.read_text() for p in (Path(__file__).resolve().parents[1]/'src').glob('*.py'))
        self.assertNotIn('/private/AddOrder',text)
        self.assertNotIn('API_KEY',text)
        self.assertNotIn('api_secret',text)
        self.assertNotIn('place_order',text)

if __name__=='__main__':unittest.main()
