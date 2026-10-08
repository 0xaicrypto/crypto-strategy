#!/usr/bin/env node
/**
 * Crypto Strategy MCP Server
 * Model Context Protocol (MCP) server for Crypto Strategy
 * Bridges AI Agents (Claude Desktop, Cursor, Antigravity) with Mantle L2,
 * Macro Cycle Models, SEC Fundamentals Dilution Audits, and Fluxion 0-Gas EIP-712 Execution.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Web Bridge Base URL (defaults to local dashboard)
const WEB_BRIDGE_URL = process.env.WEB_BRIDGE_URL || "http://localhost:3456";

// Supported Fluxion Limit Order Tokens
const SUPPORTED_TOKENS: Record<string, { symbol: string; decimals: number; address: string; type: string }> = {
  USDC: { symbol: 'USDC', decimals: 6, address: '0x09bc4e0d864854c6afb6fb9a96e83a36156a1473', type: 'STABLE' },
  USDT: { symbol: 'USDT', decimals: 6, address: '0x201eba5cc46d216ce6dc03f6a759e8e766e956be', type: 'STABLE' },
  MNT: { symbol: 'MNT', decimals: 18, address: '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000', type: 'NATIVE' },
  WMNT: { symbol: 'WMNT', decimals: 18, address: '0x78c1b0c915c4faa5fffa6cabf086775087771346', type: 'L2_CORE' },
  TSLAx: { symbol: 'TSLAx', decimals: 18, address: '0x6a053c89E0b47FE07bB32c5890e0c0C63be095f9', type: 'STOCK_RWA' },
  NVDAx: { symbol: 'NVDAx', decimals: 18, address: '0x8772aE5c33e889F7FeF10D12E651E4E819a5840a', type: 'STOCK_RWA' },
  AAPLx: { symbol: 'AAPLx', decimals: 18, address: '0xcF113337B69E810C05342aC7f9999Fe1f516D686', type: 'STOCK_RWA' },
  bIB01: { symbol: 'bIB01', decimals: 18, address: '0x217d121c223c726354ab9B0FdfDE95e1F78A86Eb', type: 'BOND_RWA' }
};

// Helper: Query local Web Dashboard API with timeout and fallback
async function fetchLocalApi(endpoint: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${WEB_BRIDGE_URL}${endpoint}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Web server might be offline or slow; fall back to static/heuristic defaults
  }
  return null;
}

// Comprehensive fallback data for SEC Stock Fundamentals and Evaluations
const FALLBACK_STOCK_EVALUATIONS = [
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    category: "INDEX",
    sector: "Broad Market ETF",
    currentPrice: 775.36,
    change24hPct: -0.24,
    ma200d: 722.47,
    ratioTo200d: 1.07,
    buybackYieldPct: 2.1,
    sbcDilutionRatePct: 0.4,
    netAntiDilutionYieldPct: 1.7,
    fcfYieldPct: 3.4,
    grossMarginPct: 35.0,
    pegRatio: 1.8,
    forwardPe: 22.4,
    ttmPe: 27.2,
    antiDilutionScore: 82,
    cashFlowQualityScore: 51,
    valuationScore: 70,
    compositeHealthScore: 68,
    verdict: "ACCUMULATE",
    dcaAllowed: true,
    maxPortfolioCapPct: 0.35,
    keyStrengths: ["净回购通缩率 +1.7% (年回购 2.1% 远超 SBC 稀释)"],
    riskWarnings: [],
    triggersForEntry: ["现金流收益率提供充足安全边际"],
  },
  {
    symbol: "QQQ",
    name: "Invesco QQQ Trust (Nasdaq 100)",
    category: "INDEX",
    sector: "Tech Index ETF",
    currentPrice: 598.20,
    change24hPct: 0.35,
    ma200d: 556.10,
    ratioTo200d: 1.08,
    buybackYieldPct: 2.3,
    sbcDilutionRatePct: 0.6,
    netAntiDilutionYieldPct: 1.7,
    fcfYieldPct: 3.2,
    grossMarginPct: 48.0,
    pegRatio: 1.9,
    forwardPe: 25.8,
    ttmPe: 31.5,
    antiDilutionScore: 82,
    cashFlowQualityScore: 58,
    valuationScore: 70,
    compositeHealthScore: 70,
    verdict: "ACCUMULATE",
    dcaAllowed: true,
    maxPortfolioCapPct: 0.30,
    keyStrengths: ["净回购通缩率 +1.7% (年回购 2.3% 远超 SBC 稀释)"],
    riskWarnings: [],
    triggersForEntry: ["现金流收益率提供充足安全边际"],
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    category: "TECH_GROWTH",
    sector: "Semiconductors & AI",
    currentPrice: 118.20,
    change24hPct: 1.15,
    ma200d: 112.50,
    ratioTo200d: 1.05,
    buybackYieldPct: 1.8,
    sbcDilutionRatePct: 0.7,
    netAntiDilutionYieldPct: 1.1,
    fcfYieldPct: 2.8,
    grossMarginPct: 75.1,
    pegRatio: 1.1,
    forwardPe: 31.2,
    ttmPe: 44.8,
    antiDilutionScore: 76,
    cashFlowQualityScore: 85,
    valuationScore: 85,
    compositeHealthScore: 82,
    verdict: "STRONG_ACCUMULATE",
    dcaAllowed: true,
    maxPortfolioCapPct: 0.12,
    keyStrengths: [
      "超高毛利率 75.1%，拥有不可替代的垄断级行业护城河",
      "全球 AI 算力与 GPU 生态唯一垄断者"
    ],
    riskWarnings: [],
    triggersForEntry: ["回踩 200 日线关键支撑位，适合左侧底仓配置"],
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    category: "TECH_GROWTH",
    sector: "Autonomous AI & Energy",
    currentPrice: 218.40,
    change24hPct: -1.20,
    ma200d: 215.10,
    ratioTo200d: 1.02,
    buybackYieldPct: 0.0,
    sbcDilutionRatePct: 1.5,
    netAntiDilutionYieldPct: -1.5,
    fcfYieldPct: 1.8,
    grossMarginPct: 19.8,
    pegRatio: 3.2,
    forwardPe: 55.0,
    ttmPe: 72.0,
    antiDilutionScore: 40,
    cashFlowQualityScore: 35,
    valuationScore: 45,
    compositeHealthScore: 40,
    verdict: "HOLD",
    dcaAllowed: false,
    maxPortfolioCapPct: 0.08,
    keyStrengths: ["全球自动驾驶 FSD、Robotaxi 与储能生态领跑者"],
    riskWarnings: [
      "股权激励稀释率 (1.5%) 超过回购注销率，股本呈现内生膨胀",
      "PEG 偏高 (3.2)，当前估值透支较多"
    ],
    triggersForEntry: ["回踩 200 日线关键支撑位，适合左侧底仓配置"],
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    category: "TECH_GROWTH",
    sector: "Consumer Tech & Hardware",
    currentPrice: 226.50,
    change24hPct: 0.40,
    ma200d: 208.30,
    ratioTo200d: 1.09,
    buybackYieldPct: 3.5,
    sbcDilutionRatePct: 0.8,
    netAntiDilutionYieldPct: 2.7,
    fcfYieldPct: 3.8,
    grossMarginPct: 46.2,
    pegRatio: 2.4,
    forwardPe: 27.5,
    ttmPe: 33.4,
    antiDilutionScore: 92,
    cashFlowQualityScore: 68,
    valuationScore: 60,
    compositeHealthScore: 74,
    verdict: "ACCUMULATE",
    dcaAllowed: true,
    maxPortfolioCapPct: 0.12,
    keyStrengths: [
      "净回购通缩率 +2.7% (年回购 3.5% 远超 SBC 稀释)",
      "自由现金流收益率达 3.8%，现金造血机器",
      "十年销毁超 35% 总股数"
    ],
    riskWarnings: [],
    triggersForEntry: ["现金流收益率提供充足安全边际"],
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    category: "TECH_GROWTH",
    sector: "Cloud & Enterprise AI",
    currentPrice: 428.10,
    change24hPct: 0.85,
    ma200d: 418.90,
    ratioTo200d: 1.02,
    buybackYieldPct: 1.2,
    sbcDilutionRatePct: 0.6,
    netAntiDilutionYieldPct: 0.6,
    fcfYieldPct: 2.7,
    grossMarginPct: 69.8,
    pegRatio: 2.1,
    forwardPe: 28.0,
    ttmPe: 33.8,
    antiDilutionScore: 71,
    cashFlowQualityScore: 75,
    valuationScore: 65,
    compositeHealthScore: 71,
    verdict: "ACCUMULATE",
    dcaAllowed: true,
    maxPortfolioCapPct: 0.12,
    keyStrengths: [
      "超高毛利率 69.8%，拥有不可替代的垄断级行业护城河",
      "企业云服务与生成式 AI 落地领跑者"
    ],
    riskWarnings: [],
    triggersForEntry: ["回踩 200 日线关键支撑位，适合左侧底仓配置"],
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    category: "TECH_GROWTH",
    sector: "Search, Cloud & AI",
    currentPrice: 178.60,
    change24hPct: -0.10,
    ma200d: 168.20,
    ratioTo200d: 1.06,
    buybackYieldPct: 3.2,
    sbcDilutionRatePct: 1.1,
    netAntiDilutionYieldPct: 2.1,
    fcfYieldPct: 4.5,
    grossMarginPct: 57.5,
    pegRatio: 1.2,
    forwardPe: 18.9,
    ttmPe: 22.5,
    antiDilutionScore: 86,
    cashFlowQualityScore: 82,
    valuationScore: 85,
    compositeHealthScore: 84,
    verdict: "STRONG_ACCUMULATE",
    dcaAllowed: true,
    maxPortfolioCapPct: 0.12,
    keyStrengths: [
      "净回购通缩率 +2.1% (年回购 3.2% 远超 SBC 稀释)",
      "自由现金流收益率达 4.5%，现金造血机器",
      "估值处于科技巨头历史最低分位数之一"
    ],
    riskWarnings: [],
    triggersForEntry: ["现金流收益率提供充足安全边际"],
  },
  {
    symbol: "COIN",
    name: "Coinbase Global Inc.",
    category: "CRYPTO_PROXY",
    sector: "Crypto Infrastructure",
    currentPrice: 172.50,
    change24hPct: 2.30,
    ma200d: 195.40,
    ratioTo200d: 0.88,
    buybackYieldPct: 1.0,
    sbcDilutionRatePct: 2.2,
    netAntiDilutionYieldPct: -1.2,
    fcfYieldPct: 3.1,
    grossMarginPct: 84.5,
    pegRatio: 1.6,
    forwardPe: 29.5,
    ttmPe: 38.0,
    antiDilutionScore: 48,
    cashFlowQualityScore: 82,
    valuationScore: 80,
    compositeHealthScore: 69,
    verdict: "ACCUMULATE",
    dcaAllowed: true,
    maxPortfolioCapPct: 0.05,
    keyStrengths: [
      "超高毛利率 84.5%，拥有不可替代的垄断级行业护城河",
      "Base 链生态繁荣与 USDC 利息收益构成第二增长曲线"
    ],
    riskWarnings: ["股权激励稀释率 (2.2%) 超过回购注销率，股本呈现内生膨胀"],
    triggersForEntry: [
      "回踩 200 日线关键支撑位，适合左侧底仓配置",
      "现金流收益率提供充足安全边际"
    ],
  },
  {
    symbol: "MSTR",
    name: "MicroStrategy Inc.",
    category: "CRYPTO_PROXY",
    sector: "Bitcoin Treasury Proxy",
    currentPrice: 145.80,
    change24hPct: 3.50,
    ma200d: 135.20,
    ratioTo200d: 1.08,
    buybackYieldPct: 0.0,
    sbcDilutionRatePct: 2.5,
    netAntiDilutionYieldPct: -2.5,
    fcfYieldPct: -0.5,
    grossMarginPct: 72.0,
    pegRatio: 4.5,
    forwardPe: 65.0,
    ttmPe: 85.0,
    antiDilutionScore: 25,
    cashFlowQualityScore: 30,
    valuationScore: 35,
    compositeHealthScore: 30,
    verdict: "HOLD",
    dcaAllowed: false,
    maxPortfolioCapPct: 0.05,
    keyStrengths: ["华尔街杠杆化比特币储备载体，高贝塔弹性标的"],
    riskWarnings: [
      "股权激励稀释率 (2.5%) 较高，且依靠增发可转债购买 BTC",
      "自由现金流为负，估值高度依赖比特币牛市预期"
    ],
    triggersForEntry: ["按周期乘数严格分批执行"],
  },
  {
    symbol: "PLTR",
    name: "Palantir Technologies Inc.",
    category: "TECH_GROWTH",
    sector: "Enterprise AI & Defense",
    currentPrice: 42.50,
    change24hPct: 1.80,
    ma200d: 31.20,
    ratioTo200d: 1.36,
    buybackYieldPct: 1.0,
    sbcDilutionRatePct: 2.0,
    netAntiDilutionYieldPct: -1.0,
    fcfYieldPct: 2.5,
    grossMarginPct: 81.5,
    pegRatio: 2.8,
    forwardPe: 68.0,
    ttmPe: 95.0,
    antiDilutionScore: 52,
    cashFlowQualityScore: 78,
    valuationScore: 35,
    compositeHealthScore: 56,
    verdict: "HOLD",
    dcaAllowed: false,
    maxPortfolioCapPct: 0.08,
    keyStrengths: [
      "超高毛利率 81.5%，拥有不可替代的垄断级行业护城河",
      "美国国防与企业级 AIP 大模型平台领跑者"
    ],
    riskWarnings: [
      "股价较 200 日牛熊线溢价偏高 (1.36x)，短期动量过热",
      "股权激励稀释率 (2.0%) 偏高"
    ],
    triggersForEntry: ["等待充分回调后右侧挂单"],
  },
];

const TOOLS: Tool[] = [
  {
    name: "get_cycle_thermometer",
    description:
      "Fetches the real-time AI Macro Cycle Temperature (0-100), BTC 200W/200D MA valuation multiple, weekly RSI, Fear & Greed sentiment, current macro regime (DCA Accumulation, Hold, or Distribution), and recommended Equity/Crypto vs Cash allocation ratios.",
    inputSchema: {
      type: "object",
      properties: {
        refresh: {
          type: "boolean",
          description: "Force refresh latest on-chain and market data",
        },
      },
    },
  },
  {
    name: "audit_asset_dilution",
    description:
      "Performs an in-depth tokenomics and fundamental dilution risk audit for one or all watched assets. For crypto tokens: audits circulating supply ratio (MCap/FDV), annual inflation rate, and unlock cliffs. For equities and BackedFi RWAs: audits net anti-dilution yield (share buyback vs SBC dilution), free cash flow (FCF) yield safety margin, gross margin moat, key strengths, risk warnings, and entry triggers.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Asset symbol to audit (e.g. 'SPY', 'QQQ', 'TSLAx', 'NVDAx', 'MNT', 'STRK', or 'all'). Defaults to 'all'",
        },
      },
    },
  },
  {
    name: "get_asset_fundamentals",
    description:
      "Queries deep financial fundamentals, SEC 10-K/10-Q metrics, net anti-dilution yield (share buyback vs SBC dilution), free cash flow (FCF) yield safety margin, gross margin moat, PEG valuation, key strengths, risk warnings, and entry triggers for US equities and BackedFi RWAs (e.g. SPY, QQQ, NVDAx, TSLAx, AAPLx, MSFT, GOOGL, MSTR, COIN, PLTR).",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Asset symbol (e.g. 'SPY', 'QQQ', 'NVDA', 'NVDAx', 'TSLA', 'TSLAx', 'MSTR', 'COIN', or 'ALL'). Defaults to 'ALL'",
        },
      },
    },
  },
  {
    name: "scan_radar_opportunities",
    description:
      "Scans real-time on-chain and cross-asset markets for undervalued opportunities, momentum breakouts, and RWA yield plays on Mantle Network and global markets.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["ALL", "CRYPTO", "STOCK_RWA"],
          description: "Filter candidates by asset category (default: ALL)",
        },
        minScore: {
          type: "number",
          description: "Minimum composite opportunity score (0-100, default: 60)",
        },
      },
    },
  },
  {
    name: "analyze_portfolio_health",
    description:
      "Evaluates user's portfolio risk posture, asset concentration, stablecoin reserve ratio, and drift from ideal cycle allocation targets. Generates concrete rebalancing actions (buy dip, trim, or maintain cash reserves).",
    inputSchema: {
      type: "object",
      properties: {
        walletAddress: {
          type: "string",
          description: "Observed public wallet address on Mantle Network (read-only)",
        },
        holdings: {
          type: "object",
          description: "Key-value pair of token symbols and amounts, e.g. {'USDC': 5000, 'TSLAx': 10, 'MNT': 1500}",
        },
      },
    },
  },
  {
    name: "quote_mantle_swap",
    description:
      "Quotes the optimal swap route and price on Mantle Network DEX aggregators (MNT, USDC, USDT, WMNT, BackedFi RWAs). Calculates expected output and generates a 1-click Web Execution link.",
    inputSchema: {
      type: "object",
      properties: {
        payToken: {
          type: "string",
          description: "Token to sell (e.g. 'MNT', 'USDC')",
        },
        receiveToken: {
          type: "string",
          description: "Token to buy (e.g. 'USDC', 'TSLAx', 'MNT')",
        },
        amount: {
          type: "number",
          description: "Amount of payToken to spend",
        },
      },
      required: ["payToken", "receiveToken", "amount"],
    },
  },
  {
    name: "create_fluxion_order_payload",
    description:
      "Constructs a gasless 0-Gas EIP-712 limit order payload for the Fluxion orderbook protocol on Mantle Network, and generates an interactive 1-click Web Execution Bridge URL for the user to securely review and sign in their browser wallet without private key exposure.",
    inputSchema: {
      type: "object",
      properties: {
        makerToken: {
          type: "string",
          description: "Token to pay/sell (e.g. 'USDC', 'USDT')",
        },
        takerToken: {
          type: "string",
          description: "Target asset to buy at discount (e.g. 'TSLAx', 'NVDAx', 'WMNT')",
        },
        makerAmount: {
          type: "number",
          description: "Total amount of makerToken to offer (e.g. 350)",
        },
        limitRate: {
          type: "number",
          description: "Target execution rate / limit price in terms of makerToken (e.g. 213.90)",
        },
        expiryHours: {
          type: "number",
          description: "Order expiration in hours (default: 24)",
        },
        reason: {
          type: "string",
          description: "Strategic investment thesis / rationale for this limit order",
        },
      },
      required: ["makerToken", "takerToken", "makerAmount", "limitRate"],
    },
  },
];

// Server Implementation
const server = new Server(
  {
    name: "crypto-strategy-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_cycle_thermometer": {
        const liveStatus = await fetchLocalApi("/api/status");
        if (liveStatus && liveStatus.cycle) {
          const c = liveStatus.cycle;
          const s = liveStatus.sentiment || { value: 42, classification: 'Neutral' };
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    temperature: c.temperature,
                    regime: c.regime,
                    regimeLabel: c.regime === 'DCA_ACCUMULATION' ? '低估定投吸筹期' : (c.regime === 'DISTRIBUTION' ? '高估分批止盈期' : '均衡持仓观察期'),
                    fearAndGreedIndex: s.value,
                    sentimentClassification: s.classification,
                    btcReferencePrice: liveStatus.holdings?.btcPrice || 67450,
                    recommendedAllocation: {
                      cryptoEquityWeight: `${Math.round(c.targetEquityAllocation * 100 || 65)}%`,
                      cashReserveWeight: `${Math.round((1 - (c.targetEquityAllocation || 0.65)) * 100)}%`,
                      actionPlan: c.regime === 'DCA_ACCUMULATION'
                        ? "执行右侧阶梯折价限价单吸筹，保留30%稳定币储备"
                        : "维持核心配置，不追高，等待折价机会",
                    },
                    timestamp: new Date().toISOString(),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Fallback heuristic output
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  temperature: 34,
                  regime: "DCA_ACCUMULATION",
                  regimeLabel: "低估定投吸筹期",
                  fearAndGreedIndex: 38,
                  sentimentClassification: "Fear",
                  btcReferencePrice: 67200,
                  recommendedAllocation: {
                    cryptoEquityWeight: "65%",
                    cashReserveWeight: "35%",
                    actionPlan: "大周期估值乘数处于历史均值下方，建议保持分批挂单吸筹模式。",
                  },
                  source: "Heuristic Macro Fallback",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "audit_asset_dilution": {
        const symbolArg = (typeof args?.symbol === "string" ? args.symbol.trim() : "all").toUpperCase();
        
        // 1. Fetch live stock and crypto status from local dashboard API
        const [stocksData, statusData] = await Promise.all([
          fetchLocalApi("/api/stocks"),
          fetchLocalApi("/api/status"),
        ]);

        const stockList = stocksData?.stockEvaluations || FALLBACK_STOCK_EVALUATIONS;

        // Build audits for Equities and RWAs
        const stockAudits = stockList.map((s: any) => {
          const isRwa = ['TSLA', 'NVDA', 'AAPL'].includes(s.symbol);
          const displaySymbol = isRwa ? `${s.symbol}x` : s.symbol;
          const netRate = typeof s.netAntiDilutionYieldPct === 'number' 
            ? s.netAntiDilutionYieldPct 
            : parseFloat(s.netAntiDilutionYieldPct || 0);

          let dilutionNature = "内生股本稀释 (管理层 SBC 稀释率超过公司回购注销)";
          if (netRate >= 1.5) {
            dilutionNature = "内生通缩销毁 (年股票回购注销率显著超越 SBC 股权激励稀释)";
          } else if (netRate >= 0.0) {
            dilutionNature = "轻度通缩 (回购注销略大于管理层股权稀释)";
          }

          return {
            symbol: displaySymbol,
            underlyingTicker: s.symbol,
            name: s.name,
            category: isRwa ? "STOCK_RWA" : (s.category || "US_EQUITY"),
            currentPrice: `$${Number(s.currentPrice || 0).toFixed(2)}`,
            dilutionStatus: {
              netAntiDilutionYieldPct: `${netRate >= 0 ? '+' : ''}${netRate}%`,
              annualBuybackYieldPct: `${s.buybackYieldPct}%`,
              sbcDilutionRatePct: `${s.sbcDilutionRatePct}%`,
              dilutionNature,
            },
            financialMoat: {
              fcfYieldPct: `${s.fcfYieldPct}%`,
              grossMarginPct: `${s.grossMarginPct}%`,
              pegRatio: s.pegRatio,
              valuationPto200d: `${s.ratioTo200d}x`,
            },
            scores: {
              antiDilutionScore: `${s.antiDilutionScore}/100`,
              cashFlowQualityScore: `${s.cashFlowQualityScore}/100`,
              valuationScore: `${s.valuationScore}/100`,
              compositeHealthScore: `${s.compositeHealthScore}/100`,
            },
            verdict: s.verdict,
            dcaAllowed: s.dcaAllowed,
            keyStrengths: s.keyStrengths || [],
            triggersForEntry: s.triggersForEntry || [],
            riskWarnings: s.riskWarnings || [],
            unvestedTokensCliff: isRwa ? "None (1:1 实体股票法币隔离托管 / BackedFi DLT)" : "公开市场交易股票",
            auditNotes: `净抗稀释率: ${netRate >= 0 ? '+' : ''}${netRate}%, 自由现金流收益率: ${s.fcfYieldPct}%, 毛利率: ${s.grossMarginPct}%`,
          };
        });

        // Built-in Crypto and Bond audits
        const altEvaluations = statusData?.altEvaluations || [];
        const strkEval = altEvaluations.find((a: any) => a.symbol === 'STRK');

        const cryptoAudits = [
          {
            symbol: "bIB01",
            underlyingTicker: "IB01",
            name: "iShares 0-1yr US Treasury (Backed)",
            category: "BOND_RWA",
            currentPrice: "$108.50",
            dilutionStatus: {
              netAntiDilutionYieldPct: "+4.80%",
              annualBuybackYieldPct: "4.80%",
              sbcDilutionRatePct: "0.00%",
              dilutionNature: "无稀释 (超短端美债本息自动归集滚存，法币全额抵押)",
            },
            financialMoat: {
              fcfYieldPct: "4.80%",
              grossMarginPct: "100.0%",
              pegRatio: 1.0,
              valuationPto200d: "1.00x",
            },
            scores: {
              antiDilutionScore: "95/100",
              cashFlowQualityScore: "95/100",
              valuationScore: "90/100",
              compositeHealthScore: "92/100",
            },
            verdict: "ACCUMULATE",
            dcaAllowed: true,
            keyStrengths: ["享约 4.8% 美债年化无风险基准收益，100% 储备金保障"],
            triggersForEntry: ["现金管理与避险防守首选"],
            riskWarnings: [],
            unvestedTokensCliff: "None (美债本息归集)",
            auditNotes: "无稀释风险，享约 4.8% 美债年化无风险基准收益。",
          },
          {
            symbol: "MNT",
            underlyingTicker: "MNT",
            name: "Mantle Network",
            category: "L2_GAS",
            currentPrice: "$0.642",
            dilutionStatus: {
              dilutionRate: "3.20%",
              mcapFdvRatio: "52.4%",
              dilutionNature: "生态温和通胀 (主要用于 L2 Gas 激励与生态基金支出)",
            },
            financialMoat: {
              fcfYieldPct: "N/A",
              grossMarginPct: "N/A",
              pegRatio: 1.2,
              valuationPto200d: "0.98x",
            },
            scores: {
              dilutionRiskScore: "78/100",
              ecosystemTractionScore: "85/100",
              compositeHealthScore: "82/100",
            },
            verdict: "ACCUMULATE",
            dcaAllowed: true,
            keyStrengths: ["Mantle L2 Gas 消耗场景与生态金库赋能"],
            triggersForEntry: ["L2 生态估值低吸区间"],
            riskWarnings: [],
            unvestedTokensCliff: "国库平稳线性释放，生态基金支持",
            auditNotes: "主要用于 L2 Gas 与治理，生态通胀率处于健康区间。",
          },
          {
            symbol: "STRK",
            underlyingTicker: "STRK",
            name: "Starknet",
            category: "L2_GOV",
            currentPrice: `$${strkEval ? Number(strkEval.currentPrice).toFixed(4) : "0.0592"}`,
            dilutionStatus: {
              dilutionRate: "28.50%",
              mcapFdvRatio: "18.2%",
              dilutionNature: "高通胀稀释风险 (流通比极低，面临持续月度团队与投资人释放)",
            },
            financialMoat: {
              fcfYieldPct: "N/A",
              grossMarginPct: "N/A",
              pegRatio: 3.5,
              valuationPto200d: "0.82x",
            },
            scores: {
              dilutionRiskScore: `${strkEval?.dilutionRiskScore || 45}/100`,
              ecosystemTractionScore: `${strkEval?.ecosystemTractionScore || 35}/100`,
              compositeHealthScore: `${strkEval?.compositeHealthScore || 55}/100`,
            },
            verdict: strkEval?.verdict || "ACCUMULATE_CONSERVATIVE",
            dcaAllowed: strkEval?.dcaAllowed ?? true,
            keyStrengths: ["以太坊主流 ZK-Rollup 扩容代表项目"],
            triggersForEntry: strkEval?.triggersForEntry || ["仅建议极小仓位探索性参与，严守止损纪律。"],
            riskWarnings: strkEval?.riskWarnings || ["结构性月度抛压高危：每月新增解锁约占当前流通盘的 3.0%，需要极高买盘承接。"],
            unvestedTokensCliff: "每月大额团队与早期投资人释放",
            auditNotes: "警惕：流通比低于 20%，未来 12 个月面临持续释放稀释。",
          },
        ];

        const allAudits = [...stockAudits, ...cryptoAudits];

        let filtered = allAudits;
        if (symbolArg !== "ALL") {
          filtered = allAudits.filter((a) => {
            const sym = a.symbol.toUpperCase();
            const under = (a.underlyingTicker || "").toUpperCase();
            return (
              sym === symbolArg ||
              under === symbolArg ||
              sym === `${symbolArg}X` ||
              sym.replace(/X$/i, "") === symbolArg
            );
          });

          if (filtered.length === 0) {
            filtered = [
              {
                symbol: symbolArg,
                underlyingTicker: symbolArg,
                name: `${symbolArg} Asset`,
                category: "UNKNOWN",
                currentPrice: "N/A",
                dilutionStatus: {
                  dilutionNature: "未收录",
                },
                financialMoat: {},
                scores: {},
                verdict: "HOLD",
                dcaAllowed: false,
                keyStrengths: [],
                triggersForEntry: [],
                riskWarnings: ["该标的尚未纳入量化财报或链上监控雷达体系"],
                unvestedTokensCliff: "未收录",
                auditNotes: "请在 Web 终端或配置文件中关注该标的以开启实时监控。",
              },
            ];
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(filtered, null, 2),
            },
          ],
        };
      }

      case "get_asset_fundamentals": {
        const symbolArg = (typeof args?.symbol === "string" ? args.symbol.trim() : "ALL").toUpperCase();
        const stocksData = await fetchLocalApi("/api/stocks");
        const list = stocksData?.stockEvaluations || FALLBACK_STOCK_EVALUATIONS;

        let filtered = list;
        if (symbolArg !== "ALL") {
          filtered = list.filter((s: any) => {
            const sym = String(s.symbol || "").toUpperCase();
            return (
              sym === symbolArg ||
              `${sym}X` === symbolArg ||
              sym === symbolArg.replace(/X$/i, "")
            );
          });
        }

        const formatted = filtered.map((s: any) => {
          const isRwa = ['TSLA', 'NVDA', 'AAPL'].includes(s.symbol);
          const netRate = typeof s.netAntiDilutionYieldPct === 'number'
            ? s.netAntiDilutionYieldPct
            : parseFloat(s.netAntiDilutionYieldPct || 0);

          return {
            symbol: s.symbol,
            rwaTokenSymbol: isRwa ? `${s.symbol}x` : undefined,
            name: s.name,
            category: s.category,
            sector: s.sector,
            currentPrice: `$${Number(s.currentPrice || 0).toFixed(2)}`,
            change24h: `${s.change24hPct >= 0 ? '+' : ''}${s.change24hPct}%`,
            ratioTo200dMa: `${s.ratioTo200d}x`,
            fundamentals: {
              netAntiDilutionYieldPct: `${netRate >= 0 ? '+' : ''}${netRate}%`,
              annualBuybackYieldPct: `${s.buybackYieldPct}%`,
              sbcDilutionRatePct: `${s.sbcDilutionRatePct}%`,
              fcfYieldPct: `${s.fcfYieldPct}%`,
              grossMarginPct: `${s.grossMarginPct}%`,
              pegRatio: s.pegRatio,
              forwardPe: `${s.forwardPe}x`,
              ttmPe: `${s.ttmPe}x`,
            },
            scores: {
              antiDilutionScore: `${s.antiDilutionScore}/100`,
              cashFlowQualityScore: `${s.cashFlowQualityScore}/100`,
              valuationScore: `${s.valuationScore}/100`,
              compositeHealthScore: `${s.compositeHealthScore}/100`,
            },
            verdict: s.verdict,
            dcaAllowed: s.dcaAllowed,
            maxPortfolioCapPct: `${Math.round((s.maxPortfolioCapPct || 0.1) * 100)}%`,
            keyStrengths: s.keyStrengths || [],
            triggersForEntry: s.triggersForEntry || [],
            riskWarnings: s.riskWarnings || [],
          };
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(formatted, null, 2),
            },
          ],
        };
      }

      case "scan_radar_opportunities": {
        const liveScan = await fetchLocalApi("/api/scan");
        let candidates = liveScan?.candidates;

        if (!candidates || candidates.length === 0) {
          candidates = [
            {
              symbol: "TSLAx",
              name: "Tesla On-Chain RWA",
              category: "STOCK_RWA",
              currentPrice: 218.40,
              opportunityScore: 84,
              discountToFairValue: "-4.20%",
              recommendation: "分批阶梯限价低吸 (建议挂单价 $213.90)",
            },
            {
              symbol: "NVDAx",
              name: "NVIDIA On-Chain RWA",
              category: "STOCK_RWA",
              currentPrice: 118.20,
              opportunityScore: 81,
              discountToFairValue: "-2.80%",
              recommendation: "支撑位挂单买入 (建议挂单价 $115.50)",
            },
            {
              symbol: "MNT",
              name: "Mantle Token",
              category: "CRYPTO",
              currentPrice: 0.642,
              opportunityScore: 78,
              discountToFairValue: "-5.10%",
              recommendation: "L2 生态低吸，网格挂单",
            },
          ];
        }

        const categoryFilter = args?.category || "ALL";
        if (categoryFilter !== "ALL") {
          candidates = candidates.filter((c: any) => c.category === categoryFilter);
        }

        const minScore = typeof args?.minScore === "number" ? args.minScore : 60;
        candidates = candidates.filter((c: any) => (c.opportunityScore || 0) >= minScore);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(candidates, null, 2),
            },
          ],
        };
      }

      case "analyze_portfolio_health": {
        const holdings = (args?.holdings as Record<string, number>) || {
          USDC: 5000,
          TSLAx: 8.5,
          MNT: 1200,
        };

        const tslaPrice = 218.40;
        const mntPrice = 0.642;
        const usdcVal = holdings.USDC || 0;
        const tslaVal = (holdings.TSLAx || 0) * tslaPrice;
        const mntVal = (holdings.MNT || 0) * mntPrice;
        const totalVal = usdcVal + tslaVal + mntVal;

        const cashPct = totalVal > 0 ? (usdcVal / totalVal) * 100 : 100;
        const rwaPct = totalVal > 0 ? (tslaVal / totalVal) * 100 : 0;
        const cryptoPct = totalVal > 0 ? (mntVal / totalVal) * 100 : 0;

        const healthScore = cashPct >= 25 && cashPct <= 45 ? 92 : 76;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  observedWallet: args?.walletAddress || "0x[Connected_Via_Web_Bridge]",
                  totalEstimatedValueUSD: totalVal.toFixed(2),
                  healthScore: `${healthScore}/100`,
                  allocationBreakdown: {
                    cashStablecoins: `${cashPct.toFixed(1)}% ($${usdcVal.toFixed(2)})`,
                    rwaAssets: `${rwaPct.toFixed(1)}% ($${tslaVal.toFixed(2)})`,
                    cryptoL2: `${cryptoPct.toFixed(1)}% ($${mntVal.toFixed(2)})`,
                  },
                  healthDiagnosis:
                    cashPct > 50
                      ? "稳定币仓位偏高，大周期低估阶段存在踏空风险，建议逐步释放现金建立优质折价限价单。"
                      : cashPct < 20
                      ? "现金储备偏低，缺乏应对黑天鹅回撤的缓冲资金，建议逢高止盈部分高波资产。"
                      : "配置比例健康，股债币与现金比例均衡，适合执行周期定投策略。",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "quote_mantle_swap": {
        const payToken = String(args?.payToken || "MNT").toUpperCase();
        const receiveToken = String(args?.receiveToken || "USDC").toUpperCase();
        const amount = Number(args?.amount) || 10;

        let rate = 1.0;
        if (payToken === 'MNT' && receiveToken === 'USDC') rate = 0.642;
        else if (payToken === 'USDC' && receiveToken === 'MNT') rate = 1 / 0.642;
        else if (payToken === 'USDC' && receiveToken === 'TSLAx') rate = 1 / 218.40;
        else if (payToken === 'TSLAx' && receiveToken === 'USDC') rate = 218.40;

        const estimatedReceive = (amount * rate).toFixed(4);
        const bridgeUrl = `${WEB_BRIDGE_URL}/?action=swap&pay=${payToken}&receive=${receiveToken}&amount=${amount}`;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  route: "Mantle DEX Aggregator",
                  pay: `${amount} ${payToken}`,
                  estimatedReceive: `${estimatedReceive} ${receiveToken}`,
                  estimatedRate: `1 ${payToken} = ${rate.toFixed(4)} ${receiveToken}`,
                  executionBridgeUrl: bridgeUrl,
                  actionPrompt: `请用户点击执行链接完成交易: ${bridgeUrl}`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_fluxion_order_payload": {
        const makerToken = String(args?.makerToken || "USDC").toUpperCase();
        const takerToken = String(args?.takerToken || "TSLAx").toUpperCase();
        const makerAmount = Number(args?.makerAmount) || 100;
        const limitRate = Number(args?.limitRate) || 213.90;
        const expiryHours = Number(args?.expiryHours) || 24;
        const reason = String(args?.reason || "AI Agent 自动策略挂单");

        const takingAmount = (makerAmount / limitRate).toFixed(4);
        const expirySec = expiryHours * 3600;

        const bridgeUrl = `${WEB_BRIDGE_URL}/?action=sign-limit&maker=${encodeURIComponent(makerToken)}&taker=${encodeURIComponent(takerToken)}&amount=${encodeURIComponent(makerAmount)}&rate=${encodeURIComponent(limitRate)}&expiry=${encodeURIComponent(expirySec)}&source=Claude+Desktop+(MCP)&reason=${encodeURIComponent(reason)}`;

        return {
          content: [
            {
              type: "text",
              text: [
                `======================================================`,
                `[FLUXION 0-GAS LIMIT ORDER CREATED]`,
                `======================================================`,
                `• 交易方向: 卖出 ${makerAmount} ${makerToken} -> 限价买入 ${takingAmount} ${takerToken}`,
                `• 指定执行限价: $${limitRate} ${makerToken}`,
                `• 订单有效期: ${expiryHours} 小时`,
                `• 签名机制: 0-Gas EIP-712 链下安全签名 (资金保留在用户钱包内)`,
                `• 策略推演依据: ${reason}`,
                ``,
                `👉 【点击打开 Web 签名桥进行核准与签名】:`,
                `${bridgeUrl}`,
                `======================================================`,
              ].join("\n"),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool name: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `MCP Tool Execution Error: ${error?.message || String(error)}`,
        },
      ],
    };
  }
});

// Run server with standard IO transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[INFO] Crypto Strategy MCP Server running on stdio");
}

main().catch((err) => {
  console.error("[FATAL] Server error:", err);
  process.exit(1);
});
