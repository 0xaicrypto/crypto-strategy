import type { MacroRatesData, StockEvaluation, CrossAssetPlan, CrossAssetPortfolioWeights } from '../types/stocks.ts';
import type { CycleMetrics, AltcoinEvaluation } from '../types/index.ts';

export function computeCrossAssetPlan(
  cryptoCycle: CycleMetrics,
  macroRates: MacroRatesData,
  stockEvaluations: StockEvaluation[],
  altEvaluations: AltcoinEvaluation[],
  baseWeeklyBudgetUsd = 1000
): CrossAssetPlan {
  const equityMultiplier = macroRates.equityDcaMultiplier;
  const cryptoMultiplier = cryptoCycle.dcaMultiplier;

  // Base institutional allocation model:
  // 55% Equities Core, 25% Crypto Core, 5% High-Beta Alts, 15% Cash/Short-term TBills
  const targetWeights: CrossAssetPortfolioWeights = {
    usEquitiesCore: 0.55,
    cryptoCore: 0.25,
    tacticalAltsAndTech: 0.05,
    cashAndTbills: 0.15,
  };

  // Dynamically shift weights based on relative regime
  if (macroRates.macroRegime === 'DEEP_VALUE' && cryptoCycle.temperatureScore > 60) {
    // Equities deeply discounted while crypto is heated -> shift 10% from crypto to equities
    targetWeights.usEquitiesCore = 0.65;
    targetWeights.cryptoCore = 0.15;
    targetWeights.cashAndTbills = 0.15;
    targetWeights.tacticalAltsAndTech = 0.05;
  } else if (cryptoCycle.temperatureScore < 25 && macroRates.macroRegime !== 'DEEP_VALUE') {
    // Crypto capitulation bottom -> shift 10% from cash and equities to crypto
    targetWeights.cryptoCore = 0.35;
    targetWeights.usEquitiesCore = 0.50;
    targetWeights.cashAndTbills = 0.10;
    targetWeights.tacticalAltsAndTech = 0.05;
  }

  // Calculate actual period dollar budgets
  const equityBudget = baseWeeklyBudgetUsd * targetWeights.usEquitiesCore * equityMultiplier;
  const cryptoBudget = baseWeeklyBudgetUsd * targetWeights.cryptoCore * cryptoMultiplier;
  const tacticalBudget = baseWeeklyBudgetUsd * targetWeights.tacticalAltsAndTech * Math.min(equityMultiplier, cryptoMultiplier);
  const totalPeriodBudget = Math.round(equityBudget + cryptoBudget + tacticalBudget);

  // Generate Equity Allocations
  const eligibleStocks = stockEvaluations.filter((s) => s.dcaAllowed);
  const equityAllocations = [];
  const stockWeightSum = eligibleStocks.reduce((sum, s) => sum + s.compositeHealthScore, 0);

  for (const s of eligibleStocks) {
    const rawWeight = s.compositeHealthScore / (stockWeightSum || 1);
    const amountUsd = Math.round(equityBudget * rawWeight);
    equityAllocations.push({
      symbol: s.symbol,
      name: s.name,
      action: s.verdict.startsWith('STRONG') || s.verdict === 'ACCUMULATE' ? ('BUY' as const) : ('HOLD' as const),
      amountUsd,
      weightPct: Number((rawWeight * targetWeights.usEquitiesCore * 100).toFixed(1)),
      rationale: `${s.verdict}: 抗稀释得分 ${s.antiDilutionScore}/100, 200日线倍数 ${s.ratioTo200d}x`,
    });
  }

  // Generate Crypto Allocations
  const cryptoAllocations = [
    {
      symbol: 'BTC',
      action: cryptoCycle.signal === 'EXIT' ? ('SELL' as const) : ('BUY' as const),
      amountUsd: Math.round(cryptoBudget * 0.70),
      weightPct: Number((targetWeights.cryptoCore * 0.70 * 100).toFixed(1)),
      rationale: `宏观周期温度计 ${cryptoCycle.temperatureScore}/100, 乘数 ${cryptoCycle.dcaMultiplier}x`,
    },
    {
      symbol: 'ETH',
      action: cryptoCycle.signal === 'EXIT' ? ('SELL' as const) : ('BUY' as const),
      amountUsd: Math.round(cryptoBudget * 0.30),
      weightPct: Number((targetWeights.cryptoCore * 0.30 * 100).toFixed(1)),
      rationale: `大盘次核心资产, 动态乘数同步基准`,
    },
  ];

  return {
    periodBudgetUsd: totalPeriodBudget,
    equityMultiplier,
    cryptoMultiplier,
    targetPortfolioWeights: targetWeights,
    equityAllocations,
    cryptoAllocations,
  };
}
