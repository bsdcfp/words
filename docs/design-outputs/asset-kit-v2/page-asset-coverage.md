# 32 张 Reference 资产覆盖确认

日期：2026-06-02
检查对象：

- `docs/design-outputs/page-references-v2-imagegen/light/*.png`
- `docs/design-outputs/page-references-v2-imagegen/dark/*.png`
- `docs/design-outputs/asset-kit-v2/`

结论：当前 Asset Kit 是基于 32 张 Reference 的页面体系整理出来的核心复用素材包，不是随机基于 8 张图生成。已覆盖多数跨页复用素材；仍有少量页面专属场景插画可补。

---

## 检查口径

| 类型 | 处理 |
|---|---|
| 重复出现、带质感、难以用 CSS 复刻 | 放入 Asset Kit |
| 简单线性图标 | 用 SVG/iconfont，不进入 Asset Kit |
| 按钮、卡片、圆点、进度、列表行 | 用 WXML/WXSS，不进入 Asset Kit |
| 汉字、英文、音标、数字、用户数据 | 用 WXML 文本，不进入 Asset Kit |
| 页面专属大场景 | 如多页复用则补资产；只出现一次则可按页面背景/插画单独处理 |

---

## 逐页覆盖矩阵

| # | 页面 | 浅色 Reference 主要素材 | 深色 Reference 主要素材 | 当前覆盖 | 结论 |
|---|---|---|---|---|---|
| 01 | 新用户首页 | 桌面书本、植物、杯子/铅笔、单词书卡、底部 Tab 图标 | 台灯、书堆、打开的书、植物、深色单词书卡 | `study-desk-light`、`dark-study-desk`、`light-illustration-vocabulary-book`；Tab/卡片用代码 | **已覆盖主体**。 |
| 02 | 水平选择页 | 年级列表图标、底部山水 | 年级列表图标、深色卡片 | `light-bg-landscape-strip`；列表图标建议 SVG | **已覆盖**。无需额外位图，年级图标用 SVG。 |
| 03 | 入学测页 | 题目卡、选项、进度条 | 题目卡、选项、进度条 | 测评纸可用于入口/空状态；本页主体用代码 | **已覆盖**。题目和选项不图片化。 |
| 04 | 测评结果页 | 打开书+勾、月桂、彩纸、建议卡 | 勾章、月桂、彩纸、深色山水 | `assessment-book-check`、`completion-check`、`laurel-confetti`、`vocabulary-book`、`focus-badge` | **已覆盖**。 |
| 05 | 首页-正常状态 | 词书、旗子、错词入口、小头像、底部山水 | 词书、旗子、错词入口、桌面暗景 | `vocabulary-book`、`list-flag`、`wrong-words`、`landscape-strip`、`dark-study-desk` | **已覆盖主体**。 |
| 06 | 训前检测页 | 中央词卡、上滑/下滑箭头、底部小词书 | 中央暗色词卡、上滑/下滑箭头、底部小词书 | `vocabulary-book`、`swipe-arrows`；词卡用代码 | **已覆盖主体**。 |
| 07 | 识记页 | 声波圆钮、底部山水 | 发光声波圆钮、深色山水 | `sound-wave-round`、`speaker`、`light/dark landscape-strip` | **已覆盖**。 |
| 08 | 词卡详情弹窗 | 弹窗面板、记忆场景图标、例句/搭配图标 | 深色弹窗、例句/搭配图标 | 声音图标覆盖；其他线性小图标建议 SVG | **已覆盖可复用部分**。弹窗和文本用代码。 |
| 09 | 回忆页-揭示前 | 声波圆钮、底部山水/麦草 | 声波圆钮、深色留白 | `sound-wave-round`、`landscape-strip` | **已覆盖**。 |
| 10 | 回忆页-揭示后 | 声波/喇叭、小叶子装饰、底部山水 | 声波、深色卡片、小叶子 | `sound-wave-round`、`speaker`、`landscape-strip` | **已覆盖主体**。小叶子可用 SVG/CSS。 |
| 11 | 听音页 | 大播放圆钮、横向声波、山水、底部释义卡 | 发光大播放圆钮、深色环形声波 | `listening-play`、`sound-wave-round`、`landscape-strip` | **已覆盖**。 |
| 12 | List 完成动画页 | 完成勾、圆形光效、轨道线、山水 | 发光完成勾、星轨、光点 | `completion-check`、`list-complete-glow`、`landscape-strip` | **已覆盖主体**。星轨线可 CSS/Canvas 或补效果层。 |
| 13 | 错词本页 | 错词夹板图标、词条列表、底部提示叶子 | 错词夹板、深色列表 | `wrong-words` | **已覆盖**。列表和状态标签用代码。 |
| 14 | 庆祝页 | 完成勾、月桂彩纸、词书、金色徽章、星星、山水 | 发光完成勾、月桂彩纸、词书、金色徽章 | `completion-check`、`laurel-confetti`、`vocabulary-book`、`focus-badge`、`gold-star-token`、`landscape-strip` | **已覆盖**。 |
| 15 | 我的页 | 词书、日历/搜索/设置、错词夹板、测评纸、奖章、设置线性图标 | 词书、错词夹板、测评纸、奖章、日历数据 | `vocabulary-book`、`wrong-words`、`assessment-paper`、`focus-badge`、`monthly-calendar` | **已覆盖主体**。顶部和设置图标用 SVG。 |
| 16 | 月度进展-阶段测入口页 | 月历、趋势图、阶段测夹板/奖章、小叶子 | 月历、柱状图、阶段测夹板/奖章 | `monthly-calendar`、`assessment-paper`、`focus-badge`、`wrong-words` | **已覆盖主体**。图表和月历格子用代码。 |

---

## 32 张逐页结论

浅色 16 页和深色 16 页结构一致，资产需求不是 32 套独立图片，而是 16 个页面模板在浅/深主题下复用同一批核心元素。

已覆盖的跨页素材：

- 词书：首页、我的、庆祝、测评结果
- 旗子：首页、List 目标、完成反馈
- 错词夹板：首页、错词本、我的
- 声波/喇叭/播放：识记、回忆、听音、词卡详情
- 完成勾/月桂彩纸/金色徽章/星星：List 完成、庆祝、测评结果
- 月度日历/测评纸：我的、月度进展、入学测/阶段测入口
- 浅色/深色水墨山水条：首页、学习页、庆祝页

未进入 Asset Kit、但应由代码或 SVG 处理：

- 顶部状态栏、微信胶囊、底部 Tab
- 按钮、卡片、列表行、弹窗面板
- 进度圆点、进度条、日历格子、图表
- 返回、搜索、设置、右箭头、开关、普通线性设置图标
- 所有汉字、英文、音标、数字

---

## 建议补充素材

以下 P1/P2 已补充。P3 仍是可选装饰，不建议在第一版小程序里继续增加包体。

| 优先级 | 建议资产 | 来源页面 | 原因 |
|---|---|---|---|
| P1 | `shared-illustration-study-desk-light@3x.png` | 浅色 01 新用户首页 | **已补充**。桌面书本+植物+学习氛围。 |
| P1 | `dark-illustration-study-desk@3x.png` | 深色 01/05 首页 | **已补充**。深色台灯/书桌场景。 |
| P2 | `shared-illustration-assessment-book-check@3x.png` | 04 测评结果页 | **已补充**。打开书+勾组合。 |
| P2 | `shared-effect-swipe-arrows@3x.png` | 06 训前检测页 | **已补充**。上滑/下滑方向提示。 |
| P3 | `shared-effect-orbit-sparkle@3x.png` | 12 List 完成动画页 | 当前完成光效够用；星轨线若想贴近 Reference 可补。 |
| P3 | `shared-decoration-leaf-sprig@3x.png` | 10/14/16 多页 | 小叶子装饰可用 SVG；补位图可统一插画质感。 |

P3 更像装饰，容易增加包体和维护成本。

---

## 最终判断

当前 Asset Kit 不是随机 8 张抽样结果，而是对 32 张 Reference 的核心复用元素提取版。

它仍然不是“Reference 里所有视觉元素全集”，因为按钮、卡片、线性图标、文字和进度都应由代码实现。对于小程序快速落地，当前版本已经覆盖主体图片资产。
