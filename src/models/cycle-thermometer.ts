import type { CycleMetrics, MarketRegime, ActionSignal } from '../types/index.ts';
import { STRATEGY_CONFIG } from '../config/index.ts';

export interface CycleInputData {
  btcPrice: number;
  ma200w: number;
  ma200d: number;
  weeklyRsi: number;
  fearAndGreed: number;
}

export function computeCycleTemperature(input: CycleInputData): CycleMetrics {
  const { btcPrice, ma200w, ma200d, weeklyRsi, fearAndGreed } = input;

  // 1. Ratio to 200-Week MA (Weight: 30%)
  // Historically: <=1.0x is extreme bear (score ~10), 1.5x is neutral (~45), >=3.8x is bubble (~95)
  const ratio200w = ma200w > 0 ? btcPrice / ma200w : 1.5;
  const score200w = normalizeRatio(ratio200w, 0.8, 4.0);

  // 2. Ratio to 200-Day MA (Weight: 20%)
  // Historically: <=0.8x is oversold (~15), 1.0x is fair (~50), >=1.8x is overbought (~90)
  const ratio200d = ma200d > 0 ? btcPrice / ma200d : 1.0;
  const score200d = normalizeRatio(ratio200d, 0.7, 2.0);

  // 3. Fear & Greed Sentiment (Weight: 20%)
  // 0 - 100 direct mapping
  const scoreSentiment = Math.max(0, Math.min(100, fearAndGreed));

  // 4. Weekly RSI (Weight: 15%)
  // RSI < 35 is deep bear (~15), RSI > 80 is blow-off top (~90)
  const scoreRsi = normalizeRatio(weeklyRsi, 30, 85);

  // 5. MVRV Z-Score Proxy (Weight: 15%)
  // Approximated by multi-horizon cost-basis ratio
  const mvrvProxy = (ratio200w * 0.6) + (ratio200d * 0.4);
  const scoreMvrv = normalizeRatio(mvrvProxy, 0.8, 3.2);

  // Weighted Temperature Score
  const rawTemperature =
    score200w * 0.30 +
    score200d * 0.20 +
    scoreSentiment * 0.20 +
    scoreRsi * 0.15 +
    scoreMvrv * 0.15;

  const temperatureScore = Math.round(Math.max(0, Math.min(100, rawTemperature)));

  // Classify Regime
  let regime: MarketRegime;
  let signal: ActionSignal;
  let dcaMultiplier: number;
  let summary = '';

  const cfg = STRATEGY_CONFIG;

  if (temperatureScore <= cfg.cycleThresholds.capitulationMax) {
    regime = 'CAPITULATION';
    signal = 'AGGRESSIVE_BUY';
    dcaMultiplier = cfg.multipliers.deepCapitulation; // 2.5x
    summary = '极度冰点恐慌期。历史大周期底部区间，估值严重受挫，全力启动激进定投。';
  } else if (temperatureScore <= cfg.cycleThresholds.accumulationMax) {
    regime = 'ACCUMULATION';
    signal = 'REGULAR_BUY';
    dcaMultiplier = temperatureScore < 35 ? cfg.multipliers.accumulationHigh : cfg.multipliers.accumulationNormal;
    summary = '健康积累筑底期。价格在合理估值偏低区间，按计划进行标准/加量价值定投。';
  } else if (temperatureScore <= cfg.cycleThresholds.markupMax) {
    regime = 'MARKUP';
    signal = temperatureScore <= 60 ? 'REGULAR_BUY' : 'HOLD';
    dcaMultiplier = temperatureScore <= 60 ? cfg.multipliers.markupLow : cfg.multipliers.neutralHold;
    summary = temperatureScore <= 60
      ? '主升浪初期。价格步入公允区间，适度减少定投额度（0.5x）。'
      : '主升浪加速期。估值偏高，停止追加现货定投，保持持仓享受泡沫。';
  } else {
    regime = 'DISTRIBUTION';
    signal = temperatureScore >= 85 ? 'EXIT' : 'SCALE_OUT';
    dcaMultiplier = 0.0;
    summary = temperatureScore >= 85
      ? '极端泡沫狂热期。周期大顶高危区域，坚决执行激进阶梯止盈，大部分筹码兑现为稳定币。'
      : '情绪过热分发期。老鲸与早期机构加速出货，启动逆向定抛（阶梯止盈 15%~20%）。';
  }

  return {
    currentPrice: btcPrice,
    ma200w,
    ma200d,
    ratioTo200w: Math.round(ratio200w * 100) / 100,
    ratioTo200d: Math.round(ratio200d * 100) / 100,
    mvrvProxy: Math.round(mvrvProxy * 100) / 100,
    rsiWeekly: Math.round(weeklyRsi * 10) / 10,
    fearAndGreed,
    temperatureScore,
    regime,
    dcaMultiplier,
    signal,
    summary,
  };
}

function normalizeRatio(val: number, min: number, max: number): number {
  if (val <= min) return 5;
  if (val >= max) return 95;
  return Math.round(((val - min) / (max - min)) * 90 + 5);
}
