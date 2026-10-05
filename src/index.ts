import { collectComprehensiveSnapshot } from './data/aggregator.ts';
import { computeCycleTemperature } from './models/cycle-thermometer.ts';
import { evaluateAltcoin } from './models/altcoin-evaluator.ts';
import { computeAllocationPlan } from './models/dynamic-dca.ts';
import { generateAdvisorReport } from './engine/advisor.ts';
import { runDcaBacktest } from './engine/backtester.ts';
import { fetchHistoricalDailyPrices } from './data/coingecko.ts';
import { getActiveAssets } from './config/assets.ts';
import { scanMarketOpportunities, formatDiscoveryReport } from './engine/scanner.ts';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'analyze';

  console.log(`\n======================================================`);
  console.log(`🤖 AI Crypto Investment & Cycle Position System (TS)`);
  console.log(`======================================================\n`);

  if (command === 'backtest') {
    await handleBacktest();
    return;
  }

  if (command === 'scan') {
    await handleScan();
    return;
  }

  // Default: Full Cycle & Asset Analysis
  await handleAnalysis();
}

async function handleScan() {
  const candidates = await scanMarketOpportunities();
  console.log('\n' + formatDiscoveryReport(candidates) + '\n');
}

async function handleAnalysis() {
  // 1. Gather all data feeds
  const snapshot = await collectComprehensiveSnapshot();

  const btcMarket = snapshot.marketData.get('BTC');
  const btcPrice = btcMarket?.currentPrice ?? 65000;

  // 2. Compute BTC Cycle Temperature & Regime
  const cycle = computeCycleTemperature({
    btcPrice,
    ma200w: snapshot.btcMovingAverages.ma200w,
    ma200d: snapshot.btcMovingAverages.ma200d,
    weeklyRsi: snapshot.btcRsiWeekly,
    fearAndGreed: snapshot.sentiment.value,
  });

  // 3. Evaluate Target Altcoins from active configuration
  const activeAssets = getActiveAssets();
  const altEvaluations = [];

  const nonCoreAssets = activeAssets.filter((a) => a.category !== 'CORE' && a.category !== 'CASH');
  for (const asset of nonCoreAssets) {
    const market = snapshot.marketData.get(asset.symbol);
    const tokenomics = snapshot.tokenomics.get(asset.symbol);
    const l2Metrics = snapshot.l2Metrics.get(asset.symbol);
    if (market && tokenomics) {
      altEvaluations.push(evaluateAltcoin(market, tokenomics, l2Metrics));
    }
  }

  // 4. Compute Dynamic DCA Allocation Plan
  // (可根据你的实际持仓修改此处金额，或设为 0 从头启动)
  const currentHoldings = {
    btc: 25000,
    eth: 8000,
    alts: Object.fromEntries(nonCoreAssets.map((a) => [a.symbol, 500])),
    cash: 5000,
  };

  const plan = computeAllocationPlan(cycle, altEvaluations, currentHoldings);

  // 5. Run Market Discovery Scanner for Emerging Opportunities
  const discovered = await scanMarketOpportunities();
  const discoveryReport = formatDiscoveryReport(discovered);

  // 6. Generate and Output Advisor Report
  const report = generateAdvisorReport({
    cycle,
    sentiment: snapshot.sentiment,
    altcoinEvaluations: altEvaluations,
    plan,
  });

  console.log('\n' + report + '\n\n' + discoveryReport + '\n');
}

async function handleBacktest() {
  console.log('⏳ Running multi-year historical backtest (Naive DCA vs AI Dynamic DCA)...');
  const btcHistory = await fetchHistoricalDailyPrices('bitcoin', 1400);
  const result = await runDcaBacktest(btcHistory, 500);

  console.log(`\n================ 回测对比结果 (1400 天完整周期) ================`);
  console.log(`📅 回测天数: ${result.periodDays} 天 (约 3.8 年，跨越熊市与牛市)`);
  console.log(`💵 基准定投: 每周 $500 USD\n`);

  console.log(`[策略 A: 传统固定傻瓜定投 (Naive DCA)]`);
  console.log(`  - 累计投入总本金:   $${result.totalInvestedNaive.toLocaleString()}`);
  console.log(`  - 期末持仓资产总值: $${result.finalValueNaive.toLocaleString()}`);
  console.log(`  - 最终投资回报率:   ${result.roiNaivePct}%`);
  console.log(`----------------------------------------------------------------`);

  console.log(`[策略 B: AI 动态价值定投 (AI Dynamic Value DCA)]`);
  console.log(`  - 累计投入总本金:   $${result.totalInvestedDynamic.toLocaleString()}`);
  console.log(`  - 止盈后现金储备:   $${result.cashRemainingInReserve.toLocaleString()}`);
  console.log(`  - 期末总资产估值:   $${result.finalValueDynamic.toLocaleString()} (含锁定现金)`);
  console.log(`  - 最终综合回报率:   ${result.roiDynamicPct}%`);
  console.log(`----------------------------------------------------------------`);

  console.log(`🏆 AI 动态定投超额收益率: +${result.outperformancePct}%`);
  console.log(`💡 核心归因: AI 在 200 周线下方以 2.5x 乘数集中大量低价筹码，并在高估过热区自动定抛锁定利润。\n`);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
