import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectComprehensiveSnapshot } from './data/aggregator.ts';
import { computeCycleTemperature } from './models/cycle-thermometer.ts';
import { evaluateAltcoin } from './models/altcoin-evaluator.ts';
import { computeAllocationPlan } from './models/dynamic-dca.ts';
import { getActiveAssets } from './config/assets.ts';
import { scanMarketOpportunities } from './engine/scanner.ts';
import { runDcaBacktest } from './engine/backtester.ts';
import { fetchHistoricalDailyPrices } from './data/coingecko.ts';
import { fetchAllWatchedStocks } from './data/stocks/yahoo-finance.ts';
import { fetchMacroLiquidityAndRates } from './data/stocks/macro-rates.ts';
import { evaluateStock } from './models/stock-evaluator.ts';
import { computeCrossAssetPlan } from './models/cross-asset-allocator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');

async function buildStaticData() {
  console.log('⚡ [1/4] Collecting live market snapshot & cycle temperature...');
  const snapshot = await collectComprehensiveSnapshot();
  const btcMarket = snapshot.marketData.get('BTC');
  const btcPrice = btcMarket?.currentPrice ?? 65000;

  const cycle = computeCycleTemperature({
    btcPrice,
    ma200w: snapshot.btcMovingAverages.ma200w,
    ma200d: snapshot.btcMovingAverages.ma200d,
    weeklyRsi: snapshot.btcRsiWeekly,
    fearAndGreed: snapshot.sentiment.value,
  });

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

  const currentHoldings = {
    btc: 25000,
    eth: 8000,
    alts: Object.fromEntries(nonCoreAssets.map((a) => [a.symbol, 500])),
    cash: 5000,
  };

  const plan = computeAllocationPlan(cycle, altEvaluations, currentHoldings);

  console.log('⚡ [1.5/4] Collecting US equities & macro rates...');
  let macroRates = null;
  let stockEvaluations: any[] = [];
  let crossAssetPlan = null;
  try {
    const liveStocks = await fetchAllWatchedStocks();
    stockEvaluations = liveStocks.map(evaluateStock);
    macroRates = await fetchMacroLiquidityAndRates();
    crossAssetPlan = computeCrossAssetPlan(cycle, macroRates, stockEvaluations, altEvaluations);
  } catch (err) {
    console.error('Failed to compute stock evaluations or macro rates:', err);
  }

  const statusData = {
    timestamp: Date.now(),
    cycle,
    sentiment: snapshot.sentiment,
    altEvaluations,
    plan,
    activeAssets,
    holdings: currentHoldings,
    macroRates,
    stockEvaluations,
    crossAssetPlan,
  };

  const stocksData = {
    timestamp: Date.now(),
    macroRates,
    stockEvaluations,
    crossAssetPlan,
  };

  console.log('⚡ [2/4] Scanning market opportunities...');
  const candidates = await scanMarketOpportunities();
  const scanData = {
    timestamp: Date.now(),
    candidates,
  };

  console.log('⚡ [3/4] Running 1400-day historical DCA backtest...');
  const btcHistory = await fetchHistoricalDailyPrices('bitcoin', 1400);
  const backtestData = runDcaBacktest(btcHistory, 500);

  // Ensure directories exist
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(path.join(DIST_DIR, 'data'), { recursive: true });
  fs.mkdirSync(path.join(DIST_DIR, 'fonts'), { recursive: true });

  // Write static data files to public/data and dist/data
  console.log('⚡ [4/4] Writing static JSON and copying web assets...');
  fs.writeFileSync(path.join(DATA_DIR, 'status.json'), JSON.stringify(statusData, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DATA_DIR, 'stocks.json'), JSON.stringify(stocksData, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DATA_DIR, 'scan.json'), JSON.stringify(scanData, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DATA_DIR, 'backtest.json'), JSON.stringify(backtestData, null, 2), 'utf-8');

  fs.writeFileSync(path.join(DIST_DIR, 'data', 'status.json'), JSON.stringify(statusData, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DIST_DIR, 'data', 'stocks.json'), JSON.stringify(stocksData, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DIST_DIR, 'data', 'scan.json'), JSON.stringify(scanData, null, 2), 'utf-8');
  fs.writeFileSync(path.join(DIST_DIR, 'data', 'backtest.json'), JSON.stringify(backtestData, null, 2), 'utf-8');

  // Copy HTML, Fonts and JS bundles
  fs.copyFileSync(path.join(PUBLIC_DIR, 'index.html'), path.join(DIST_DIR, 'index.html'));
  const fonts = fs.readdirSync(path.join(PUBLIC_DIR, 'fonts'));
  for (const font of fonts) {
    fs.copyFileSync(path.join(PUBLIC_DIR, 'fonts', font), path.join(DIST_DIR, 'fonts', font));
  }
  if (fs.existsSync(path.join(PUBLIC_DIR, 'js'))) {
    fs.mkdirSync(path.join(DIST_DIR, 'js'), { recursive: true });
    const jsFiles = fs.readdirSync(path.join(PUBLIC_DIR, 'js'));
    for (const js of jsFiles) {
      fs.copyFileSync(path.join(PUBLIC_DIR, 'js', js), path.join(DIST_DIR, 'js', js));
    }
  }

  // Create .nojekyll & CNAME in dist and public
  fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '', 'utf-8');
  fs.writeFileSync(path.join(PUBLIC_DIR, '.nojekyll'), '', 'utf-8');
  fs.writeFileSync(path.join(DIST_DIR, 'CNAME'), 'alphanalyzor.trade\n', 'utf-8');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'CNAME'), 'alphanalyzor.trade\n', 'utf-8');

  console.log('✅ Static build complete in dist/ and public/data!');
}

buildStaticData().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
