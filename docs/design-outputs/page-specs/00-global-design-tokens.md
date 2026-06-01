# 全局设计 Token

所有页面共享此 token 表。各页面规格表只列该页面特有的规格，共享部分引用本文件。

---

## 共享结构（深色/浅色通用）

### 字体层级

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| Display | 96rpx | 900 | 大数字（目标数、词汇量） |
| Word | 72rpx | 900 | 学习页单词 |
| H1 | 48rpx | 900 | 页面大标题 |
| H2 | 44rpx | 900 | 卡片标题 |
| H3 | 36rpx | 800 | 次级标题 |
| Body-L | 34rpx | 900 | 进度数字 |
| Body | 30rpx | 700 | 正文/选项 |
| Body-S | 28rpx | 700 | 辅助正文 |
| Caption | 26rpx | 700 | 提示/说明 |
| Label | 24rpx | 600 | 字段标签 |
| Small | 22rpx | 600 | 底注/时间 |
| Tab | 20rpx | 700 | Tab 栏 |
| IPA | 28rpx | 400 | 音标 |

字体族：`PingFang SC, -apple-system, system-ui, sans-serif`

### 间距系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--page-margin` | 40rpx | 页面左右边距 |
| `--card-padding` | 48rpx | 卡片内边距 |
| `--card-gap` | 24rpx | 卡片之间垂直间距 |
| `--section-gap` | 32rpx | 区块之间间距 |
| `--item-gap` | 16rpx | 列表项之间间距 |
| `--label-gap` | 12rpx | 标签到内容间距 |

### 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-card` | 40rpx | 卡片 |
| `--radius-button` | 24rpx | 按钮 |
| `--radius-pill` | 999rpx | 胶囊标签 |
| `--radius-option` | 20rpx | 选项卡 |
| `--radius-bar` | 6rpx | 进度条 |
| `--radius-input` | 16rpx | 设置项行 |

### 组件尺寸（深色浅色通用）

| 组件 | 宽度 | 高度 | 圆角 |
|------|------|------|------|
| CTA 主按钮 | 670rpx 或卡片内宽 | 88rpx | 24rpx |
| 次级按钮 | 同主按钮 | 80rpx | 24rpx |
| 卡片 | 670rpx | 自适应 | 40rpx |
| 进度条 | 卡片内宽 | 12rpx | 6rpx |
| 选项卡 | 670rpx | 96rpx | 20rpx |
| 底部 Tab | 满宽 | 120rpx + safe-area | — |
| 进度圆点 | 12rpx 直径 | — | 圆形 |
| 返回按钮 | 64rpx | 64rpx | 16rpx |
| 声波动画（识记/回忆） | 80rpx | — | 圆形 |
| 声波动画（听音） | 160rpx | — | 圆形 |

---

## Dark 主题色彩

### 背景

| Token | 色值 | 用途 |
|-------|------|------|
| `--bg-primary` | `#0B1A17` | 页面主背景（深墨绿黑） |
| `--bg-card` | `rgba(19, 40, 34, 0.85)` | 卡片（半透明） |
| `--bg-card-solid` | `#132822` | 卡片不透明备选 |
| `--bg-card-elevated` | `rgba(25, 50, 42, 0.90)` | 弹窗/高层级卡片 |
| `--bg-hint` | `#1E3D34` | 提示条 |
| `--bg-tabbar` | `rgba(10, 22, 19, 0.96)` | Tab 栏 |
| `--bg-input` | `#0F261F` | 选项未选中 |

### 描边

| Token | 色值 |
|-------|------|
| `--border-card` | `#24413E` |
| `--border-option` | `rgba(94, 138, 122, 0.3)` |
| `--border-option-selected` | `#5E8A7A` |
| `--border-divider` | `#1E3D34` |

### 文字

| Token | 色值 |
|-------|------|
| `--text-primary` | `#FFF9EF` |
| `--text-secondary` | `#A9B7B2` |
| `--text-label` | `#5E8A7A` |
| `--text-disabled` | `rgba(169, 183, 178, 0.4)` |

### 强调

| Token | 色值 |
|-------|------|
| `--accent` | `#D97757` |
| `--accent-hover` | `rgba(217, 119, 87, 0.85)` |
| `--accent-glow` | `rgba(217, 119, 87, 0.25)` |
| `--success` | `#5E8A7A` |
| `--success-bright` | `#7ABFA8` |
| `--error-flash` | `rgba(217, 87, 87, 0.6)` |

### 进度

| Token | 色值 |
|-------|------|
| `--progress-track` | `#1E3D34` |
| `--progress-fill` | `#D97757` |
| `--dot-complete` | `#5E8A7A` |
| `--dot-current` | `#7ABFA8` |
| `--dot-pending` | `rgba(94, 138, 122, 0.25)` |

### Dark 纹理

| 效果 | 实现 |
|------|------|
| 水墨底纹 | `bg-ink-texture-dark.webp`, 750×1624 @2x, opacity 0.15~0.25 |
| 底部书桌 | `scene-desk-dark.webp`, 750×400 @2x, 绝对定位 bottom |
| 底部书桌暖光 | `scene-desk-glow-dark.webp`, 750×300 @2x, 庆祝/测评结果页 |
| 顶部渐变 | `linear-gradient(180deg, #0B1A17 0%, transparent 100%)`, h180rpx |
| 卡片毛玻璃 | `backdrop-filter: blur(20rpx)` + 半透明 bg |
| CTA 光晕 | `box-shadow: 0 16rpx 48rpx rgba(217,119,87,0.25)` |

### Dark CTA 按钮

```
背景: #D97757
文字: #141413 (深色文字在亮按钮上)
hover: opacity 0.85
```

---

## Light 主题色彩

### 背景

| Token | 色值 | 用途 |
|-------|------|------|
| `--bg-primary` | `#F5F0E8` | 页面主背景（暖米色） |
| `--bg-card` | `rgba(255, 255, 255, 0.75)` | 卡片（半透明白） |
| `--bg-card-solid` | `#FFFFFF` | 卡片不透明 |
| `--bg-card-elevated` | `rgba(255, 255, 255, 0.90)` | 弹窗/高层级 |
| `--bg-hint` | `rgba(255, 255, 255, 0.60)` | 提示条 |
| `--bg-tabbar` | `rgba(255, 255, 255, 0.96)` | Tab 栏 |
| `--bg-input` | `rgba(255, 255, 255, 0.50)` | 选项未选中 |

### 描边

| Token | 色值 |
|-------|------|
| `--border-card` | `rgba(180, 160, 130, 0.25)` |
| `--border-option` | `rgba(180, 160, 130, 0.3)` |
| `--border-option-selected` | `#8B7355` |
| `--border-divider` | `rgba(180, 160, 130, 0.2)` |

### 文字

| Token | 色值 |
|-------|------|
| `--text-primary` | `#2C2418` |
| `--text-secondary` | `#7A6E5E` |
| `--text-label` | `#A89880` |
| `--text-disabled` | `rgba(122, 110, 94, 0.4)` |

### 强调

| Token | 色值 |
|-------|------|
| `--accent` | `#D4935A` |
| `--accent-hover` | `rgba(212, 147, 90, 0.85)` |
| `--accent-glow` | `rgba(212, 147, 90, 0.25)` |
| `--success` | `#5E8A6A` |
| `--success-bright` | `#4A9B7A` |
| `--error-flash` | `rgba(200, 80, 80, 0.4)` |

### 进度

| Token | 色值 |
|-------|------|
| `--progress-track` | `rgba(180, 160, 130, 0.2)` |
| `--progress-fill` | `#D4935A` |
| `--dot-complete` | `#5E8A6A` |
| `--dot-current` | `#4A9B7A` |
| `--dot-pending` | `rgba(94, 138, 106, 0.25)` |

### Light 纹理

| 效果 | 实现 |
|------|------|
| 山水底纹 | `bg-landscape-light.webp`, 750×1624 @2x, opacity 0.3~0.5 |
| 底部山水场景 | `scene-landscape-light.webp`, 750×400 @2x, 绝对定位 bottom |
| 底部山水暖光 | `scene-landscape-glow-light.webp`, 750×300 @2x |
| 顶部渐变 | `linear-gradient(180deg, #F5F0E8 0%, transparent 100%)`, h180rpx |
| 卡片毛玻璃 | `backdrop-filter: blur(20rpx)` + 半透明白 bg |
| CTA 光晕 | `box-shadow: 0 16rpx 48rpx rgba(212,147,90,0.3)` |

### Light CTA 按钮

```
背景: linear-gradient(135deg, #D4935A, #C4823A) (金棕渐变)
文字: #FFFFFF (白色文字在深按钮上)
hover: opacity 0.85
```

---

## 切图清单

### Dark 主题

| 文件名 | 尺寸 @2x | 用途 |
|--------|---------|------|
| `bg-ink-texture-dark.webp` | 750×1624 | 水墨纹理，全屏叠加 |
| `scene-desk-dark.webp` | 750×400 | 底部书桌场景 |
| `scene-desk-glow-dark.webp` | 750×300 | 书桌暖光版 |
| `icon-book-cover-dark.webp` | 120×160 | 书封面图标 |

### Light 主题

| 文件名 | 尺寸 @2x | 用途 |
|--------|---------|------|
| `bg-landscape-light.webp` | 750×1624 | 山水纹理，全屏叠加 |
| `scene-landscape-light.webp` | 750×400 | 底部山水场景 |
| `scene-landscape-glow-light.webp` | 750×300 | 山水暖光版 |
| `icon-book-cover-light.webp` | 120×160 | 书封面图标 |

---

## 主题切换实现

```
用户在"我的"设置中切换主题。
所有颜色通过 CSS 变量 / WXSS 变量注入。
页面结构和组件尺寸不变，只切换色彩和纹理图片。

推荐实现：
  app.wxss 定义两套变量（.theme-dark / .theme-light）
  页面根节点 class 根据 user.settings.learningTheme 切换
  纹理图片路径根据主题变量动态拼接
```
