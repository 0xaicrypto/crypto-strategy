/**
 * Core Domain Types for AI Crypto Investment Strategy
 */

export type MarketRegime = 'CAPITULATION' | 'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION';

export type ActionSignal = 'AGGRESSIVE_BUY' | 'REGULAR_BUY' | 'HOLD' | 'SCALE_OUT' | 'EXIT';

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface AssetMarketData {
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  fdv: number;
  totalVolume24h: number;
  priceChangePercentage24h: number;
  priceChangePercentage7d: number;
  priceChangePercentage30d: number;
  historicalPrices: PricePoint[];
}

export interface SentimentData {
  value: number; // 0 to 100
  classification: string; // 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed'
  historicalAvg30d: number;
  historicalAvg90d: number;
}

export interface CycleMetrics {
  currentPrice: number;
  ma200w: number;
  ma200d: number;
  ratioTo200w: number; // price / ma200w
  ratioTo200d: number; // price / ma200d
  mvrvProxy: number;
  rsiWeekly: number;
  fearAndGreed: number;
  temperatureScore: number; // 0 to 100
  regime: MarketRegime;
  dcaMultiplier: number;
  signal: ActionSignal;
  summary: string;
}

export interface L2ProtocolMetrics {
  chain: string;
  tvl: number;
  tvlChange30dPct: number;
  fees30d: number;
  revenue30d: number;
  mcapToTvlRatio: number;
  fdvToTvlRatio: number;
}

export interface TokenomicsData {
  symbol: string;
  circulatingSupply: number;
  totalSupply: number;
  floatRatio: number; // circulating / total (e.g., 0.25 = 25%)
  fdv: number;
  marketCap: number;
  estimatedMonthlyUnlockPct: number; // monthly newly unlocked / circulating
  stakingRatio?: number; // % of circulating tokens currently staked
}

export interface AltcoinEvaluation {
  symbol: string;
  name: string;
  currentPrice: number;
  dilutionRiskScore: number; // 0 (safe) to 100 (extreme dilution risk)
  ecosystemTractionScore: number; // 0 (dead) to 100 (high traction)
  relativeValuationScore: number; // 0 (overpriced) to 100 (severely undervalued)
  compositeHealthScore: number; // 0 to 100
  verdict: 'AVOID' | 'WATCH' | 'ACCUMULATE_CONSERVATIVE' | 'ACCUMULATE_NORMAL' | 'TAKE_PROFIT';
  maxPortfolioCapPct: number; // e.g., 0.03 = 3% max
  dcaAllowed: boolean;
  triggersForEntry: string[];
  riskWarnings: string[];
}

export interface PortfolioTargetAllocation {
  btc: number;
  eth: number;
  alts: Record<string, number>;
  cashOrStablecoins: number;
  rebalanceNotes: string[];
}

export interface BacktestResult {
  periodDays: number;
  totalInvestedNaive: number;
  finalValueNaive: number;
  roiNaivePct: number;
  totalInvestedDynamic: number;
  finalValueDynamic: number;
  roiDynamicPct: number;
  outperformancePct: number;
  cashRemainingInReserve: number;
}

export * from './stocks.ts';
