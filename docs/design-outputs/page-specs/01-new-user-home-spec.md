# 01-new-user-home 新用户首页规格

Reference: `dark/01-new-user-home.png`
共享 Token: `00-global-design-tokens.md`

---

## 页面特征

首次进入的用户看到的首页。与 05 正常首页共享底部 Tab 和书桌场景，区别在于顶部欢迎区和主按钮。

## 布局

```
┌─────────────────────────────────┐
│ 状态栏                           │
├─────────────────────────────────┤
│                                 │
│        欢迎！                    │ H1 48rpx w900
│    先选择你的学习水平              │ Caption 26rpx --text-secondary
│                                 │
├─ gap: 48rpx ────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 单词书进度卡（空态）           │ │ 同 05 进度卡，数据 0/3500, 0%
│ │  书名 + 0/3500 + 0%         │ │
│ │  进度条（空）                 │ │
│ └─────────────────────────────┘ │
├─ gap: 32rpx ────────────────────┤
│ ┌─────────────────────────────┐ │
│ │   选择学习水平 ›              │ │ CTA 全宽 670rpx h88rpx
│ └─────────────────────────────┘ │
├─ gap: 16rpx ────────────────────┤
│ 🔗 选择后可随时在【我的】中更改    │ Small 22rpx --text-label 居中
├─────────────────────────────────┤
│ （书桌场景）                     │
├─────────────────────────────────┤
│ Tab 栏: 单词 | 我的              │
└─────────────────────────────────┘
```

## 特有规格

| 元素 | 规格 |
|------|------|
| "欢迎！" | H1 48rpx w900 --text-primary，垂直位置约屏幕 20% 处，居中 |
| 副标题 | Caption 26rpx --text-secondary，居中，距标题 16rpx |
| CTA "选择学习水平 ›" | 全宽 670rpx，h88rpx，r24rpx，--accent，文字 32rpx w900 #141413 |
| CTA 光晕 | `box-shadow: 0 16rpx 48rpx rgba(217,119,87,0.25)`（dark）/ `rgba(212,147,90,0.3)`（light） |
| 底注链接 | 22rpx --text-label，居中，可点击 |
| 底注左侧叶子图标 | 小植物/叶子图标，16rpx，--text-label，与底注文字同行，间距 8rpx |
| 进度卡 | 与 05 同结构，数据为 0 |
| 进度卡书封面缩略图 | 卡片内左上角，约 40×50rpx，`icon-book-cover-dark.webp` / `icon-book-cover-light.webp` |

## 背景层规格

| 层级 | 规格 |
|------|------|
| 主背景色 | dark `#0B1A17` / light `#F5F0E8` |
| 纹理叠加 | dark `bg-ink-texture-dark.webp` opacity 0.15–0.25 / light `bg-landscape-light.webp` opacity 0.3–0.5 |
| 顶部渐变 | `linear-gradient(180deg, --bg-primary 0%, transparent 100%)`, h180rpx，覆盖欢迎文字区域上方 |
| 底部场景图 | dark `scene-desk-dark.webp` / light `scene-landscape-light.webp`，750×400@2x，绝对定位 bottom |
| 右下角时钟装饰 | 装饰性时钟数字（如"22:30"），Large 36–48rpx w900，--text-disabled，仅 dark 图可见，绝对定位右下角 |

## Codex 检查表

- [ ] 欢迎标题居中，不是左对齐
- [ ] 进度卡数据为 0/3500, 0%，进度条无填充
- [ ] CTA 用 --accent 背景，不是次级按钮
- [ ] 底注可点击，跳转到"我的"
- [ ] 书桌场景和 Tab 栏与 05 一致
