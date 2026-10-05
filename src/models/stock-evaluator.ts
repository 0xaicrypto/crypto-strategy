import type { LiveStockData, StockEvaluation } from '../types/stocks.ts';

export function evaluateStock(stock: LiveStockData): StockEvaluation {
  // 1. Anti-Dilution & Buyback Quality Score (0 to 100)
  // Evaluates Net Buyback Yield = Buyback Yield (%) - SBC Dilution Rate (%)
  // Normal range: -3% to +4%. +3% or more net destruction gets 95+.
  let antiDilutionScore = 50;
  const netRate = stock.netAntiDilutionYieldPct;
  if (netRate >= 3.0) {
    antiDilutionScore = 95;
  } else if (netRate >= 1.5) {
    antiDilutionScore = 80 + Math.round((netRate - 1.5) * 10);
  } else if (netRate >= 0.0) {
    antiDilutionScore = 65 + Math.round(netRate * 10);
  } else if (netRate >= -1.5) {
    antiDilutionScore = 45 + Math.round(netRate * 10);
  } else {
    antiDilutionScore = Math.max(15, 30 + Math.round(netRate * 5));
  }

  // 2. Cash Flow & Profitability Quality Score (0 to 100)
  // Combines FCF Yield (3%~5% is great for big tech) and Gross Margin
  let cashFlowQualityScore = 50;
  const fcfPoints = Math.min(45, Math.max(0, stock.fcfYieldPct * 10)); // 4% FCF yield = 40 pts
  const marginPoints = Math.min(35, (stock.grossMarginPct / 100) * 45); // 75% margin = 33 pts
  const growthPoints = Math.min(20, Math.max(0, stock.revenueGrowthYoY * 0.3));
  cashFlowQualityScore = Math.round(Math.min(100, Math.max(20, fcfPoints + marginPoints + growthPoints)));

  // 3. Valuation & Momentum Score (0 to 100)
  // PEG < 1.5 is attractive; Price / 200D MA between 0.95 and 1.15 is healthy accumulation
  let valuationScore = 50;
  if (stock.pegRatio <= 1.2 && stock.pegRatio > 0) {
    valuationScore += 25;
  } else if (stock.pegRatio <= 2.0 && stock.pegRatio > 0) {
    valuationScore += 10;
  } else if (stock.pegRatio > 3.0 || stock.pegRatio < 0) {
    valuationScore -= 20;
  }

  if (stock.ratioTo200d < 0.98) {
    valuationScore += 20; // Discounted below 200D MA
  } else if (stock.ratioTo200d <= 1.15) {
    valuationScore += 10; // Healthy uptrend
  } else if (stock.ratioTo200d > 1.30) {
    valuationScore -= 20; // Overextended above 200D MA
  }
  valuationScore = Math.max(20, Math.min(95, valuationScore));

  // 4. Composite Health Score
  const compositeHealthScore = Math.round(
    antiDilutionScore * 0.35 + cashFlowQualityScore * 0.35 + valuationScore * 0.30
  );

  // 5. Verdict & Signals
  let verdict: 'STRONG_ACCUMULATE' | 'ACCUMULATE' | 'HOLD' | 'TRIM' = 'ACCUMULATE';
  let dcaAllowed = true;

  if (compositeHealthScore >= 80 && stock.ratioTo200d <= 1.20) {
    verdict = 'STRONG_ACCUMULATE';
  } else if (compositeHealthScore >= 65 && stock.ratioTo200d <= 1.25) {
    verdict = 'ACCUMULATE';
  } else if (compositeHealthScore < 50 || stock.ratioTo200d > 1.35) {
    verdict = 'HOLD';
    dcaAllowed = false;
  } else if (stock.ratioTo200d > 1.45) {
    verdict = 'TRIM';
    dcaAllowed = false;
  }

  // 6. Strengths, Warnings, and Triggers
  const keyStrengths: string[] = [];
  const riskWarnings: string[] = [];
  const triggersForEntry: string[] = [];

  if (stock.netAntiDilutionYieldPct >= 1.5) {
    keyStrengths.push(`净回购通缩率 +${stock.netAntiDilutionYieldPct}% (年回购 ${stock.buybackYieldPct}% 远超 SBC 稀释)`);
  }
  if (stock.grossMarginPct >= 65) {
    keyStrengths.push(`超高毛利率 ${stock.grossMarginPct}%，拥有不可替代的垄断级行业护城河`);
  }
  if (stock.fcfYieldPct >= 3.5) {
    keyStrengths.push(`自由现金流收益率达 ${stock.fcfYieldPct}%，现金造血机器`);
  }

  if (stock.sbcDilutionRatePct > stock.buybackYieldPct) {
    riskWarnings.push(`股权激励稀释率 (${stock.sbcDilutionRatePct}%) 超过回购注销率，股本呈现内生膨胀`);
  }
  if (stock.ratioTo200d > 1.25) {
    riskWarnings.push(`股价较 200 日牛熊线溢价偏高 (${stock.ratioTo200d}x)，短期动量过热`);
  }
  if (stock.pegRatio > 2.5) {
    riskWarnings.push(`PEG 偏高 (${stock.pegRatio})，当前估值对未来增长预期透支较多`);
  }

  if (stock.ratioTo200d <= 1.05) {
    triggersForEntry.push('回踩 200 日线关键支撑位，适合左侧底仓配置');
  }
  if (stock.fcfYieldPct >= 3.0) {
    triggersForEntry.push('现金流收益率提供充足安全边际');
  }

  // Fallback defaults
  if (keyStrengths.length === 0) keyStrengths.push('核心指数或大盘代表性权重资产');
  if (triggersForEntry.length === 0) triggersForEntry.push('按周期乘数严格分批执行');

  let maxPortfolioCapPct = 0.10;
  if (stock.category === 'INDEX') maxPortfolioCapPct = 0.35;
  if (stock.category === 'CRYPTO_PROXY') maxPortfolioCapPct = 0.05;

  return {
    symbol: stock.symbol,
    name: stock.name,
    category: stock.category,
    sector: stock.sector,
    currentPrice: stock.currentPrice,
    change24hPct: stock.change24hPct,
    ma200d: stock.ma200d,
    ratioTo200d: stock.ratioTo200d,
    buybackYieldPct: stock.buybackYieldPct,
    sbcDilutionRatePct: stock.sbcDilutionRatePct,
    netAntiDilutionYieldPct: stock.netAntiDilutionYieldPct,
    fcfYieldPct: stock.fcfYieldPct,
    grossMarginPct: stock.grossMarginPct,
    pegRatio: stock.pegRatio,
    forwardPe: stock.forwardPe,
    ttmPe: stock.ttmPe,
    antiDilutionScore,
    cashFlowQualityScore,
    valuationScore,
    compositeHealthScore,
    verdict,
    dcaAllowed,
    maxPortfolioCapPct,
    keyStrengths,
    riskWarnings,
    triggersForEntry,
  };
}
