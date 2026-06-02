# GPT-Image 原型设计规范

日期：2026-06-02
适用范围：单词记忆小程序 V2 原型、逐页 Reference、视觉资产包、小程序页面适配。

本规范用于把 GPT-Image 生成的效果图转化为可实现的小程序设计资产。核心原则是：**Reference 用来定视觉方向，资产包用来沉淀可复用图片，页面结构和动态文字必须由小程序代码实现。**

---

## 1. 设计目标

围绕三个关键词建立统一视觉：

| 关键词 | 设计含义 | 页面表现 |
|---|---|---|
| 单词记忆 | 明确、稳定、低干扰地看见词 | 英文单词、音标、释义居中；辅助信息弱化 |
| 专注 | 一屏一事，避免操作噪音 | 学习页隐藏底部 Tab；进度用圆点，不用复杂数字 |
| 心流 | 练习节奏连续，反馈轻柔 | 过渡、声波、完成动画轻量；不频繁打断 |

默认浅色主题，深色主题作为可选专注模式。两套主题需要保持页面结构一致，只改变氛围、色值、光感和插画质感。

---

## 2. Reference 与资产的关系

### 2.1 Reference 是页面视觉稿

逐页 Reference 用于确认：

- 页面主体构图
- 信息层级
- 插画风格
- 主题氛围
- 小程序适配方向

Reference 不直接切图复用。特别是包含汉字、英文、数字、学习进度的区域，必须重新用 WXML/WXSS 实现。

当前逐页 Reference 存放在：

`docs/design-outputs/page-references-v2-imagegen/`

### 2.2 资产包是可复用高清元素

资产包用于沉淀页面中反复出现、难以用 CSS 稳定复刻、或者需要插画质感的元素，例如背景图、主题插画、小旗子、书本、喇叭、星星、奖章、声波装饰等。

资产包生成时必须脱离页面文字，不要把汉字、英文单词、音标、数字烘焙进图片。

---

## 3. 生成物分层

| 层级 | 用 GPT-Image 吗 | 小程序实现方式 | 示例 |
|---|---:|---|---|
| 页面 Reference | 是 | 只做视觉参考 | 32 张浅色/深色页面图 |
| 背景插画 | 是 | PNG/WebP 图片 | 首页背景、学习页沉浸背景、庆祝页背景 |
| 主题插画 | 是 | PNG/WebP，必要时透明底 | 书本、奖章、完成徽章、月度进展插画 |
| 复杂小图标 | 是或 SVG | PNG/WebP 或 SVG | 书、小旗子、喇叭、声音、星星 |
| 简单功能图标 | 优先不用 | SVG/iconfont/lucide 类图标 | 返回箭头、设置、关闭、播放、下一步 |
| 按钮 | 不用 | WXSS 样式 | 主按钮、次按钮、底部固定按钮 |
| 卡片/面板 | 不用 | WXSS 样式 | 首页进度卡、设置项、词卡容器 |
| 进度/圆点/分割线 | 不用 | WXSS 样式 | List 圆点、进度条、分割线 |
| 动态文字 | 不用 | WXML 文本 | 汉字释义、英文单词、音标、数字 |
| 动效 | 看复杂度 | CSS/Lottie/帧图 | 声波、完成闪光、轻量庆祝动效 |

判断标准：**凡是会根据用户、词库、进度、主题动态变化的内容，都不应该做进图片。**

---

## 4. 禁止烘焙进图片的内容

以下内容必须由小程序代码渲染：

- 汉字 UI 文案：如“继续学习”“记住了”“今日目标完成”
- 英文单词：如 `abandon`
- 音标、词性、释义、例句、搭配
- 学习数字：如 `12/36`、`7 天`、`86%`
- 进度圆点的当前状态
- 用户头像、昵称、等级、积分
- 设置项状态：开关、选中项、循环次数
- 系统导航栏、微信胶囊按钮、状态栏

GPT-Image 生成页面 Reference 时可以出现占位文字，但最终实现不能从 Reference 裁这些文字。

---

## 5. 可以单独生成高清资产的内容

### 5.1 背景类

| 资产 | 建议格式 | 说明 |
|---|---|---|
| 首页浅色背景 | WebP/PNG | 柔和学习氛围，不能影响文字阅读 |
| 首页深色背景 | WebP/PNG | 沉浸、安静，有空间感 |
| 学习页浅色背景 | WebP/PNG | 极低干扰，只保留轻微光感 |
| 学习页深色背景 | WebP/PNG | 深色心流背景，中心区域留白 |
| 庆祝页背景 | WebP/PNG | 可有轻量光点、奖章、纸屑，但不遮挡总结文字 |

背景图必须预留文字安全区，不要在中心核心阅读区堆细节。

### 5.2 插画类

| 资产 | 建议格式 | 说明 |
|---|---|---|
| 单词书/书本 | PNG/WebP 透明底 | 首页、我的、词库入口复用 |
| 小旗子 | PNG/WebP 透明底 | 目标、完成、阶段测 |
| 喇叭/声音 | PNG/WebP 透明底或 SVG | 听音页、播放按钮 |
| 星星/徽章 | PNG/WebP 透明底 | 积分、完成、庆祝 |
| 月度进展图形 | PNG/WebP 透明底 | 月度页或我的页视觉点缀 |
| 错词本图形 | PNG/WebP 透明底 | 错词本入口与空状态 |

插画资产要有同一套光源、边缘、体积感，不能每个资产像来自不同产品。

### 5.3 动效帧

可以单独生成帧图或 Lottie 参考的场景：

- List 完成动画
- 今日目标完成庆祝
- 听音声波中心动效
- 词卡翻转/揭示的背景光效

如果只是按钮按压、卡片浮起、圆点点亮，用 CSS 实现，不生成图片。

---

## 6. 资产规格

### 6.1 图片尺寸

| 类型 | 设计尺寸 | 小程序建议 |
|---|---:|---|
| 页面 Reference | 853 × 1844 或同级竖屏高清 | 只做参考，不直接上线 |
| 全屏背景 | 1125 × 2436 | 按 @3x 竖屏准备 |
| 半屏插画 | 900 × 900 | 透明底，便于缩放 |
| 常用图标 | 192 × 192 | @3x，实际显示 48-64rpx |
| 小装饰 | 128 × 128 | @3x，避免过多细节 |
| 徽章/奖章 | 512 × 512 | 可用于弹窗和庆祝页 |

如需透明背景，优先生成纯色背景后本地抠透明；复杂透明材质再考虑原生透明输出。

### 6.2 文件格式

| 场景 | 格式 | 原因 |
|---|---|---|
| 大背景 | WebP 优先，PNG 备选 | 体积更小 |
| 透明插画 | PNG | 保留 alpha |
| 图标 | SVG 优先，PNG 备选 | SVG 更清晰可控 |
| 动效帧 | WebP/PNG 序列 | 看小程序端动效方案 |

### 6.3 命名规则

建议路径：

```text
docs/design-outputs/asset-kit-v2/
├── references/
├── backgrounds/
├── illustrations/
├── icons/
├── effects/
└── manifest.json
```

命名格式：

```text
<theme>-<category>-<name>@3x.<ext>
```

示例：

```text
light-bg-home-main@3x.webp
dark-bg-learning-focus@3x.webp
light-illustration-book@3x.png
shared-icon-speaker@3x.png
shared-icon-flag@3x.png
dark-effect-list-complete@3x.webp
```

---

## 7. GPT-Image 生成流程

### 7.1 页面 Reference 流程

1. 先读取页面架构和机制文档。
2. 每个页面单独生成，不从总图裁切。
3. 浅色和深色分别生成，保持结构一致。
4. Reference 中的文字只作为视觉占位，不作为最终 UI 资源。
5. 生成后保存到项目目录，并写入 `manifest.json`。
6. 用视觉检查确认清晰度、主体不糊、无大面积文字乱码、布局不重叠。

当前页面清单以 `docs/page-architecture-v2.md` 为准。

### 7.2 资产包流程

1. 从 32 张 Reference 中列出可复用视觉元素。
2. 按背景、插画、图标、动效拆分，不直接裁页面。
3. 每个资产独立生成高清图。
4. 需要透明底的资产使用纯色背景生成，再本地去底并检查边缘。
5. 同一主题资产保持同一光源、材质、圆角、阴影强度。
6. 每个资产记录用途、主题、尺寸、文件格式和可复用页面。

---

## 8. 通用 Prompt 模板

### 8.1 页面 Reference 模板

```text
Use case: ui-mockup
Asset type: WeChat Mini Program page reference, vertical mobile screen
Primary request: Generate one standalone high-resolution page reference for <页面名>.
Product theme: vocabulary memory, focus, flow state.
Page purpose: <该页面的用户任务>
Theme: <light/dark>
Layout requirements:
- Keep the WeChat system navigation area conceptually separate; design the page body only.
- One screen, one primary task.
- Use real app-like hierarchy and polished production UI.
- Dynamic learning text may appear as visual placeholder only; do not make it part of reusable assets.
Visual style:
- Calm, focused, warm learning product.
- Soft dimensional illustrations only where they support memory and motivation.
- No crowded game-like decoration.
- No marketing landing-page hero composition.
Mini Program implementation constraints:
- Buttons, cards, progress dots, settings rows, tabs, and text must be implementable in WXML/WXSS.
- Do not rely on rasterized Chinese text.
Output:
- Crisp high-resolution mobile mockup.
- No watermark.
```

### 8.2 透明插画资产模板

```text
Use case: stylized-concept
Asset type: transparent PNG-style UI illustration asset for a WeChat Mini Program
Primary request: Generate a <资产名称> for a vocabulary memory app.
Style:
- Calm, focused, polished 3D-soft illustration.
- Match the visual language of a light/dark vocabulary learning product.
- Rounded forms, clean edges, gentle shadows inside the object only.
Constraints:
- No Chinese text, no English text, no numbers, no watermark.
- The asset must stand alone and be reusable across pages.
- Put the object on a perfectly flat solid #00ff00 chroma-key background for local background removal.
- Do not use #00ff00 anywhere in the object.
- Generous padding around the object.
```

### 8.3 背景资产模板

```text
Use case: stylized-concept
Asset type: full-screen background for a WeChat Mini Program
Primary request: Generate a <theme> full-screen background for <页面/场景>.
Product theme: vocabulary memory, focus, flow state.
Composition:
- Vertical mobile background, 1125 x 2436 design ratio.
- Leave a clean safe reading zone in the center.
- Decorative details should stay near edges or corners.
- No text, no icons that imply unreadable UI.
Visual style:
- Calm, immersive, production-grade learning app.
- Subtle depth and light, not noisy.
Output:
- High-resolution background, no watermark.
```

---

## 9. 小程序实现边界

### 9.1 用 WXSS 实现

- 页面底色和渐变
- 卡片背景、圆角、阴影
- 主按钮、次按钮、禁用态
- 进度圆点、进度条
- Tab、设置行、列表行
- 弹窗遮罩和基础面板
- 简单 hover/press/transition 状态

### 9.2 用 WXML 文本实现

- 所有汉字 UI 文案
- 所有词库内容
- 所有学习数据
- 所有可访问性标签

### 9.3 用图片资产实现

- 插画主体
- 背景氛围图
- 复杂装饰
- 奖章、书本、旗子、声波等有明显风格质感的元素

### 9.4 用 SVG/iconfont 实现

- 返回箭头
- 关闭
- 设置
- 播放/暂停
- 下一步
- 勾选/错误
- 普通列表箭头

如果小程序构建链暂时不方便引入 SVG/iconfont，再导出 PNG @3x 版本。

---

## 10. 页面资产清单

| 页面 | 需要图片资产 | 不需要图片化 |
|---|---|---|
| 新用户首页 | 首页背景、书本/学习插画 | 欢迎文案、主按钮 |
| 水平选择 | 等级插画、小书/旗子 | 年级列表、选中态 |
| 入学测 | 测评插画、轻量进度装饰 | 题干、选项、进度 |
| 测评结果 | 奖章/起点插画 | 词汇量区间、建议文案 |
| 首页正常 | 首页背景、进度插画、错词入口图标 | 今日目标、进度、按钮 |
| 训前检测 | 卡片背景氛围、筛词动效参考 | 英文单词、认识/不熟按钮 |
| 识记页 | 学习页背景、轻量记忆插画 | 单词、音标、释义、按钮 |
| 词卡详情弹窗 | 记忆图占位插画 | 释义、例句、搭配、弹窗结构 |
| 回忆页揭示前 | 回忆页背景 | 提示文案、进度圆点 |
| 回忆页揭示后 | 回忆页背景、轻量揭示光效 | 英文/中文/例句 |
| 听音页 | 声波图形/动效帧、声音图标 | 播放状态、揭示文字 |
| List 完成动画 | 完成光效、星星、徽章 | List 文案、完成状态 |
| 错词本 | 错词本插画、空状态插画 | 错词列表、标签、按钮 |
| 庆祝页 | 庆祝背景、奖章、星星 | 今日总结、数据、按钮 |
| 我的页 | 头像/书本/设置区插画点缀 | 设置项、开关、数据 |
| 月度进展/阶段测 | 日历插画、阶段测奖章 | 日历格子、测试入口、数据 |

---

## 11. 质量验收

每个 Reference 必须检查：

- 页面主体清晰，不是从总图裁切放大。
- 不出现大面积乱码文字。
- 主要操作区域一眼可见。
- 学习页中心阅读区不被插画遮挡。
- 浅色/深色结构一致。
- 不复刻微信状态栏和胶囊按钮作为核心设计依赖。

每个资产必须检查：

- 边缘清晰，无毛边和脏色。
- 透明资产 alpha 正常，四角透明。
- 没有汉字、英文、数字、水印。
- 缩小到小程序实际尺寸后仍可辨认。
- 同一主题光源和材质一致。
- 文件体积适合小程序加载。

---

## 12. 当前决策

- 32 张页面 Reference 已作为页面视觉方向，不再从中裁切资产。
- 接下来应单独生成 `asset-kit-v2`，包括背景、插画、图标、动效参考。
- 按钮、卡片、文字、进度、设置项全部进入小程序代码实现。
- 简单功能图标优先 SVG/iconfont，复杂风格图标再用 GPT-Image 生成高清 PNG。
