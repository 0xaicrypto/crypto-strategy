import type { TokenomicsData } from '../types/index.ts';
import { getAssetConfig } from '../config/assets.ts';

const TOKENOMICS_DATABASE: Record<string, TokenomicsData> = {
  BTC: {
    symbol: 'BTC',
    circulatingSupply: 19760000,
    totalSupply: 19760000,
    floatRatio: 0.94,
    marketCap: 1290000000000,
    fdv: 1373000000000,
    estimatedMonthlyUnlockPct: 0.0007,
  },
  ETH: {
    symbol: 'ETH',
    circulatingSupply: 120200000,
    totalSupply: 120200000,
    floatRatio: 1.0,
    marketCap: 318000000000,
    fdv: 318000000000,
    estimatedMonthlyUnlockPct: 0.0,
    stakingRatio: 0.28,
  },
  STRK: {
    symbol: 'STRK',
    circulatingSupply: 2150000000,
    totalSupply: 10000000000,
    floatRatio: 0.215,
    marketCap: 903000000,
    fdv: 4200000000,
    estimatedMonthlyUnlockPct: 0.030,
    stakingRatio: 0.085,
  },
  ARB: {
    symbol: 'ARB',
    circulatingSupply: 3600000000,
    totalSupply: 10000000000,
    floatRatio: 0.36,
    marketCap: 2088000000,
    fdv: 5800000000,
    estimatedMonthlyUnlockPct: 0.025,
    stakingRatio: 0.0,
  },
  OP: {
    symbol: 'OP',
    circulatingSupply: 1250000000,
    totalSupply: 4294967296,
    floatRatio: 0.29,
    marketCap: 1875000000,
    fdv: 6440000000,
    estimatedMonthlyUnlockPct: 0.028,
  },
  SOL: {
    symbol: 'SOL',
    circulatingSupply: 468000000,
    totalSupply: 585000000,
    floatRatio: 0.80,
    marketCap: 75000000000,
    fdv: 93000000000,
    estimatedMonthlyUnlockPct: 0.005,
    stakingRatio: 0.65,
  },
  SUI: {
    symbol: 'SUI',
    circulatingSupply: 2850000000,
    totalSupply: 10000000000,
    floatRatio: 0.285,
    marketCap: 5200000000,
    fdv: 18200000000,
    estimatedMonthlyUnlockPct: 0.020,
    stakingRatio: 0.70,
  },
};

export function getTokenomics(symbol: string, liveMcap?: number, liveFdv?: number): TokenomicsData {
  const sym = symbol.toUpperCase();
  const config = getAssetConfig(sym);
  const base = TOKENOMICS_DATABASE[sym];

  const mcap = liveMcap && liveMcap > 0 ? liveMcap : base?.marketCap ?? 100000000;
  const fdv = liveFdv && liveFdv > 0 ? liveFdv : base?.fdv ?? mcap * 3;
  const floatRatio = fdv > 0 ? Math.min(1.0, mcap / fdv) : base?.floatRatio ?? 0.30;

  const estimatedMonthlyUnlock =
    config?.customTokenomics?.estimatedMonthlyUnlockPct ??
    base?.estimatedMonthlyUnlockPct ??
    0.025;

  return {
    symbol: sym,
    circulatingSupply: base?.circulatingSupply ?? 100000000,
    totalSupply: config?.customTokenomics?.totalSupply ?? base?.totalSupply ?? 1000000000,
    floatRatio: Math.round(floatRatio * 1000) / 1000,
    marketCap: mcap,
    fdv,
    estimatedMonthlyUnlockPct: estimatedMonthlyUnlock,
    stakingRatio: config?.customTokenomics?.stakingRatio ?? base?.stakingRatio,
  };
}
