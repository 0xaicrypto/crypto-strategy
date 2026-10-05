import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectComprehensiveSnapshot } from './data/aggregator.ts';
import { computeCycleTemperature } from './models/cycle-thermometer.ts';
import { evaluateAltcoin } from './models/altcoin-evaluator.ts';
import { computeAllocationPlan } from './models/dynamic-dca.ts';
import { getActiveAssets, addOrWatchAsset, unwatchAsset } from './config/assets.ts';
import { scanMarketOpportunities } from './engine/scanner.ts';
import { runDcaBacktest } from './engine/backtester.ts';
import { fetchHistoricalDailyPrices } from './data/coingecko.ts';
import { fetchAllWatchedStocks } from './data/stocks/yahoo-finance.ts';
import { fetchMacroLiquidityAndRates } from './data/stocks/macro-rates.ts';
import { evaluateStock } from './models/stock-evaluator.ts';
import { computeCrossAssetPlan } from './models/cross-asset-allocator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const PORT = parseInt(process.env.PORT || '3456', 10);

// In-memory cache for status data (5 min TTL)
let cachedStatus: any = null;
let lastStatusFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getSystemStatus(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedStatus && now - lastStatusFetch < CACHE_TTL_MS) {
    return cachedStatus;
  }

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

  // Collect US Stocks & Macro Rates
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

  cachedStatus = {
    timestamp: now,
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
  lastStatusFetch = now;
  return cachedStatus;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // API: System Status & Allocation Plan
    if (pathname === '/api/status') {
      const forceRefresh = url.searchParams.get('refresh') === 'true';
      const status = await getSystemStatus(forceRefresh);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(status));
      return;
    }

    // API: US Stocks & Macro Valuation
    if (pathname === '/api/stocks') {
      const forceRefresh = url.searchParams.get('refresh') === 'true';
      const status = await getSystemStatus(forceRefresh);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        timestamp: status.timestamp,
        macroRates: status.macroRates,
        stockEvaluations: status.stockEvaluations,
        crossAssetPlan: status.crossAssetPlan,
      }));
      return;
    }

    // API: Run Market Scanner
    if (pathname === '/api/scan') {
      const candidates = await scanMarketOpportunities();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ timestamp: Date.now(), candidates }));
      return;
    }

    // API: Run Historical Backtest
    if (pathname === '/api/backtest') {
      const btcHistory = await fetchHistoricalDailyPrices('bitcoin', 1400);
      const result = runDcaBacktest(btcHistory, 500);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    // API: Watch / Follow an Asset
    if (req.method === 'POST' && pathname === '/api/assets/watch') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload.symbol) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing symbol' }));
            return;
          }
          const saved = addOrWatchAsset(payload);
          cachedStatus = null; // Clear cache so it updates on next request
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, asset: saved, message: `已成功关注 $${saved.symbol} 并纳入监控体系` }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
      return;
    }

    // API: Unwatch an Asset
    if (req.method === 'POST' && pathname === '/api/assets/unwatch') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload.symbol) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing symbol' }));
            return;
          }
          unwatchAsset(payload.symbol);
          cachedStatus = null; // Clear cache
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, message: `已取消关注 $${payload.symbol}` }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
      return;
    }

    // Static Files (Frontend UI)
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Fallback to index.html for SPA
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 AI Crypto Strategy Web Dashboard running at:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
