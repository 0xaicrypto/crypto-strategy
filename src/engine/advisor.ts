import type {
  CycleMetrics,
  AltcoinEvaluation,
  SentimentData,
} from '../types/index.ts';
import type { AllocationPlan } from '../models/dynamic-dca.ts';

export interface AdvisorReportInput {
  cycle: CycleMetrics;
  sentiment: SentimentData;
  altcoinEvaluations: AltcoinEvaluation[];
  plan: AllocationPlan;
}

export function generateAdvisorReport(data: AdvisorReportInput): string {
  const { cycle, sentiment, altcoinEvaluations, plan } = data;
  const now = new Date().toISOString().slice(0, 10);

  const lines: string[] = [];

  lines.push(`# AI 加密资产宏观周期与动态定投决策周报`);
  lines.push(`> 生成时间：**${now}** | 策略核心：**宏观周期温度计 + 动态价值定投 + 结构性风控**\n`);

  // Section 1: Cycle Thermometer
  lines.push(`## 一、 BTC 宏观周期温度计与状态机识别`);
  lines.push(`* **当前周期温度**：\`${cycle.temperatureScore} / 100\` (${formatRegimeBadge(cycle.regime)})`);
  lines.push(`* **当前市场信号**：**${cycle.signal}** (动态定投乘数: \`${cycle.dcaMultiplier}x\`)`);
  lines.push(`* **核心参考基准**：`);
  lines.push(`  * BTC 当前价格：\`$${cycle.currentPrice.toLocaleString()}\``);
  lines.push(`  * 200 周定投牛熊线 (MA200W)：\`$${cycle.ma200w.toLocaleString()}\` (偏离度: \`${cycle.ratioTo200w}x\`)`);
  lines.push(`  * 200 日均线 (MA200D)：\`$${cycle.ma200d.toLocaleString()}\` (偏离度: \`${cycle.ratioTo200d}x\`)`);
  lines.push(`  * 周线 14 周期 RSI：\`${cycle.rsiWeekly}\``);
  lines.push(`  * 全网情绪指数：\`${sentiment.value} / 100\` (${sentiment.classification}, 30日均值: \`${sentiment.historicalAvg30d}\`)`);
  lines.push(`* **AI 周期诊断**：${cycle.summary}\n`);

  // Section 2: Altcoin Focus (Starknet STRK & Comps)
  lines.push(`## 二、 垂直赛道与山寨资产风险深度审计（以 Starknet 为例）`);
  for (const alt of altcoinEvaluations) {
    lines.push(`### 资产：${alt.name} ($${alt.symbol}) - 评估结论：[${alt.verdict}]`);
    lines.push(`* **综合健康度得分**：\`${alt.compositeHealthScore} / 100\``);
    lines.push(`* **稀释与解锁风险评分**：\`${alt.dilutionRiskScore} / 100\` ${alt.dilutionRiskScore > 70 ? '[CRITICAL] (极高抛压)' : '[NORMAL] (正常)'}`);
    lines.push(`* **生态产品力得分**：\`${alt.ecosystemTractionScore} / 100\``);
    lines.push(`* **相对估值性价比**：\`${alt.relativeValuationScore} / 100\``);
    lines.push(`* **投资组合硬上限**：\`${(alt.maxPortfolioCapPct * 100).toFixed(1)}%\``);
    lines.push(`* **当前是否允许开启定投**：**${alt.dcaAllowed ? '允许 (右侧小额)' : '[RESTRICTED] 禁止定投 (防价值陷阱)'}**`);

    if (alt.riskWarnings.length > 0) {
      lines.push(`* **风控告警项**：`);
      for (const w of alt.riskWarnings) {
        lines.push(`  * [WARN] ${w}`);
      }
    }

    if (alt.triggersForEntry.length > 0) {
      lines.push(`* **AI 观察进入条件（需满足右侧信号）**：`);
      for (const t of alt.triggersForEntry) {
        lines.push(`  * [TRIGGER] ${t}`);
      }
    }
    lines.push('');
  }

  // Section 3: Actionable DCA Execution Plan
  lines.push(`## 三、 本期资金分配与操作指令（Execution Plan）`);
  lines.push(`* **本期总投资预算**：**$${plan.periodDcaBudgetUsd} USD** (基准: $500 × ${cycle.dcaMultiplier}x)`);
  lines.push('');
  lines.push(`| 标的 | 操作指令 | 本期执行金额 | 组合建议权重 | 执行逻辑与依据 |`);
  lines.push(`| :--- | :---: | :---: | :---: | :--- |`);

  for (const alloc of plan.allocations) {
    const actionBadge = alloc.action === 'BUY' ? '[BUY]' : alloc.action === 'SELL' ? '[SELL]' : '[HOLD]';
    lines.push(`| **${alloc.symbol}** | ${actionBadge} | **$${alloc.amountUsd}** | ${alloc.weightPct}% | ${alloc.rationale} |`);
  }
  lines.push('');

  // Section 4: Target Portfolio Weights
  lines.push(`## 四、 宏观周期组合目标分布（Target Portfolio Balance）`);
  lines.push(`* **BTC 核心底仓**：\`${(plan.targetPortfolioWeights.btc * 100).toFixed(0)}%\``);
  lines.push(`* **ETH 次核心**：\`${(plan.targetPortfolioWeights.eth * 100).toFixed(0)}%\``);
  for (const [sym, weight] of Object.entries(plan.targetPortfolioWeights.alts)) {
    lines.push(`* **${sym} (山寨/L2)**：上限 \`${(weight * 100).toFixed(1)}%\``);
  }
  lines.push(`* **现金 / USD 稳定币防守仓**：\`${(plan.targetPortfolioWeights.cashOrStablecoins * 100).toFixed(0)}%\``);
  lines.push('');

  // Section 5: Risk Reminders
  lines.push(`---`);
  lines.push(`### 核心风控军规：`);
  lines.push(`1. **严禁在牛市中途自作聪明卖飞底仓**：只有当大周期温度计触及 75 以上狂热分发区时，才开启阶梯分批逆向止盈。`);
  lines.push(`2. **杜绝将 VC 稀释代币（如 STRK）当成 BTC 长期重仓**：严格遵守单个山寨不超过 3%~5% 的上限，保护主本金安全。`);
  lines.push(`3. **坚持动态价值乘数**：跌破 200 周牛熊线时坚定加码，狂热泡沫期坚决不追高。`);

  return lines.join('\n');
}

function formatRegimeBadge(regime: string): string {
  switch (regime) {
    case 'CAPITULATION':
      return '极度冰点恐慌期';
    case 'ACCUMULATION':
      return '健康积累筑底期';
    case 'MARKUP':
      return '主升浪发酵期';
    case 'DISTRIBUTION':
      return '狂热泡沫分发期';
    default:
      return regime;
  }
}
