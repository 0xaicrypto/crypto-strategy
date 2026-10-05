import type {
  AssetMarketData,
  L2ProtocolMetrics,
  TokenomicsData,
  AltcoinEvaluation,
} from '../types/index.ts';
import { STRATEGY_CONFIG } from '../config/index.ts';

export function evaluateAltcoin(
  market: AssetMarketData,
  tokenomics: TokenomicsData,
  l2Metrics?: L2ProtocolMetrics
): AltcoinEvaluation {
  const symbol = market.symbol.toUpperCase();
  const riskWarnings: string[] = [];
  const triggersForEntry: string[] = [];

  // ==========================================
  // 1. Dilution Risk Score (0 = safe, 100 = dangerous)
  // ==========================================
  let dilutionScore = 0;

  // Factor A: Float ratio penalty (circulating / total)
  if (tokenomics.floatRatio < 0.25) {
    dilutionScore += 45;
    riskWarnings.push(`极低流通率警告：当前流通盘仅占总量的 ${(tokenomics.floatRatio * 100).toFixed(1)}%，未来大量锁定代币将陆续释放。`);
  } else if (tokenomics.floatRatio < 0.50) {
    dilutionScore += 25;
    riskWarnings.push(`流通率一般：当前流通盘占比 ${(tokenomics.floatRatio * 100).toFixed(1)}%，仍有较多解锁抛压。`);
  } else {
    dilutionScore += 5;
  }

  // Factor B: Monthly unlock inflation rate
  const monthlyUnlockPct = tokenomics.estimatedMonthlyUnlockPct * 100;
  if (monthlyUnlockPct >= 2.5) {
    dilutionScore += 40;
    riskWarnings.push(`结构性月度抛压高危：每月新增解锁约占当前流通盘的 ${monthlyUnlockPct.toFixed(1)}%，需要极高买盘承接。`);
  } else if (monthlyUnlockPct >= 1.0) {
    dilutionScore += 20;
    riskWarnings.push(`月度抛压适中：每月解锁约占流通盘的 ${monthlyUnlockPct.toFixed(1)}%。`);
  }

  // Factor C: FDV to Market Cap multiple
  const fdvMultiple = tokenomics.marketCap > 0 ? tokenomics.fdv / tokenomics.marketCap : 1;
  if (fdvMultiple > 3.5) {
    dilutionScore += 15;
    riskWarnings.push(`高 FDV 溢价：总估值（FDV $${(tokenomics.fdv / 1e9).toFixed(2)}B）为流通市值（$${(tokenomics.marketCap / 1e9).toFixed(2)}B）的 ${fdvMultiple.toFixed(1)} 倍。`);
  }

  const finalDilutionScore = Math.min(100, dilutionScore);

  // ==========================================
  // 2. Ecosystem Traction Score (0 = poor, 100 = strong)
  // ==========================================
  let ecosystemScore = 50; // base
  if (l2Metrics) {
    // TVL volume
    if (l2Metrics.tvl > 1e9) ecosystemScore += 25; // > $1B TVL
    else if (l2Metrics.tvl > 2e8) ecosystemScore += 10; // > $200M TVL
    else ecosystemScore -= 15;

    // 30-day TVL momentum
    if (l2Metrics.tvlChange30dPct > 10) ecosystemScore += 15;
    else if (l2Metrics.tvlChange30dPct < -5) ecosystemScore -= 15;

    // Revenue / Fees
    if (l2Metrics.fees30d > 1e6) ecosystemScore += 10;
  }
  const finalEcosystemScore = Math.max(0, Math.min(100, ecosystemScore));

  // ==========================================
  // 3. Relative Valuation Score (0 = overpriced, 100 = undervalued)
  // ==========================================
  let valuationScore = 50;
  if (l2Metrics && l2Metrics.tvl > 0) {
    const fdvToTvl = l2Metrics.fdvToTvlRatio;
    if (fdvToTvl > STRATEGY_CONFIG.altcoinThresholds.maxFdvToTvlRatio) {
      valuationScore -= 30;
      riskWarnings.push(`相对估值偏贵：FDV / TVL 比率高达 ${fdvToTvl.toFixed(1)}x（高于安全门槛 ${STRATEGY_CONFIG.altcoinThresholds.maxFdvToTvlRatio}x）。`);
    } else if (fdvToTvl < 4.0) {
      valuationScore += 30; // very cheap vs TVL (like Arbitrum)
    }
  }
  const finalValuationScore = Math.max(0, Math.min(100, valuationScore));

  // ==========================================
  // 4. Composite Health Score & Verdict
  // ==========================================
  // Weighted: 45% Dilution Health (100 - Dilution), 30% Ecosystem, 25% Valuation
  const compositeHealth =
    (100 - finalDilutionScore) * 0.45 +
    finalEcosystemScore * 0.30 +
    finalValuationScore * 0.25;

  const compositeHealthScore = Math.round(compositeHealth);

  // Verdict & Portfolio Cap Rules
  let verdict: AltcoinEvaluation['verdict'];
  let maxCap = STRATEGY_CONFIG.allocationCaps.singleAltcoinMax;
  let dcaAllowed = false;

  if (symbol === 'STRK') {
    maxCap = STRATEGY_CONFIG.altcoinThresholds.strkHardCapPortfolioPct; // Hard cap 3%
  }

  if (finalDilutionScore >= 75) {
    // Heavy dilution risk overrides
    verdict = compositeHealthScore < 40 ? 'AVOID' : 'WATCH';
    dcaAllowed = false;
    triggersForEntry.push('需等待代币解锁进入平缓期（或流通率超过 40%）。');
    triggersForEntry.push('STRK/ETH 汇率对需在周线级别确认突破并站稳 50 日均线（确认止跌）。');
    triggersForEntry.push('链上 TVL 或真实应用日活出现连续 2 个月 >20% 的实质性净流入。');
  } else if (compositeHealthScore >= 65) {
    verdict = 'ACCUMULATE_NORMAL';
    dcaAllowed = true;
    triggersForEntry.push('当前估值与基本面匹配良好，可分配轻仓额度执行右侧定投。');
  } else if (compositeHealthScore >= 45) {
    verdict = 'ACCUMULATE_CONSERVATIVE';
    dcaAllowed = true;
    maxCap = maxCap * 0.5; // Halve the allowable cap
    triggersForEntry.push('仅建议极小仓位探索性参与，严守止损纪律。');
  } else {
    verdict = 'AVOID';
    dcaAllowed = false;
    triggersForEntry.push('综合性价比偏低，建议将配置额度优先留给 BTC 或大盘核心资产。');
  }

  return {
    symbol,
    name: market.name,
    currentPrice: market.currentPrice,
    dilutionRiskScore: finalDilutionScore,
    ecosystemTractionScore: finalEcosystemScore,
    relativeValuationScore: finalValuationScore,
    compositeHealthScore,
    verdict,
    maxPortfolioCapPct: maxCap,
    dcaAllowed,
    triggersForEntry,
    riskWarnings,
  };
}
