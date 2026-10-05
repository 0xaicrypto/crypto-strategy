import type { BacktestResult, PricePoint } from '../types/index.ts';
import { computeCycleTemperature } from '../models/cycle-thermometer.ts';
import { STRATEGY_CONFIG } from '../config/index.ts';

export function runDcaBacktest(historicalPrices: PricePoint[], baseWeeklyUsd: number = 500): BacktestResult {
  if (historicalPrices.length < 200) {
    throw new Error('Not enough historical bars for meaningful backtest (need at least 200 daily points)');
  }

  // Strategy A: Naive DCA state
  let naiveTotalInvested = 0;
  let naiveBtcHeld = 0;

  // Strategy B: Dynamic AI DCA state
  let dynamicTotalInvested = 0;
  let dynamicBtcHeld = 0;
  let cashReserve = 0; // accumulated cash during 0x or profit-taking periods

  const intervalDays = 7; // Weekly DCA

  for (let i = 200; i < historicalPrices.length; i += intervalDays) {
    const currentPoint = historicalPrices[i];
    if (!currentPoint) continue;

    const currentPrice = currentPoint.price;
    const windowSlice = historicalPrices.slice(0, i + 1);

    // Approximate MAs for this historical point
    const last200 = windowSlice.slice(-200);
    const ma200d = last200.reduce((s, p) => s + p.price, 0) / last200.length;
    const last1400 = windowSlice.slice(-1400);
    const ma200w = last1400.length > 0 ? last1400.reduce((s, p) => s + p.price, 0) / last1400.length : ma200d * 0.7;

    // Approximate sentiment proxy based on price momentum
    const fearGreedProxy = Math.max(10, Math.min(90, Math.round(((currentPrice / ma200d) - 0.7) * 70 + 20)));

    const cycle = computeCycleTemperature({
      btcPrice: currentPrice,
      ma200w,
      ma200d,
      weeklyRsi: 50, // neutral baseline proxy
      fearAndGreed: fearGreedProxy,
    });

    // 1. Naive DCA: strictly buys baseWeeklyUsd every week
    naiveTotalInvested += baseWeeklyUsd;
    naiveBtcHeld += baseWeeklyUsd / currentPrice;

    // 2. Dynamic DCA: adjusts based on cycle multiplier
    if (cycle.signal === 'SCALE_OUT' || cycle.signal === 'EXIT') {
      const sellRatio = cycle.signal === 'EXIT' ? 0.30 : 0.15;
      const btcToSell = dynamicBtcHeld * sellRatio;
      const cashRealized = btcToSell * currentPrice;
      dynamicBtcHeld -= btcToSell;
      cashReserve += cashRealized;
    } else {
      const dynamicAmount = baseWeeklyUsd * cycle.dcaMultiplier;
      if (dynamicAmount > 0) {
        dynamicTotalInvested += dynamicAmount;
        dynamicBtcHeld += dynamicAmount / currentPrice;
      } else {
        // Multiplier is 0: save the base amount into cash reserve
        cashReserve += baseWeeklyUsd;
      }
    }
  }

  const latestPrice = historicalPrices[historicalPrices.length - 1]?.price ?? 65000;

  // Final evaluations
  const finalValueNaive = naiveBtcHeld * latestPrice;
  const roiNaivePct = naiveTotalInvested > 0 ? ((finalValueNaive - naiveTotalInvested) / naiveTotalInvested) * 100 : 0;

  const finalValueDynamic = (dynamicBtcHeld * latestPrice) + cashReserve;
  const roiDynamicPct = dynamicTotalInvested > 0 ? ((finalValueDynamic - dynamicTotalInvested) / dynamicTotalInvested) * 100 : 0;

  const outperformancePct = roiDynamicPct - roiNaivePct;

  return {
    periodDays: historicalPrices.length,
    totalInvestedNaive: Math.round(naiveTotalInvested),
    finalValueNaive: Math.round(finalValueNaive),
    roiNaivePct: Math.round(roiNaivePct * 10) / 10,
    totalInvestedDynamic: Math.round(dynamicTotalInvested),
    finalValueDynamic: Math.round(finalValueDynamic),
    roiDynamicPct: Math.round(roiDynamicPct * 10) / 10,
    outperformancePct: Math.round(outperformancePct * 10) / 10,
    cashRemainingInReserve: Math.round(cashReserve),
  };
}
