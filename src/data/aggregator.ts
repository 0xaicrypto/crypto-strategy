import type { AssetMarketData, SentimentData, L2ProtocolMetrics, TokenomicsData } from '../types/index.ts';
import { getActiveAssets } from '../config/assets.ts';
import { fetchFearAndGreed } from './sentiment.ts';
import { fetchMarketData, fetchHistoricalDailyPrices, calculateMovingAverages, calculateWeeklyRsi } from './coingecko.ts';
import { fetchL2ChainMetrics } from './defillama.ts';
import { getTokenomics } from './tokenomics.ts';

export interface ComprehensiveMarketSnapshot {
  timestamp: number;
  sentiment: SentimentData;
  marketData: Map<string, AssetMarketData>;
  btcMovingAverages: { ma200w: number; ma200d: number };
  btcRsiWeekly: number;
  l2Metrics: Map<string, L2ProtocolMetrics>;
  tokenomics: Map<string, TokenomicsData>;
}

export async function collectComprehensiveSnapshot(): Promise<ComprehensiveMarketSnapshot> {
  const activeAssets = getActiveAssets();
  const coinIds = Array.from(new Set(activeAssets.map((a) => a.coingeckoId)));

  console.log(`🔄 Collecting multi-source data for ${activeAssets.length} active assets (${activeAssets.map((a) => a.symbol).join(', ')})...`);

  // 1. Fetch sentiment, market prices, and BTC history in parallel
  const [sentiment, marketData, btcHistory] = await Promise.all([
    fetchFearAndGreed(),
    fetchMarketData(coinIds),
    fetchHistoricalDailyPrices('bitcoin', 1400),
  ]);

  // 2. Compute Technical Indicators for BTC
  const btcMovingAverages = calculateMovingAverages(btcHistory);
  const btcRsiWeekly = calculateWeeklyRsi(btcHistory, 14);

  // 3. Dynamically collect chain / L2 metrics for assets with chainName
  const l2Metrics = new Map<string, L2ProtocolMetrics>();
  const chainPromises = activeAssets
    .filter((a) => !!a.chainName)
    .map(async (asset) => {
      const market = marketData.get(asset.symbol);
      const metrics = await fetchL2ChainMetrics(
        asset.chainName!,
        market?.marketCap ?? 500000000,
        market?.fdv ?? 2000000000
      );
      l2Metrics.set(asset.symbol, metrics);
    });

  await Promise.all(chainPromises);

  // 4. Collect Tokenomics Data for all active assets
  const tokenomics = new Map<string, TokenomicsData>();
  for (const asset of activeAssets) {
    const market = marketData.get(asset.symbol);
    tokenomics.set(asset.symbol, getTokenomics(asset.symbol, market?.marketCap, market?.fdv));
  }

  console.log('✅ Multi-source data snapshot collected successfully.');

  return {
    timestamp: Date.now(),
    sentiment,
    marketData,
    btcMovingAverages,
    btcRsiWeekly,
    l2Metrics,
    tokenomics,
  };
}
