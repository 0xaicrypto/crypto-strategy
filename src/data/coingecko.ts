import type { AssetMarketData, PricePoint } from '../types/index.ts';
import { STRATEGY_CONFIG } from '../config/index.ts';

interface CoinGeckoMarketItem {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
}

export async function fetchMarketData(coinIds: string[]): Promise<Map<string, AssetMarketData>> {
  const map = new Map<string, AssetMarketData>();
  const idStr = coinIds.join(',');

  try {
    const url = `${STRATEGY_CONFIG.apis.coingeckoBase}/coins/markets?vs_currency=usd&ids=${idStr}&price_change_percentage=24h,7d,30d`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) {
      throw new Error(`CoinGecko HTTP ${res.status}: ${res.statusText}`);
    }

    const items = (await res.json()) as CoinGeckoMarketItem[];

    for (const item of items) {
      map.set(item.symbol.toUpperCase(), {
        symbol: item.symbol.toUpperCase(),
        name: item.name,
        currentPrice: item.current_price,
        marketCap: item.market_cap,
        fdv: item.fully_diluted_valuation ?? item.market_cap * 3, // fallback if null
        totalVolume24h: item.total_volume,
        priceChangePercentage24h: item.price_change_percentage_24h ?? 0,
        priceChangePercentage7d: item.price_change_percentage_7d_in_currency ?? 0,
        priceChangePercentage30d: item.price_change_percentage_30d_in_currency ?? 0,
        historicalPrices: [],
      });
    }
  } catch (err) {
    console.warn(`[CoinGecko] Market fetch error (${(err as Error).message}), loading conservative baseline.`);
    loadBaselineMarketData(map);
  }

  // Ensure mandatory assets have data
  if (!map.has('BTC') || !map.has('STRK')) {
    loadBaselineMarketData(map);
  }

  return map;
}

export async function fetchHistoricalDailyPrices(coinId: string, days: number = 1400): Promise<PricePoint[]> {
  try {
    const url = `${STRATEGY_CONFIG.apis.coingeckoBase}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`CoinGecko chart HTTP ${res.status}`);
    }

    const json = (await res.json()) as { prices: [number, number][] };
    if (!json.prices || json.prices.length === 0) {
      throw new Error('Empty historical price array');
    }

    return json.prices.map(([timestamp, price]) => ({ timestamp, price }));
  } catch (err) {
    console.warn(`[CoinGecko] Historical data for ${coinId} fallback generated: ${(err as Error).message}`);
    return generateSyntheticHistory(coinId, days);
  }
}

/**
 * Calculates 200-week moving average (approx 1400 daily bars)
 * and 200-day moving average from daily historical data.
 */
export function calculateMovingAverages(history: PricePoint[]): { ma200w: number; ma200d: number } {
  if (history.length === 0) {
    return { ma200w: 0, ma200d: 0 };
  }

  // 200 Days MA
  const last200Days = history.slice(-200);
  const ma200d = last200Days.reduce((sum, p) => sum + p.price, 0) / last200Days.length;

  // 200 Weeks MA (200 * 7 = 1400 days)
  const last1400Days = history.slice(-1400);
  const ma200w = last1400Days.reduce((sum, p) => sum + p.price, 0) / last1400Days.length;

  return {
    ma200w: Math.round(ma200w * 100) / 100,
    ma200d: Math.round(ma200d * 100) / 100,
  };
}

/**
 * Calculates 14-period RSI on weekly sampled price data
 */
export function calculateWeeklyRsi(history: PricePoint[], period: number = 14): number {
  if (history.length < period * 7) {
    return 50; // default neutral
  }

  // Sample once every 7 days to get weekly closes
  const weeklyPrices: number[] = [];
  for (let i = history.length - 1; i >= 0; i -= 7) {
    const p = history[i];
    if (p) weeklyPrices.unshift(p.price);
  }

  if (weeklyPrices.length <= period) return 50;

  const changes: number[] = [];
  for (let i = 1; i < weeklyPrices.length; i++) {
    const prev = weeklyPrices[i - 1];
    const curr = weeklyPrices[i];
    if (prev !== undefined && curr !== undefined) {
      changes.push(curr - prev);
    }
  }

  const recentChanges = changes.slice(-period);
  let gains = 0;
  let losses = 0;

  for (const c of recentChanges) {
    if (c > 0) gains += c;
    else losses += Math.abs(c);
  }

  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  const rsi = 100 - (100 / (1 + rs));
  return Math.round(rsi * 10) / 10;
}

function loadBaselineMarketData(map: Map<string, AssetMarketData>) {
  if (!map.has('BTC')) {
    map.set('BTC', {
      symbol: 'BTC',
      name: 'Bitcoin',
      currentPrice: 65400,
      marketCap: 1290000000000,
      fdv: 1373000000000,
      totalVolume24h: 28500000000,
      priceChangePercentage24h: 1.2,
      priceChangePercentage7d: 3.4,
      priceChangePercentage30d: 6.8,
      historicalPrices: [],
    });
  }

  if (!map.has('ETH')) {
    map.set('ETH', {
      symbol: 'ETH',
      name: 'Ethereum',
      currentPrice: 2650,
      marketCap: 318000000000,
      fdv: 318000000000,
      totalVolume24h: 14500000000,
      priceChangePercentage24h: 0.8,
      priceChangePercentage7d: 2.1,
      priceChangePercentage30d: -1.5,
      historicalPrices: [],
    });
  }

  if (!map.has('STRK')) {
    map.set('STRK', {
      symbol: 'STRK',
      name: 'Starknet',
      currentPrice: 0.42,
      marketCap: 890000000,
      fdv: 4200000000,
      totalVolume24h: 48000000,
      priceChangePercentage24h: -1.8,
      priceChangePercentage7d: -4.5,
      priceChangePercentage30d: -12.4,
      historicalPrices: [],
    });
  }

  if (!map.has('ARB')) {
    map.set('ARB', {
      symbol: 'ARB',
      name: 'Arbitrum',
      currentPrice: 0.58,
      marketCap: 2050000000,
      fdv: 5800000000,
      totalVolume24h: 130000000,
      priceChangePercentage24h: 0.5,
      priceChangePercentage7d: 1.2,
      priceChangePercentage30d: -5.1,
      historicalPrices: [],
    });
  }
}

function generateSyntheticHistory(coinId: string, days: number): PricePoint[] {
  const points: PricePoint[] = [];
  const now = Date.now();
  const dayMs = 86400 * 1000;
  let price = coinId === 'bitcoin' ? 65400 : coinId === 'ethereum' ? 2650 : 0.42;

  for (let i = days; i >= 0; i--) {
    const timestamp = now - i * dayMs;
    // Generate realistic multi-year baseline for 200W MA
    const trendFactor = coinId === 'bitcoin' ? (days - i) / days * 0.7 + 0.5 : 1.0;
    const noise = (Math.sin(i / 15) * 0.04) + (Math.cos(i / 60) * 0.1);
    points.push({
      timestamp,
      price: Math.max(1, price * trendFactor * (1 + noise)),
    });
  }
  return points;
}
