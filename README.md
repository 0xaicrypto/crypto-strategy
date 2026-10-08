# AI Crypto Cycle & DCA Engine (TypeScript)

> **官方生产域名**：[https://alphanalyzor.trade/](https://alphanalyzor.trade/)  
> **GitHub 镜像**：[https://0xaicrypto.github.io/crypto-strategy/](https://0xaicrypto.github.io/crypto-strategy/)

AI 驱动的加密资产宏观大周期温度计、动态价值定投与结构性稀释风控系统。基于现代 TypeScript（Node.js 24/26 原生 ESM 与 Strip-Types）实现，不依赖重量级外部打包工具。

---

## 核心特性

1. **宏观大周期温度计 (0 ~ 100)**：
   - 综合 BTC 200 周定投牛熊线 (MA200W)、200 日线、全网恐慌与贪婪指数、周线 RSI 与 MVRV 估值偏离度。
   - 自动识别 4 个周期状态：`极度冰点恐慌期`、`健康积累筑底期`、`主升浪发酵期`、`狂热泡沫分发期`。
2. **动态价值定投乘数 (Dynamic DCA)**：
   - 告别固定金额定投：底部冰点期以 **2.5x** 集中低成本吸筹；主升浪与过热期停止追高（0x）甚至触发阶梯逆向定抛止盈。
3. **山寨/L2 专项稀释与风控审计 (以 Starknet $STRK 为例)**：
   - 针对低流通、高 FDV 代币：计算流通比例与每月结构性解锁抛压（如 STRK 每月 3% 解锁）。
   - 强制执行 3%~5% 单一资产仓位硬上限，杜绝重仓跑输 BTC 的价值陷阱。
4. **全网异动自动发现雷达 (Automated Discovery)**：
   - 实时监控 DeFiLlama 链上 TVL 30天爆发增长与 CoinGecko 实时 Trending 主线热点。
5. **现代可视化 Web 前端 Dashboard**：
   - 内置纯纯原生响应式金融看板，支持实时刷新、回测模拟、异动扫描与资金指令生成。

---

## 快速启动

### 1. 启动 Web 可视化前端看板
```bash
cd /Users/huizhao/Downloads/workspace/crypto-strategy
npm run web
# 或：node --experimental-strip-types src/server.ts
```
在浏览器打开：**`http://localhost:3456`**

### 2. CLI 命令行模式

* **生成本周宏观周期与定投决策周报**：
  ```bash
  npm run analyze
  # 或：node --experimental-strip-types src/index.ts
  ```

* **执行全网高潜力资产异动扫描雷达**：
  ```bash
  npm run scan
  # 或：node --experimental-strip-types src/index.ts scan
  ```

* **运行 1400 天跨周期历史回测对比**：
  ```bash
  npm run backtest
  # 或：node --experimental-strip-types src/index.ts backtest
  ```

---

## 配置文件与监控资产管理

所有关注资产均在 [`src/config/assets.ts`](src/config/assets.ts) 中声明：
- 启用/关闭已有代币：修改 `enabled: true / false`
- 添加新标的：在 `WATCHED_ASSETS` 中复制一条配置（填写 symbol、coingeckoId、风控上限 maxPortfolioCapPct）。
