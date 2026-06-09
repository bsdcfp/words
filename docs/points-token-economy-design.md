# 积分 × Token 经济系统设计（AI 飞轮）

## 状态

- 日期：2026-06-04
- 状态：Draft / 待评审（数值为默认建议，标 🔧 处需拍板）
- 来源：基于产品讨论「积分换 Token」需求 + 现有代码机制（`utils/study-flow.js` / `utils/storage.js` / `data/usage.js`）
- 决策前提：**Token = AI 生成额度**（不是可提现代币，不涉及合规/钱）

---

## 1. 背景与目标

小程序定位「**AI 飞轮单词**」。本系统把"学习行为"和"AI 能力"接成一个自增强闭环：

```
        学习 / 复习  ──赚──▶  积分
            ▲                   │
            │                   │ 兑换
        学得更好                ▼
            │                  Token（AI 生成额度）
            └──驱动──  AI 个性化内容  ◀──消费──┘
              （例句 / 助记 / 对话 / 讲解）
```

- **积分（points）**：学习产出的"软通货"，只进不退、按行为累计。衡量"今天学了多少"。
- **Token**：AI 生成额度，**消耗品**。用积分兑换，调用 AI 生成内容时扣减。
- **飞轮**：学得多 → 积分多 → 换更多 Token → 解锁更多 AI 个性化内容 → 内容更贴合 → 学得更好 → 积分更多。

> 现状：系统**尚不存在**。成果页的「专注之星 / +120 积分」与 `gold-star-token` 图标都是写死占位（见 `buildReportData`）。本设计从零落地。

---

## 2. Token 定义：AI 生成额度

Token 用于解锁/驱动 **AI 生成的学习内容**。app 已有 `data/usage.js` 的 `aiFallback`（`contentType: "ai_fallback"`）机制作为接入点。

**消费 Token 的场景（建议）**

| 场景 | 说明 | 单次成本 🔧 |
|---|---|---|
| AI 例句 / 搭配 | 当前词无词典内容时，AI 生成个性化例句 | 1 Token |
| AI 助记图/谐音 | 为难词生成记忆画面（`memoryImage`） | 2 Token |
| AI 词义讲解 | "为什么记不住"——AI 拆解词根/对比近义 | 2 Token |
| AI 对话练习 | 用今日词造一段对话/情景 | 3 Token |

- 没 Token 时，这些入口显示"灰态 + 用 X Token 解锁"。
- 词典已有内容**免费**（不耗 Token），只有 AI 生成才耗。保证基础学习永远可用。

---

## 3. 积分获取规则（earning）

> 原则：奖励"真实学习产出"，不奖励"点点点"。每条都接在现有代码的真实事件上。

| 行为 | 积分 | 代码挂点 | 防重复 |
|---|---|---|---|
| 学会新词（首次「记住了」） | **+10** 🔧 | `answerChoiceQuestion` pass，且该词 `scoredFirstLearn` 未置位 | 每词仅首次 |
| 复习答对（每题） | **+2** 🔧 | `answerChoiceQuestion` / `answerRecallQuestion` pass | 每日每词每环节封顶 1 次 |
| 完成 1 个 List | **+30** 🔧 | `completeCurrentList` | 天然不重复 |
| 错词巩固（每词移出错词本） | **+5** 🔧 | `isInWrongBook` 由 true 变 false 时（连对 2 次） | 每次移出计 1 次 |
| 每日打卡 | **+20**，连续每多 1 天 **+5**（封顶 **+50**）🔧 | `markDailyCheckin` | 每日 1 次 |
| 阶段测 | **+ round(正确率/2)**（80% → +40）🔧 | 阶段测 `buildStageTestResult` 完成时 | 每次测验计 1 次 |

**每日积分上限**：🔧 默认 **300/日**（防刷 + 防止一天刷爆经济）。超出部分不计，UI 提示"今日积分已达上限"。

---

## 4. 积分 → Token 兑换

- **兑换比例**：🔧 默认 **100 积分 = 10 Token**（即 10:1）。比例应由"Token 平均成本 × 期望日产出"反推：若一天正常学满约赚 ~200 积分 ≈ 20 Token ≈ 够 ~10 次 AI 调用。
- **兑换粒度**：按档兑换（10 / 50 / 100 Token），或自由输入；兑换前弹确认。
- **方向**：单向（积分 → Token）。Token **不退回**积分。
- **约束**：积分不足不可兑换；Token 余额无上限（或设软上限 🔧）。
- **流水**：每次兑换/消费写一条 `ledger` 记录，可在「我的」查看。

---

## 5. 数据结构

挂在 `state.user` 下（`utils/storage.js` 的 `defaultState` 增字段 + `normaliseState` 兜底）：

```js
user: {
  // ... 现有字段
  points: 0,            // 当前可用积分
  pointsTotal: 0,       // 历史累计积分（只增，用于展示/成就）
  pointsToday: 0,       // 今日已得积分（配每日上限，跨日重置）
  pointsTodayKey: "",   // 今日日期 key，用于跨日重置 pointsToday
  tokens: 0,            // 当前 Token 余额
  ledger: [             // 流水（倒序，截断保留最近 N 条）
    // { id, type: "earn"|"exchange"|"spend", amount, balanceAfter, reason, at }
  ]
}
```

每词的"首次学习已计分"标记，挂在 `userWordStates[id]`：

```js
userWordStates[id]: {
  // ... 现有字段（familiarity / wrongCount / reviewStage ...）
  scoredFirstLearn: true   // 首次学会已计分，避免重复刷
}
```

---

## 6. 计分时机与实现挂点

为避免散落，建议在 `utils/study-flow.js` 内集中一个 `awardPoints(state, reason, amount)` 函数：

- 统一处理：今日上限、`pointsToday` 跨日重置、累计、写 `ledger`。
- 各事件只调用它，不直接改字段。

接入点（均为现有函数）：

| 事件 | 函数 |
|---|---|
| 答对/记住了 | `answerChoiceQuestion`、`answerRecallQuestion`（注意：recall 当前**未清 wrongCount**，需先统一，见下） |
| 完成 List | `completeCurrentList` |
| 打卡 | `markDailyCheckin` |
| 错词清零 | 在 `wrongCount` 归零处统一触发 |
| 阶段测完成 | `answerAssessmentQuestion`（stage 分支）/ `buildStageTestResult` |

> **错词本模型（已修正，2026-06-04）**：`wrongCount` 现在是**纯累计答错次数**（答对不再清零）。错词本成员由 `isInWrongBook(wordState)` 派生 = `wrongCount > 0 且 correctStreak < 2`（连对 2 次才移出）。手动「已掌握」走 `consolidateWordState`（提升 streak 出库、保留累计）。"错词巩固 +积分"挂在 `isInWrongBook` 由 true→false 的时刻。

---

## 7. UI 触点

- **顶部/我的页**：积分余额 + Token 余额小徽标（复用 `gold-star-token` 图标）。
- **每日成果页**：把写死的「+120 积分」换成**本轮真实所得**（明细：新词 +X / 复习 +Y / 打卡 +Z），并展示 → 可兑换 Token 提示。
- **兑换页 / 弹窗**：积分 → Token，选档 + 确认 + 流水。
- **AI 内容入口**：词卡里 AI 例句/助记/对话按钮，显示"用 X Token 解锁"，余额不足引导去兑换。
- **称号联动**（呼应第 3 问）：把"专注之星"做成**真实可获得**称号之一（如"连续 7 天""错词清零 50 个"），与积分里程碑挂钩。

---

## 8. 边界与异常

- **跨日重置**：`pointsToday` 按本地日期 key 重置（参考现有 `localDateKey`）。
- **离线/重复点击**：计分幂等——靠 `scoredFirstLearn`、每日每词每环节封顶。
- **数据迁移**：老用户无 points/tokens 字段 → `normaliseState` 兜底为 0、`ledger` 为 []。
- **数据重置**：现有「数据重置」会清空，无需特殊处理。
- **防负数**：兑换/消费前校验余额，不足则拦截。
- **ledger 体积**：只保留最近 🔧 100 条，避免 storage 膨胀。

---

## 9. 分期落地建议

1. **P0（地基）**：state 字段 + `awardPoints` + 跨日重置 + recall 清零修复 + 成果页真实积分。**先让积分真实跑起来、可见。**
2. **P1（兑换）**：Token 余额 + 兑换页/弹窗 + 流水 + 顶部徽标。
3. **P2（消费闭环）**：AI 内容入口接 Token 扣费（先 mock AI，跑通扣费/解锁），再接真实 AI 生成。
4. **P3（打磨）**：称号体系真实化、积分明细动画、上限提示、排行/成就。

---

## 10. 开放问题（落地前需确认 🔧）

1. 各项积分数值、每日上限（300）是否合适？
2. 兑换比例（100:10）按什么基准？需要 Token 单次 AI 成本的量级估计。
3. AI 消费场景优先做哪几个（例句 / 助记 / 讲解 / 对话）？
4. Token 是否设余额上限 / 是否会过期？
5. 称号体系是否纳入本期一起做（与积分里程碑强相关）？
