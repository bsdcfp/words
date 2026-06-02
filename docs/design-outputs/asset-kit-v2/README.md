# Asset Kit V2

日期：2026-06-02
生成方式：内置 `imagegen`，基于 `docs/imagegen-prototype-design-spec.md` 和 `docs/design-outputs/page-references-v2-imagegen/` 的视觉风格。

这批素材只包含 Reference 中已经出现、并且适合复用为图片资产的元素。按钮、卡片、箭头、设置图标、进度圆点、汉字、英文单词、音标和动态数据不在本资产包内，应由小程序 WXML/WXSS/SVG 实现。

## 目录

| 目录 | 内容 |
|---|---|
| `backgrounds/` | 浅色/深色水墨山水底部氛围条 |
| `illustrations/` | 书本、旗子、奖章、测评纸、月度日历等体积插画 |
| `icons/` | 错词、声音、完成、开书、星星等风格图标 |
| `effects/` | 庆祝装饰、List 完成光效 |
| `chroma-source/` | 原始纯色底源图，保留用于重新去底或修边 |
| `references/` | contact sheet 预览 |
| `tmp/` | 本次生成过程记录 |

## 预览

![Asset Kit Contact Sheet](/Users/fuping.chu/Documents/Personal/学习力/单词/word-prototype/docs/design-outputs/asset-kit-v2/references/asset-kit-contact-sheet.png)

逐页覆盖确认见：

`page-asset-coverage.md`

## 背景/氛围条

| 文件 | 用途 |
|---|---|
| `backgrounds/light-bg-landscape-strip@3x.png` | 浅色首页、学习页、庆祝页底部水墨山水氛围 |
| `backgrounds/dark-bg-landscape-strip@3x.png` | 深色学习页底部沉浸山水氛围 |

## 插画

| 文件 | 用途 |
|---|---|
| `illustrations/light-illustration-vocabulary-book@3x.png` | 单词书信息卡、首页、我的页、庆祝页进度卡 |
| `illustrations/shared-illustration-list-flag@3x.png` | 今日目标、List 完成、进度节点 |
| `illustrations/shared-illustration-focus-badge@3x.png` | 庆祝页徽章、阶段奖励 |
| `illustrations/shared-illustration-monthly-calendar@3x.png` | 月度进展、我的页日历入口 |
| `illustrations/shared-illustration-assessment-paper@3x.png` | 入学测、阶段测入口和空状态 |
| `illustrations/shared-illustration-study-desk-light@3x.png` | 浅色新用户首页上半段学习场景 |
| `illustrations/dark-illustration-study-desk@3x.png` | 深色新用户首页/首页上半段学习场景 |
| `illustrations/shared-illustration-assessment-book-check@3x.png` | 测评结果页顶部“打开书 + 完成勾”插画 |

## 图标

| 文件 | 用途 |
|---|---|
| `icons/shared-icon-wrong-words@3x.png` | 错词本入口、错词复习卡片 |
| `icons/shared-icon-completion-check@3x.png` | 今日完成、List 完成、确认反馈 |
| `icons/shared-icon-sound-wave-round@3x.png` | 识记页发音按钮、听音页小声波 |
| `icons/shared-icon-listening-play@3x.png` | 听音页中心播放按钮 |
| `icons/shared-icon-open-book@3x.png` | 新学单词、词库、学习数据 |
| `icons/shared-icon-gold-star-token@3x.png` | 积分、奖励、星星统计 |
| `icons/shared-icon-speaker@3x.png` | 发音、小型播放按钮 |

## 效果

| 文件 | 用途 |
|---|---|
| `effects/shared-effect-laurel-confetti@3x.png` | 庆祝页顶部装饰、完成反馈 |
| `effects/shared-effect-list-complete-glow@3x.png` | List 完成光效、徽章背后氛围 |
| `effects/shared-effect-swipe-arrows@3x.png` | 训前检测页上滑/下滑方向提示 |

## 使用边界

- 透明 PNG 可直接叠加在小程序页面中。
- `backgrounds/` 是矩形氛围条，不是整页背景；建议贴底放置，并用 WXSS 控制透明度和高度。
- `effects/` 应放在文字和数据层后面，不要遮挡真实 WXML 文本。
- 简单线性图标仍建议使用 SVG/iconfont，例如返回、关闭、设置、搜索、普通右箭头。
- 需要上线前可再按小程序包体要求压缩为 WebP 或按实际显示尺寸导出较小版本。
