# 04-assessment-result 测评结果页规格

Reference: `dark/04-assessment-result.png`
共享 Token: `00-global-design-tokens.md`

---

## 布局

```
┌─────────────────────────────────┐
│ 状态栏                           │
├─────────────────────────────────┤
│                                 │
│         ✓ (大勾)                 │ 80rpx 圆形, --success-bright 描边
│                                 │
│       测评完成！                  │ H1 48rpx w900 居中
│  你的学习之旅，从这里开始          │ Caption 26rpx --text-secondary
├─ gap: 40rpx ────────────────────┤
│ ┌─────────────────────────────┐ │
│ │  你的词汇量范围约为            │ │ Label --text-label
│ │    1500 — 2100               │ │ H2 44rpx w900 --text-primary
│ │  初测估计，后续会结合真实       │ │ Small --text-label
│ │  学习表现校准                  │ │
│ └─────────────────────────────┘ │ 卡片 r40rpx
├─ gap: 24rpx ────────────────────┤
│ ┌─────────────────────────────┐ │
│ │  📗 建议                      │ │ Label --text-label
│ │  建议从高中必修词开始           │ │ Body 30rpx --text-primary
│ │  信心不错，持续学习会更准       │ │ Caption --text-secondary
│ └─────────────────────────────┘ │
├─ gap: 32rpx ────────────────────┤
│ ┌────── 开始学习 ───────────────┐│ CTA h88rpx --accent
│ └──────────────────────────────┘│
├─ gap: 16rpx ────────────────────┤
│     重新选择水平 ›                │ Small --text-label 居中
├─────────────────────────────────┤
│ （书桌场景 + 暖光）               │ scene-desk-glow.webp
└─────────────────────────────────┘
```

## 特有规格

| 元素 | 规格 |
|------|------|
| 顶部大勾 | 80rpx 圆形，描边 3rpx --success-bright，内部 ✓ 40rpx --success-bright |
| 大勾周围月桂叶装饰 | 月桂叶/植物叶片环绕大勾圆形两侧，装饰性插图，约 80–100rpx 宽，颜色 --success / --success-bright |
| 大勾上方书本插图 | 翻开书本插图，约 80rpx，位于大勾圆形正上方或背后，作为背景装饰（light 图更明显） |
| 词汇量数字 | H2 44rpx w900 --text-primary，"—" 用 --text-secondary |
| 建议卡片 | 左侧 40rpx 图标，Body + Caption 两行 |
| 建议副说明装饰图标 | Caption 行左侧有小星形/闪光图标（✦），约 16rpx，--accent，与说明文字同行 |
| CTA 光晕 | `box-shadow: 0 16rpx 48rpx rgba(217,119,87,0.25)`（dark）/ `rgba(212,147,90,0.3)`（light） |
| 底部场景 | dark: `scene-desk-glow-dark.webp`；light: `scene-landscape-glow-light.webp`（暖光版，区别于普通场景图） |

## 装饰气氛元素

| 元素 | dark | light |
|------|------|-------|
| 顶部星点/粒子 | 有（若干发光小点散落）| 有（绿色碎纸屑/彩带庆祝装饰） |
| 实现方式 | CSS 动画或 lottie，粒子约 4–8rpx，--success-bright opacity 0.6–0.8 | 碎纸屑用 canvas 或 lottie 实现，颜色 --success / --accent |

## Codex 检查表

- [ ] 无 Tab 栏、无返回按钮（测评完成态）
- [ ] 词汇量用区间 "1500 — 2100"，不是单点数字
- [ ] CTA "开始学习" 跳转到 05 首页
- [ ] "重新选择水平" 跳转到 02 水平选择页
- [ ] 底部场景用暖光版
