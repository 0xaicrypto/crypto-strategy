import type { MacroRatesData } from '../../types/stocks.ts';

interface SimpleChartMeta {
  chart: {
    result?: Array<{
      meta: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
      };
    }>;
  };
}

async function fetchIndexPrice(ticker: string, defaultVal: number): Promise<number> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as SimpleChartMeta;
    const meta = data.chart?.result?.[0]?.meta;
    return meta?.regularMarketPrice ?? meta?.chartPreviousClose ?? defaultVal;
  } catch (err) {
    console.warn(`[MacroRates] Failed to fetch ${ticker}, using fallback ${defaultVal}:`, (err as Error).message);
    return defaultVal;
  }
}

export async function fetchMacroLiquidityAndRates(): Promise<MacroRatesData> {
  // ^TNX is 10-Year Treasury Yield (quoted as yield * 10, e.g. 42.50 = 4.25%)
  const tnxRaw = await fetchIndexPrice('^TNX', 42.5);
  const us10yYield = Number((tnxRaw / 10).toFixed(2));

  // VIX Volatility Index
  const vixIndex = Number((await fetchIndexPrice('^VIX', 16.2)).toFixed(2));

  // 2-Year Treasury Yield proxy or assumption (e.g. 3.95%)
  const us2yYield = Number((us10yYield - 0.25).toFixed(2));
  const yieldCurveSpread = Number((us10yYield - us2yYield).toFixed(2));

  // S&P 500 Forward P/E (~22.4)
  const sp500Pe = 22.4;
  const sp500EarningsYield = Number(((1 / sp500Pe) * 100).toFixed(2)); // e.g. 4.46%

  // Equity Risk Premium = S&P 500 Earnings Yield - US10Y Yield
  const equityRiskPremiumPct = Number((sp500EarningsYield - us10yYield).toFixed(2));

  let macroRegime: 'DEEP_VALUE' | 'FAIR_VALUE' | 'RICH_VALUATION' | 'EUPHORIC_BUBBLE' = 'RICH_VALUATION';
  let equityDcaMultiplier = 1.0;
  let summary = '';

  if (equityRiskPremiumPct >= 3.5) {
    macroRegime = 'DEEP_VALUE';
    equityDcaMultiplier = 2.0;
    summary = `ERP 股权风险溢价处于高位 (${equityRiskPremiumPct}%)，美股相对于无风险美债极具性价比，开启 2.0x 积极加倍定投。`;
  } else if (equityRiskPremiumPct >= 1.8) {
    macroRegime = 'FAIR_VALUE';
    equityDcaMultiplier = 1.25;
    summary = `ERP 处于中性健康区间 (${equityRiskPremiumPct}%)，股市收益率平稳覆盖国债利率，维持 1.25x 稳健基准定投。`;
  } else if (equityRiskPremiumPct >= 0.5) {
    macroRegime = 'RICH_VALUATION';
    equityDcaMultiplier = 0.75;
    summary = `ERP 偏低 (${equityRiskPremiumPct}%)，美债 10 年期收益率处于 ${us10yYield}% 高位，美股溢价偏薄，建议缩减至 0.75x 防御性定投并增配短期国债/现金。`;
  } else {
    macroRegime = 'EUPHORIC_BUBBLE';
    equityDcaMultiplier = 0.25;
    summary = `ERP 极度收窄甚至倒挂 (${equityRiskPremiumPct}%)，股市风险补偿严重不足，全面进入防守模式 (0.25x)，将资金沉淀为现金储备。`;
  }

  return {
    timestamp: Date.now(),
    us10yYield,
    us2yYield,
    yieldCurveSpread,
    vixIndex,
    sp500Pe,
    sp500EarningsYield,
    equityRiskPremiumPct,
    macroRegime,
    equityDcaMultiplier,
    summary,
  };
}
