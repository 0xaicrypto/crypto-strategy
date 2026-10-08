# Crypto Strategy: AI Macro Cycle & Dynamic DCA Engine

> **官方生产域名**：[https://alphanalyzor.trade/](https://alphanalyzor.trade/)  
> **GitHub 仓库**：[https://github.com/0xaicrypto/crypto-strategy](https://github.com/0xaicrypto/crypto-strategy)  
> **设计系统**：遵循 Ondo Finance 机构黑曜石暗黑美学 (Obsidian Slate `#090C15` / `#0E1320`)，严格**零 Emoji**规范。

基于确定性多因子量化模型与 Model Context Protocol (MCP) 的机构级跨资产配置与大周期策略引擎。专注于美股 RWA（1:1 实体映射股票与美债）、加密大盘核心（BTC/ETH）与链上异动资产的周期估值推演、通胀稀释穿透审计与 0-Gas 自动化限价挂单。

---

## 一、 系统架构：量化底层 + MCP Agent + Web 签名桥

本系统采用**分层隔离设计**：将“确定性量化运算”、“AI 认知决策”与“私钥安全签名”彻底解耦：

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. 上层认知决策：Claude Desktop / Cursor / Antigravity (AI Agent 大脑)  │
│    - 负责自然语言人机交互、宏观叙事研判、结合突发事件 (CPI/降息) 综合推演 │
│    - 通过标准化 MCP (Model Context Protocol) 调度底层量化工具箱          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 调度 MCP Tools / 获取客观硬数据
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. 中层量化与风控引擎：Crypto Strategy Core (本地确定性量化系统)       │
│    - 大周期温度计 (5大因子加权)、全网异动雷达、代币经济学稀释审计       │
│    - 跨资产配置矩阵与动态倾斜、Fluxion 0-Gas EIP-712 限价挂单组装        │
│    - 【特点】：100% 确定性算法，无大模型幻觉，零 API Token 消耗，支持全回测 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 生成携带参数的 Execution Bridge 交互链接
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. 终端安全执行：Web 签名桥 (http://localhost:3456 & MetaMask / Privy) │
│    - 浏览器端自动解析 Agent 指令，透明呈现买卖参数与 EIP-712 结构化报文 │
│    - 用户在本地钱包核准并签名，私钥永不暴露给 AI 或命令行                │
│    - 自动广播至 Mantle 订单簿，一键生成执行回执粘回 AI Agent 完成闭环    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 二、 核心策略与数学模型说明

> **注：底层的周期估值、稀释审计与雷达发现全部由确定性数学公式和统计学模型驱动，不依赖外部大模型 API，杜绝随机性与金融幻觉。**

### 1. 资产发现机制 (Multi-Source Quantitative Radar)
代码实现：[`src/engine/scanner.ts`](src/engine/scanner.ts)  
全天候聚合 3 大数据源，通过硬性量化规则筛选异动标的，排除高危投机空气币：

* **DeFiLlama 协议资金异动雷达 (On-Chain TVL Flow)**：
  * **资金门槛**：`TVL > $25,000,000`（排除深度脆弱的微型池）。
  * **爆发门槛**：`7日 TVL 净增长率 > +10%`（捕捉真正获链上增量资金注入的赛道龙头）。
  * **安全评级**：TVL 超过 1 亿美元标记为 `HIGH`，其余为 `MEDIUM`；排除 CEX 平台币。
* **CoinGecko 动量热搜雷达 (Momentum & Trendings)**：
  * 抓取全网实时 Search Trending 榜单。
  * **风控过滤**：自动剔除市值排名在 250 名以外的标的，严控流动性归零风险。
* **Yahoo Finance 美股与加密影子股雷达 (US Equities & Proxies)**：
  * 监控标普核心科技股（NVDA, AAPL, MSFT, TSLA, PLTR 等）及加密影子股（COIN, MSTR, IBIT 等）。
  * **突破条件**（满足任一即入选）：
    1. 逼近 52 周新高（距峰值回撤小于 `-5.0%`）；
    2. 站上 200 日牛熊线（`Ratio to 200D MA >= 1.08x`，确立多头主升加速）；
    3. 日内强脉冲上涨（`>= +1.5%`）；
    4. 股东净反稀释率大于 0（年化回购注销大于 SBC 股权激励）。

---

### 2. 宏观大周期温度计 (Macro Cycle Thermometer)
代码实现：[`src/models/cycle-thermometer.ts`](src/models/cycle-thermometer.ts)  
融合 5 个跨周期宏观估值因子，计算输出 `0 ~ 100` 的周期综合温度分：

$$\text{Temperature Score} = 0.30 \cdot S_{200w} + 0.20 \cdot S_{200d} + 0.20 \cdot S_{\text{Sentiment}} + 0.15 \cdot S_{\text{RSI}} + 0.15 \cdot S_{\text{MVRV}}$$

* **200 周定投牛熊线倍数 ($S_{200w}$, 权重 30%)**：衡量长期大底与泡沫顶部的最硬指标（$\le 1.0x$ 为历史深熊，$\ge 3.8x$ 为泡沫顶）。
* **200 日线偏离度 ($S_{200d}$, 权重 20%)**：衡量中期趋势加速程度（$\le 0.8x$ 超跌，$1.0x$ 公允，$\ge 1.8x$ 超买）。
* **全网恐慌与贪婪情绪 ($S_{\text{Sentiment}}$, 权重 20%)**：$0 \sim 100$ 反映市场极端群体心理。
* **BTC 周线级别 RSI ($S_{\text{RSI}}$, 权重 15%)**：识别大级别超卖（$<35$）与冲顶（$>80$）。
* **MVRV 链上多周期成本代理 ($S_{\text{MVRV}}$, 权重 15%)**：评估全网筹码平均浮盈与潜在获利盘抛压。

**四大宏观体制 (Regime) 与动态定投乘数**：
* **`0 - 25`：极度冰点恐慌期 (CAPITULATION)** -> 乘数 **`2.0x ~ 2.5x`**（历史大底，逆向激进定投加仓）。
* **`26 - 50`：健康积累筑底期 (ACCUMULATION)** -> 乘数 **`1.0x ~ 1.5x`**（公允偏低，标准价值定投）。
* **`51 - 75`：主升浪加速期 (MARKUP)** -> 乘数 **`0.5x ~ 0.0x`**（估值偏高，停止追加现货，享受泡沫）。
* **`76 - 100`：泡沫狂热分发期 (DISTRIBUTION)** -> 乘数 **`0.0x`**，启动 **逆向阶梯止盈 (`SCALE_OUT` / `EXIT`)**，主动卖出 15%~35% 现货兑现为稳定币。

---

### 3. 代币经济学与稀释率穿透审计 (Tokenomics & Dilution Audit)
代码实现：[`src/models/altcoin-evaluator.ts`](src/models/altcoin-evaluator.ts)  
评估非核心标的“配不配获得定投预算”：
* **流通盘比率惩罚 (Float Ratio = MCap / FDV)**：流通盘 $< 25\%$ 重度扣分（扣 45 分，锁定代币抛压高危）。
* **月度结构性通胀率**：每月新增释放 $\ge 2.5\%$ 扣 40 分（如早期 VC 高通胀代币）。
* **实体 RWA 特别准入 (BackedFi TSLAx / NVDAx / bIB01)**：
  * 受瑞士 DLT 法规监管，由银行级托管机构 100% 实体股票 1:1 抵押，**稀释率为 0%，通胀风险为 0%**，赋予最高安全评级。
* **风控红线**：稀释风险过高的代币直接标为 `HOLD`，**当期定投预算强制归零**，拒绝为机构解锁买单。

---

### 4. 跨资产机构级配置矩阵 (Cross-Asset Allocation)
代码实现：[`src/models/cross-asset-allocator.ts`](src/models/cross-asset-allocator.ts)  
基于现代投资组合理论（MPT）与美债/股票风险溢价（ERP）构建全天候底仓：
* **基准目标配置**：
  * **美股优质核心 / RWA 股票 (`TSLAx`, `NVDAx` 等)**：`55%`（高护城河、强自由现金流、净回购反稀释）。
  * **Crypto 大盘核心底仓 (`BTC`, `ETH`)**：`25%`（捕捉大周期爆发性 Alpha）。
  * **短久期美债 RWA / 稳定币现金 (`bIB01`, `USDC`)**：`15%`（稳享约 4.8% 无风险年化生息，备足抄底弹药）。
  * **高 Beta 战术机会 (`Tactical Alts`)**：`5%`（严格控制风险敞口）。
* **跨周期动态倾斜 (Regime Shift)**：
  * **Crypto 处于极度恐慌冰点（温度 < 25）**：从现金与美股中抽调资金，将 Crypto 配置临时提升至 **`35%`** 大胆抄底。
  * **Crypto 处于狂热过热（温度 > 60）而美股低估**：将美股配置提升至 **`65%`**，止盈 Crypto 筹码沉淀为稳健生息资产。

---

## 三、 Model Context Protocol (MCP) Server 接入指南

本项目内置了独立的 MCP Server（基于 `@modelcontextprotocol/sdk`），无需额外依赖，开箱即用。

### 1. 已注册的 10 大核心 MCP 工具（100% 前端镜像对齐 · AI-Frontend Parity）

系统秉承 **AI-Frontend Parity** 架构设计原则：**凡是人类交易者在 Web 前端卡片、指标与图表中能够看到的数据，AI Agent 均能通过 MCP 工具 1:1 获取相同粒度的底层量化信息。**

| 工具名称 (Tool Name) | 功能描述 |
| :--- | :--- |
| **`get_dashboard_snapshot`** | **一键获取当前页面所有宏观大周期、美债利率流动性、目标配置比例、定投执行订单与异动雷达完整快照** |
| `get_cycle_thermometer` | 获取实时大周期温度 (0-100)、BTC 均线倍数、恐贪情绪、建议配置比重与 10Y 美债/美联储利率 |
| `get_allocation_plan` | 获取跨资产大周期配置矩阵、本期分配预算 ($1400) 与动态定投具体执行订单及推演依据 (Rationale) |
| `audit_asset_dilution` | 穿透审计标的净回购通缩率、SBC 股权稀释率、加密代币 FDV/MCap 流通比及锁仓释放风险 |
| `get_asset_fundamentals` | 深度查询美股/RWA 标的 SEC 财报指标、自由现金流收益率 (FCF)、行业垄断护城河与建仓安全边际 |
| `scan_radar_opportunities` | 扫描价值洼地、动量异动、CoinGecko 趋势榜与 DeFiLlama TVL 资金暴增发现雷达 |
| `get_dca_backtest` | 获取 4 年宏观大周期定投历史回测结果（周期动态定投 vs 机械定投 vs 一次性买入收益与最大回撤） |
| `analyze_portfolio_health` | 诊断钱包资产分布、现金储备健康度并输出再平衡操作建议 |
| `quote_mantle_swap` | 查询 Mantle 聚合 DEX 最优兑换路由，输出估算结果与 Web 执行链接 |
| **`create_fluxion_order_payload`** | **组装 Mantle Fluxion 0-Gas EIP-712 限价单报文并生成 Web 签名桥交互链接** |

### 2. 客户端接入配置

#### Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "crypto-strategy": {
      "command": "node",
      "args": [
        "/Users/huizhao/Downloads/workspace/crypto-strategy/mcp/dist/index.js"
      ]
    }
  }
}
```

#### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "crypto-strategy": {
      "command": "node",
      "args": [
        "/Users/huizhao/Downloads/workspace/crypto-strategy/mcp/dist/index.js"
      ],
      "env": {
        "WEB_BRIDGE_URL": "http://localhost:3456"
      }
    }
  }
}
```

---

## 四、 快速启动与日常操作

### 1. 启动 Web 可视化交易与签名桥终端
```bash
npm run web
# 或：npm run dev
```
在浏览器打开：**`http://localhost:3456`**

* **体验 AI Agent 链接唤起**：浏览器访问 `http://localhost:3456/?action=sign-limit&maker=USDC&taker=TSLAx&amount=350&rate=213.90&expiry=86400&source=Claude+Desktop`
* **体验内嵌 Copilot**：点击页面右下角 `AI Copilot` 浮动胶囊直接推演并一键挂单。
* **配置 MCP**：点击右上角 `AI Agent (MCP)` 按钮复制配置。

### 2. 本地重新编译 MCP 模块
```bash
npm run mcp:build
```

### 3. CLI 命令行模式

* **生成本周宏观周期与定投决策周报**：
  ```bash
  npm run analyze
  ```
* **执行全网高潜力资产异动扫描雷达**：
  ```bash
  npm run scan
  ```
* **运行 1400 天跨周期历史回测对比**：
  ```bash
  npm run backtest
  ```

---

## 许可证
MIT License. Developed by 0xaicrypto.
