import type { L2ProtocolMetrics } from '../types/index.ts';
import { STRATEGY_CONFIG } from '../config/index.ts';

export async function fetchL2ChainMetrics(
  chainName: string,
  mcap: number,
  fdv: number
): Promise<L2ProtocolMetrics> {
  const normalizedChain = chainName.toLowerCase();

  try {
    const url = `${STRATEGY_CONFIG.apis.defillamaBase}/v2/historicalChainTvl/${chainName}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      throw new Error(`DeFiLlama TVL HTTP ${res.status}`);
    }

    const data = (await res.json()) as Array<{ date: number; tvl: number }>;
    if (!data || data.length === 0) {
      throw new Error('Empty chain TVL history');
    }

    const currentTvl = data[data.length - 1]?.tvl ?? 0;
    const tvl30dAgo = data.length > 30 ? (data[data.length - 30]?.tvl ?? currentTvl) : currentTvl;
    const tvlChange30dPct = tvl30dAgo > 0 ? ((currentTvl - tvl30dAgo) / tvl30dAgo) * 100 : 0;

    return {
      chain: chainName,
      tvl: Math.round(currentTvl),
      tvlChange30dPct: Math.round(tvlChange30dPct * 10) / 10,
      fees30d: estimateL2MonthlyFees(normalizedChain),
      revenue30d: estimateL2MonthlyRevenue(normalizedChain),
      mcapToTvlRatio: currentTvl > 0 ? Math.round((mcap / currentTvl) * 100) / 100 : 999,
      fdvToTvlRatio: currentTvl > 0 ? Math.round((fdv / currentTvl) * 100) / 100 : 999,
    };
  } catch (err) {
    console.warn(`[DeFiLlama] TVL fetch failed for ${chainName}: ${(err as Error).message}. Using baseline.`);
    return getFallbackL2Metrics(normalizedChain, mcap, fdv);
  }
}

function estimateL2MonthlyFees(chain: string): number {
  switch (chain) {
    case 'starknet':
      return 180000; // ~$180k/mo
    case 'arbitrum':
      return 2400000; // ~$2.4M/mo
    case 'optimism':
      return 1100000;
    case 'base':
      return 6500000;
    default:
      return 250000;
  }
}

function estimateL2MonthlyRevenue(chain: string): number {
  // Post-Dencun blob DA fee reduction leaves higher net profit margin
  return estimateL2MonthlyFees(chain) * 0.75;
}

function getFallbackL2Metrics(chain: string, mcap: number, fdv: number): L2ProtocolMetrics {
  const fallbackTvlMap: Record<string, number> = {
    starknet: 245000000, // $245M TVL
    arbitrum: 2650000000, // $2.65B TVL
    optimism: 710000000,
    base: 1850000000,
  };

  const tvl = fallbackTvlMap[chain] ?? 200000000;
  return {
    chain,
    tvl,
    tvlChange30dPct: -3.2,
    fees30d: estimateL2MonthlyFees(chain),
    revenue30d: estimateL2MonthlyRevenue(chain),
    mcapToTvlRatio: Math.round((mcap / tvl) * 100) / 100,
    fdvToTvlRatio: Math.round((fdv / tvl) * 100) / 100,
  };
}
