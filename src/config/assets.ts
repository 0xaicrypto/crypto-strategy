/**
 * 关注资产配置清单 (Watched Assets Configuration)
 *
 * 可以在这里随意添加、删除或启闭你关注的资产。
 * 系统在启动时会自动读取此配置，完成行情获取、链上指标、稀释度评估与仓位限额控制。
 */

export type AssetCategory = 'CORE' | 'ALT_L2' | 'ALT_L1' | 'DEFI' | 'MEME' | 'CASH';

export interface WatchedAsset {
  symbol: string;             // 代币代码 (如 'STRK', 'SOL')
  name: string;               // 资产全名
  coingeckoId: string;        // CoinGecko API 对应 id
  category: AssetCategory;    // 资产分类 (CORE 为大盘底仓，ALT 为卫星仓位)
  chainName?: string;         // DeFiLlama 链名称 (若需跟踪 L2/公链 TVL与费用，如 'starknet')
  maxPortfolioCapPct: number; // 严格风控上限 (如 0.03 代表组合中最多允许占 3%)
  customTokenomics?: {
    totalSupply?: number;               // 总供应量 (若公开发行已知)
    estimatedMonthlyUnlockPct?: number; // 每月预估线性解锁占流通盘比例 (如 0.03 代表 3%/月)
    stakingRatio?: number;              // 质押比例
  };
  enabled: boolean;           // 是否开启监控分析 (true/false)
}

export const WATCHED_ASSETS: WatchedAsset[] = [
  // ================= 核心底仓标的 (Core Assets) =================
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    coingeckoId: 'bitcoin',
    category: 'CORE',
    maxPortfolioCapPct: 0.85,
    enabled: true,
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    coingeckoId: 'ethereum',
    category: 'CORE',
    maxPortfolioCapPct: 0.35,
    enabled: true,
  },

  // ================= 重点监控 L2 赛道资产 (Layer 2) =================
  {
    symbol: 'STRK',
    name: 'Starknet',
    coingeckoId: 'starknet',
    category: 'ALT_L2',
    chainName: 'starknet',
    maxPortfolioCapPct: 0.03, // 严格风控：单个 VC 高稀释代币不超过 3%
    customTokenomics: {
      totalSupply: 10_000_000_000,
      estimatedMonthlyUnlockPct: 0.030, // 每月约 64M STRK 解锁 (约 3.0% 流通盘)
      stakingRatio: 0.085,
    },
    enabled: true,
  },
  {
    symbol: 'ARB',
    name: 'Arbitrum',
    coingeckoId: 'arbitrum',
    category: 'ALT_L2',
    chainName: 'arbitrum',
    maxPortfolioCapPct: 0.04,
    customTokenomics: {
      totalSupply: 10_000_000_000,
      estimatedMonthlyUnlockPct: 0.025, // 每月约 92M ARB 解锁
    },
    enabled: true,
  },
  {
    symbol: 'OP',
    name: 'Optimism',
    coingeckoId: 'optimism',
    category: 'ALT_L2',
    chainName: 'optimism',
    maxPortfolioCapPct: 0.04,
    customTokenomics: {
      totalSupply: 4_294_967_296,
      estimatedMonthlyUnlockPct: 0.028,
    },
    enabled: false, // 设为 true 即可开启监控
  },

  // ================= 备选高 Beta 新公链 (Layer 1 Alternatives) =================
  {
    symbol: 'SOL',
    name: 'Solana',
    coingeckoId: 'solana',
    category: 'ALT_L1',
    chainName: 'solana',
    maxPortfolioCapPct: 0.10, // 头部非 EVM 公链允许稍高上限
    customTokenomics: {
      estimatedMonthlyUnlockPct: 0.005, // 主要是自然通胀质押释放
    },
    enabled: false, // 如需跟踪，将此处改为 true
  },
  {
    symbol: 'SUI',
    name: 'Sui',
    coingeckoId: 'sui',
    category: 'ALT_L1',
    chainName: 'sui',
    maxPortfolioCapPct: 0.04,
    customTokenomics: {
      totalSupply: 10_000_000_000,
      estimatedMonthlyUnlockPct: 0.020,
    },
    enabled: false, // 如需跟踪，将此处改为 true
  },
];

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CUSTOM_ASSETS_FILE = path.resolve(__dirname, 'custom_assets.json');

function loadCustomAssets(): WatchedAsset[] {
  try {
    if (fs.existsSync(CUSTOM_ASSETS_FILE)) {
      const content = fs.readFileSync(CUSTOM_ASSETS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('[Assets] Failed to load custom assets file:', err);
  }
  return [];
}

function persistCustomAssets(assets: WatchedAsset[]) {
  try {
    fs.writeFileSync(CUSTOM_ASSETS_FILE, JSON.stringify(assets, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Assets] Failed to persist custom assets:', err);
  }
}

// In-memory merged list
let mergedAssets: WatchedAsset[] = [...WATCHED_ASSETS];
refreshMergedAssets();

function refreshMergedAssets() {
  const custom = loadCustomAssets();
  const map = new Map<string, WatchedAsset>();
  for (const a of WATCHED_ASSETS) {
    map.set(a.symbol.toUpperCase(), { ...a });
  }
  for (const c of custom) {
    map.set(c.symbol.toUpperCase(), { ...c });
  }
  mergedAssets = Array.from(map.values());
}

/**
 * 辅助函数：获取所有已启用的资产清单
 */
export function getActiveAssets(): WatchedAsset[] {
  refreshMergedAssets();
  return mergedAssets.filter((a) => a.enabled);
}

/**
 * 辅助函数：根据 symbol 查找配置
 */
export function getAssetConfig(symbol: string): WatchedAsset | undefined {
  refreshMergedAssets();
  return mergedAssets.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase());
}

/**
 * 动态关注新资产或启用已有资产
 */
export function addOrWatchAsset(asset: {
  symbol: string;
  name: string;
  coingeckoId: string;
  category?: AssetCategory;
  chainName?: string;
  maxPortfolioCapPct?: number;
}): WatchedAsset {
  const sym = asset.symbol.toUpperCase();
  const existing = mergedAssets.find((a) => a.symbol.toUpperCase() === sym);

  const newAsset: WatchedAsset = {
    symbol: sym,
    name: asset.name,
    coingeckoId: asset.coingeckoId,
    category: asset.category || 'ALT_L1',
    chainName: asset.chainName,
    maxPortfolioCapPct: asset.maxPortfolioCapPct || (asset.category === 'ALT_L2' ? 0.03 : 0.02),
    enabled: true,
    customTokenomics: existing?.customTokenomics || {
      estimatedMonthlyUnlockPct: 0.02,
    },
  };

  const custom = loadCustomAssets().filter((a) => a.symbol.toUpperCase() !== sym);
  custom.push(newAsset);
  persistCustomAssets(custom);
  refreshMergedAssets();

  return newAsset;
}

/**
 * 取消关注资产
 */
export function unwatchAsset(symbol: string): boolean {
  const sym = symbol.toUpperCase();
  const custom = loadCustomAssets().filter((a) => a.symbol.toUpperCase() !== sym);
  persistCustomAssets(custom);

  // If in default WATCHED_ASSETS, disable it in memory
  const defaultAsset = WATCHED_ASSETS.find((a) => a.symbol.toUpperCase() === sym);
  if (defaultAsset) {
    defaultAsset.enabled = false;
  }

  refreshMergedAssets();
  return true;
}

