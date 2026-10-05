import type {
  CycleMetrics,
  AltcoinEvaluation,
  PortfolioTargetAllocation,
} from '../types/index.ts';
import { STRATEGY_CONFIG } from '../config/index.ts';

export interface AllocationPlan {
  periodDcaBudgetUsd: number;
  allocations: {
    symbol: string;
    action: 'BUY' | 'HOLD' | 'SELL';
    amountUsd: number;
    weightPct: number;
    rationale: string;
  }[];
  targetPortfolioWeights: PortfolioTargetAllocation;
}

export function computeAllocationPlan(
  cycle: CycleMetrics,
  altcoinEvaluations: AltcoinEvaluation[],
  currentHoldingsUsd: { btc: number; eth: number; alts: Record<string, number>; cash: number }
): AllocationPlan {
  const cfg = STRATEGY_CONFIG;
  const baseDca = cfg.baseDcaAmountUsd;
  const multiplier = cycle.dcaMultiplier;
  const periodDcaBudgetUsd = Math.round(baseDca * multiplier);

  const totalPortfolioValue =
    currentHoldingsUsd.btc +
    currentHoldingsUsd.eth +
    Object.values(currentHoldingsUsd.alts).reduce((a, b) => a + b, 0) +
    currentHoldingsUsd.cash;

  const allocations: AllocationPlan['allocations'] = [];
  const targetWeights: PortfolioTargetAllocation = {
    btc: 0.70,
    eth: 0.20,
    alts: {},
    cashOrStablecoins: 0.10,
    rebalanceNotes: [],
  };

  // Determine Target Allocations Based on Cycle Regime
  switch (cycle.regime) {
    case 'CAPITULATION':
      targetWeights.btc = 0.75;
      targetWeights.eth = 0.20;
      targetWeights.cashOrStablecoins = 0.05;
      targetWeights.rebalanceNotes.push('深熊冰点：优先囤积 BTC 与少量 ETH，暂时规避大部分中小山寨币。');
      break;

    case 'ACCUMULATION':
      targetWeights.btc = 0.65;
      targetWeights.eth = 0.25;
      targetWeights.cashOrStablecoins = 0.10;
      targetWeights.rebalanceNotes.push('稳步积累：保持 BTC/ETH 高底仓，对通过安全审计的高性价比山寨币小额定投。');
      break;

    case 'MARKUP':
      targetWeights.btc = 0.50;
      targetWeights.eth = 0.25;
      targetWeights.cashOrStablecoins = 0.15;
      targetWeights.rebalanceNotes.push('主升浪：享受持仓增值，停止大额补仓，适当扩大现金与主流币防守仓位。');
      break;

    case 'DISTRIBUTION':
      targetWeights.btc = 0.25;
      targetWeights.eth = 0.10;
      targetWeights.cashOrStablecoins = 0.65;
      targetWeights.rebalanceNotes.push('泡沫分发期：强制执行阶梯止盈，现金/稳定币仓位目标提升至 65% 以上。');
      break;
  }

  // Handle Altcoins (e.g. STRK)
  let allowedAltsDcaBudget = 0;
  for (const alt of altcoinEvaluations) {
    const currentAltVal = currentHoldingsUsd.alts[alt.symbol] ?? 0;
    const currentAltPct = totalPortfolioValue > 0 ? currentAltVal / totalPortfolioValue : 0;

    targetWeights.alts[alt.symbol] = alt.maxPortfolioCapPct;

    if (!alt.dcaAllowed) {
      allocations.push({
        symbol: alt.symbol,
        action: 'HOLD',
        amountUsd: 0,
        weightPct: Math.round(currentAltPct * 1000) / 10,
        rationale: `AI 评估为 [${alt.verdict}]，稀释风险 (${alt.dilutionRiskScore}/100) 偏高，暂不分配新定投额度。`,
      });
    } else if (currentAltPct >= alt.maxPortfolioCapPct) {
      allocations.push({
        symbol: alt.symbol,
        action: 'HOLD',
        amountUsd: 0,
        weightPct: Math.round(currentAltPct * 1000) / 10,
        rationale: `持仓占比 (${(currentAltPct * 100).toFixed(1)}%) 已达风控上限 (${(alt.maxPortfolioCapPct * 100).toFixed(1)}%)，暂停加仓。`,
      });
    } else {
      // Allocate small portion (e.g. 10% of total DCA budget)
      const altAllocation = Math.min(periodDcaBudgetUsd * 0.10, 100);
      allowedAltsDcaBudget += altAllocation;
      allocations.push({
        symbol: alt.symbol,
        action: 'BUY',
        amountUsd: Math.round(altAllocation),
        weightPct: Math.round(currentAltPct * 1000) / 10,
        rationale: `满足右侧探索条件，分配 ${(altAllocation / periodDcaBudgetUsd * 100).toFixed(0)}% 探索预算。`,
      });
    }
  }

  // Handle Core Buying / Selling Allocations
  if (cycle.signal === 'SCALE_OUT' || cycle.signal === 'EXIT') {
    // Sell fraction of holdings to take profit
    const sellRatio = cycle.signal === 'EXIT' ? 0.35 : 0.15;
    allocations.unshift(
      {
        symbol: 'BTC',
        action: 'SELL',
        amountUsd: Math.round(currentHoldingsUsd.btc * sellRatio),
        weightPct: 0,
        rationale: `周期温度 (${cycle.temperatureScore}) 处于高估狂热区，逆向定抛 ${Math.round(sellRatio * 100)}% 现货兑现为稳定币。`,
      },
      {
        symbol: 'ETH',
        action: 'SELL',
        amountUsd: Math.round(currentHoldingsUsd.eth * sellRatio),
        weightPct: 0,
        rationale: `同步按 ${Math.round(sellRatio * 100)}% 比例止盈锁定利润。`,
      }
    );
  } else if (periodDcaBudgetUsd > 0) {
    const remainingDca = Math.max(0, periodDcaBudgetUsd - allowedAltsDcaBudget);
    const btcDca = Math.round(remainingDca * 0.75);
    const ethDca = Math.round(remainingDca * 0.25);

    allocations.unshift(
      {
        symbol: 'BTC',
        action: 'BUY',
        amountUsd: btcDca,
        weightPct: 75,
        rationale: `核心底仓资产，动态乘数 ${multiplier}x，本期分配 $${btcDca}。`,
      },
      {
        symbol: 'ETH',
        action: 'BUY',
        amountUsd: ethDca,
        weightPct: 25,
        rationale: `次级核心资产，本期分配 $${ethDca}。`,
      }
    );
  } else {
    allocations.unshift({
      symbol: 'BTC/ETH',
      action: 'HOLD',
      amountUsd: 0,
      weightPct: 0,
      rationale: '当前周期处于中性持有区间（乘数 0x），保留定投弹药在理财账户，静待下一阶段。',
    });
  }

  return {
    periodDcaBudgetUsd,
    allocations,
    targetPortfolioWeights: targetWeights,
  };
}
