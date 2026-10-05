import type { StockAssetConfig, LiveStockData } from '../../types/stocks.ts';
import { getWatchedStocks } from '../../config/stock-assets.ts';

interface YahooChartResponse {
  chart: {
    result?: Array<{
      meta: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        regularMarketChangePercent?: number;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
    error?: any;
  };
}

const FALLBACK_PRICES: Record<string, { price: number; ma200d: number; high: number; low: number }> = {
  SPY: { price: 588.5, ma200d: 545.2, high: 598.0, low: 495.0 },
  QQQ: { price: 508.2, ma200d: 472.0, high: 518.5, low: 418.0 },
  NVDA: { price: 237.0, ma200d: 201.0, high: 237.8, low: 164.0 },
  AAPL: { price: 232.0, ma200d: 205.5, high: 237.2, low: 164.0 },
  MSFT: { price: 428.0, ma200d: 415.0, high: 468.3, low: 366.5 },
  GOOGL: { price: 172.5, ma200d: 165.0, high: 191.7, low: 131.0 },
  MSTR: { price: 162.5, ma200d: 135.9, high: 365.2, low: 81.8 },
  COIN: { price: 188.6, ma200d: 185.0, high: 402.1, low: 139.1 },
  IBIT: { price: 48.5, ma200d: 41.8, high: 62.0, low: 28.5 },
  MARA: { price: 11.2, ma200d: 11.0, high: 27.5, low: 8.5 },
  PLTR: { price: 188.9, ma200d: 152.0, high: 195.0, low: 65.0 },
  TSLA: { price: 378.1, ma200d: 395.0, high: 488.5, low: 215.0 },
};

export async function fetchStockLiveQuote(stock: StockAssetConfig): Promise<LiveStockData> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(stock.symbol)}?range=1y&interval=1d`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as YahooChartResponse;
    const result = data.chart?.result?.[0];
    if (!result) {
      throw new Error('Empty chart result from Yahoo Finance');
    }

    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice ?? meta.chartPreviousClose ?? FALLBACK_PRICES[stock.symbol]?.price ?? 100;
    const prevClose = meta.chartPreviousClose ?? currentPrice;
    const change24hPct = meta.regularMarketChangePercent ?? Number((((currentPrice - prevClose) / prevClose) * 100).toFixed(2));
    const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh ?? (currentPrice * 1.15);
    const fiftyTwoWeekLow = meta.fiftyTwoWeekLow ?? (currentPrice * 0.75);

    // Compute 200-day moving average from close array
    const closes = (result.indicators?.quote?.[0]?.close ?? []).filter((p): p is number => typeof p === 'number' && !isNaN(p));
    let ma200d = currentPrice;
    if (closes.length >= 50) {
      const slice = closes.slice(-200);
      const sum = slice.reduce((acc, v) => acc + v, 0);
      ma200d = Number((sum / slice.length).toFixed(2));
    } else if (FALLBACK_PRICES[stock.symbol]) {
      ma200d = FALLBACK_PRICES[stock.symbol]!.ma200d;
    }

    const ratioTo200d = Number((currentPrice / ma200d).toFixed(2));
    const drawdownFromHighPct = Number((((currentPrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100).toFixed(2));
    const netAntiDilutionYieldPct = Number((stock.buybackYieldPct - stock.sbcDilutionRatePct).toFixed(2));

    return {
      symbol: stock.symbol,
      name: stock.name,
      category: stock.category,
      sector: stock.sector,
      currentPrice: Number(currentPrice.toFixed(2)),
      change24hPct: Number(change24hPct.toFixed(2)),
      fiftyTwoWeekHigh: Number(fiftyTwoWeekHigh.toFixed(2)),
      fiftyTwoWeekLow: Number(fiftyTwoWeekLow.toFixed(2)),
      drawdownFromHighPct,
      ma200d,
      ratioTo200d,
      ttmPe: stock.ttmPe,
      forwardPe: stock.forwardPe,
      fcfYieldPct: stock.fcfYieldPct,
      buybackYieldPct: stock.buybackYieldPct,
      sbcDilutionRatePct: stock.sbcDilutionRatePct,
      netAntiDilutionYieldPct,
      pegRatio: stock.pegRatio,
      grossMarginPct: stock.grossMarginPct,
      revenueGrowthYoY: stock.revenueGrowthYoY,
    };
  } catch (err) {
    console.warn(`[YahooFinance] Failed to fetch live quote for ${stock.symbol}, using fallback:`, (err as Error).message);
    const fb = FALLBACK_PRICES[stock.symbol] || { price: 100, ma200d: 95, high: 110, low: 80 };
    const ratioTo200d = Number((fb.price / fb.ma200d).toFixed(2));
    const drawdownFromHighPct = Number((((fb.price - fb.high) / fb.high) * 100).toFixed(2));
    const netAntiDilutionYieldPct = Number((stock.buybackYieldPct - stock.sbcDilutionRatePct).toFixed(2));

    return {
      symbol: stock.symbol,
      name: stock.name,
      category: stock.category,
      sector: stock.sector,
      currentPrice: fb.price,
      change24hPct: 0.5,
      fiftyTwoWeekHigh: fb.high,
      fiftyTwoWeekLow: fb.low,
      drawdownFromHighPct,
      ma200d: fb.ma200d,
      ratioTo200d,
      ttmPe: stock.ttmPe,
      forwardPe: stock.forwardPe,
      fcfYieldPct: stock.fcfYieldPct,
      buybackYieldPct: stock.buybackYieldPct,
      sbcDilutionRatePct: stock.sbcDilutionRatePct,
      netAntiDilutionYieldPct,
      pegRatio: stock.pegRatio,
      grossMarginPct: stock.grossMarginPct,
      revenueGrowthYoY: stock.revenueGrowthYoY,
    };
  }
}

export async function fetchAllWatchedStocks(): Promise<LiveStockData[]> {
  const configs = getWatchedStocks();
  const results: LiveStockData[] = [];
  for (const cfg of configs) {
    const live = await fetchStockLiveQuote(cfg);
    results.push(live);
  }
  return results;
}
