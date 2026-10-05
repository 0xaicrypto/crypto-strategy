export type StockCategory = 'INDEX' | 'TECH_GROWTH' | 'CRYPTO_PROXY' | 'DEFENSIVE_CASH';

export interface StockAssetConfig {
  symbol: string;
  name: string;
  category: StockCategory;
  sector: string;
  description: string;
  maxPortfolioCapPct: number;
  baseWeightPct: number;
  // Fundamental baseline metrics (updated with quarterly filings)
  ttmPe: number;
  forwardPe: number;
  pegRatio: number;
  fcfYieldPct: number; // Free cash flow yield
  buybackYieldPct: number; // Annualized net share buyback rate
  sbcDilutionRatePct: number; // Stock-based compensation share dilution rate
  grossMarginPct: number;
  revenueGrowthYoY: number;
}

export interface LiveStockData {
  symbol: string;
  name: string;
  category: StockCategory;
  sector: string;
  currentPrice: number;
  change24hPct: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  drawdownFromHighPct: number;
  ma200d: number;
  ratioTo200d: number;
  ttmPe: number;
  forwardPe: number;
  fcfYieldPct: number;
  buybackYieldPct: number;
  sbcDilutionRatePct: number;
  netAntiDilutionYieldPct: number; // buybackYieldPct - sbcDilutionRatePct
  pegRatio: number;
  grossMarginPct: number;
  revenueGrowthYoY: number;
}

export interface MacroRatesData {
  timestamp: number;
  us10yYield: number; // e.g. 4.25%
  us2yYield: number;
  yieldCurveSpread: number; // 10Y - 2Y
  vixIndex: number; // e.g. 15.5
  sp500Pe: number;
  sp500EarningsYield: number; // 1 / sp500Pe
  equityRiskPremiumPct: number; // sp500EarningsYield - us10yYield
  macroRegime: 'DEEP_VALUE' | 'FAIR_VALUE' | 'RICH_VALUATION' | 'EUPHORIC_BUBBLE';
  equityDcaMultiplier: number;
  summary: string;
}

export interface StockEvaluation {
  symbol: string;
  name: string;
  category: StockCategory;
  sector?: string;
  currentPrice: number;
  change24hPct: number;
  ma200d: number;
  ratioTo200d: number;
  buybackYieldPct: number;
  sbcDilutionRatePct: number;
  netAntiDilutionYieldPct: number;
  fcfYieldPct: number;
  grossMarginPct: number;
  pegRatio: number;
  forwardPe: number;
  ttmPe: number;
  antiDilutionScore: number; // 0 - 100 (high = strong net share destruction)
  cashFlowQualityScore: number; // 0 - 100 (high = resilient FCF & margins)
  valuationScore: number; // 0 - 100 (high = attractive PEG & earnings yield)
  compositeHealthScore: number; // 0 - 100
  verdict: 'STRONG_ACCUMULATE' | 'ACCUMULATE' | 'HOLD' | 'TRIM';
  dcaAllowed: boolean;
  maxPortfolioCapPct: number;
  keyStrengths: string[];
  riskWarnings: string[];
  triggersForEntry: string[];
}

export interface CrossAssetPortfolioWeights {
  usEquitiesCore: number; // e.g. 50%
  cryptoCore: number; // e.g. 25%
  tacticalAltsAndTech: number; // e.g. 10%
  cashAndTbills: number; // e.g. 15%
}

export interface CrossAssetPlan {
  periodBudgetUsd: number;
  equityMultiplier: number;
  cryptoMultiplier: number;
  targetPortfolioWeights: CrossAssetPortfolioWeights;
  equityAllocations: Array<{
    symbol: string;
    name: string;
    action: 'BUY' | 'HOLD' | 'SELL';
    amountUsd: number;
    weightPct: number;
    rationale: string;
  }>;
  cryptoAllocations: Array<{
    symbol: string;
    action: 'BUY' | 'HOLD' | 'SELL';
    amountUsd: number;
    weightPct: number;
    rationale: string;
  }>;
}
