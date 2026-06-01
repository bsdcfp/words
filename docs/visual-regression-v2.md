# V2 逐页视觉回归

日期：2026-06-01

## 范围

- 目标主题：浅色主题。
- Reference：`docs/design-outputs/page-references-v2-imagegen/light/`。
- 当前截图、diff 和分数：`docs/design-outputs/visual-regression-v2/light/report.md`。
- 小程序导航栏采用微信默认导航栏，因此视觉比较以小程序页面主体为准，Reference 中生成的 iOS 状态栏区域会在脚本里裁掉。

## 已完成

- 建立 16 个页面/状态的视觉回归入口：`/pages/index/index?visual=<page-id>`。
- 新增自动化脚本：`npm run visual:regression`。
- 新增离线重算脚本：`npm run visual:regression:compare`。
- 生成 16 页 current screenshot、diff 图和逐页分数。
- 第一轮修正了浅色主题里残留的深色覆盖、选择水平页、学习流页、词卡弹窗文字可读性和底部按钮层级。

## 当前分数

最近一次完整可比对报告平均分：87.3。

已达到或接近 90 的页面：

- `02-level-select`：93.3
- `03-entry-assessment`：95.9
- `06-pre-learning-scan`：94.2
- `07-memorize`：90.8
- `09-recall-before-reveal`：91.5
- `11-listening`：92.6
- `15-profile-settings`：92.6

仍需继续收敛的页面：

- `04-assessment-result`：结果页内容结构与 Reference 差异较大。
- `05-home-normal`：首页卡片结构仍偏产品旧版。
- `08-word-detail-modal`：弹窗内容已变清晰，但布局仍未完全贴合 Reference。
- `10-recall-after-reveal`：揭示态底部卡片高度和内容层级仍有差异。
- `14-celebration`：完成页仍是旧总结卡片，不是 Reference 的庆祝页结构。
- `16-monthly-stage-test`：月度进展页与阶段测 Reference 结构仍需拆分对齐。

## 工具注意

微信开发者工具的 `App.captureScreenshot` 在多次连续截图后偶发超时。当前脚本会记录已完成页面并写出报告；如果截图端口卡住，先关闭开发者工具后重跑。

## Figma Reference 流程

直接拿 PNG Reference 对小程序追像素会持续偏差，主要原因是微信默认导航栏、状态栏安全区、rpx 换算、字体渲染和真实内容长度都会改变最终视觉。

新的流程：

- 运行 `npm run figma:references`。
- 生成 Figma 可导入整板：`docs/design-outputs/figma-reference-board-v2/light-reference-board.svg`、`docs/design-outputs/figma-reference-board-v2/dark-reference-board.svg`。
- 在 Figma 中拖入 SVG，对 16 个页面拆解为页面结构、组件、间距 token、字体等级和状态规则。
- 小程序实现以 Figma 拆出的结构规格为准，而不是继续直接对 PNG 猜尺寸。

Figma 拆解时优先产出：

- 页面骨架：默认导航栏下方的内容安全区、固定底部栏、可滚动区域。
- 组件规格：学习卡、按钮组、选项卡、Toast、进度卡、底部导航。
- 主题 token：浅色默认、深色可切换，颜色来源保持青榕炽橙体系。
- 适配规则：不同屏宽下卡片宽度、左右边距、按钮最小点击区域和文字换行策略。
