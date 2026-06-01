# 14-celebration 庆祝页规格

Reference: `dark/14-celebration.png`
共享 Token: `00-global-design-tokens.md`

---

## 页面特征

今日目标全部完成后的奖励页。全屏深色，无 Tab 栏。展示今日成绩、单词书进度、徽章、积分。两个按钮：明天继续 + 顺便复习错词。

## 布局

```
┌─────────────────────────────────┐
│ 状态栏                           │
├─────────────────────────────────┤
│                                 │
│      ✓（大勾圆形）                │ 80rpx 圆形，描边 3rpx --success-bright，内 ✓ 40rpx
│      （周围月桂叶装饰）            │ 叶片装饰围绕大勾
│                                 │
│       今日目标完成                │ H1 48rpx w900 --text-primary 居中
│   太棒了，今天的 List 都完成了     │ Caption 26rpx --text-secondary
├─ gap: 32rpx ────────────────────┤
│ ┌──────┬──────┬──────┐          │ 三列统计
│ │今日学习│新学单词│连续打卡│          │ 等宽三列
│ │ 4    │ 80   │ 3    │          │ Display 48rpx w900
│ │个List │  个  │  天  │          │ Small --text-label
│ └──────┴──────┴──────┘          │
├─ gap: 24rpx ────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 📗 高考课标 3500              │ │ 单词书进度卡
│ │   180 / 3500         5%     │ │ Body-L + 进度条
│ └─────────────────────────────┘ │
├─ gap: 24rpx ────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🛡 获得徽章                   │ │ 徽章卡
│ │   专注之星            +120分  │ │ H3 --text-primary + --accent
│ └─────────────────────────────┘ │
├─ gap: 32rpx ────────────────────┤
│ ┌────── 明天继续 ───────────────┐│ CTA h88rpx --accent
│ └──────────────────────────────┘│
│ ┌──── 顺便复习错词 ─────────────┐│ 次级按钮 h80rpx
│ └──────────────────────────────┘│
├─ gap: 16rpx ────────────────────┤
│ 🏆 坚持每天进步一点，词汇量       │ Small --text-label 居中
│    暴涨就在眼前                  │
└─────────────────────────────────┘
```

## 顶部大勾规格

```
圆形容器: 80–100rpx 直径
描边: 3rpx solid --success-bright
内部 ✓: 40rpx，--success-bright
月桂叶装饰: 左右各一组叶片，颜色 --success/--success-bright，约 80rpx 宽
垂直位置: 状态栏下方约 40rpx
```

## 三列统计规格

```
容器: 670rpx, 分 3 等份
每列: 居中对齐
列图标: 每列标题旁有小图标（约 24rpx，--text-label）
  今日学习列: 旗帜图标
  新学单词列: 书本图标
  连续打卡列: 日历/火焰图标
数字: 48rpx w900 --text-primary
单位: Small 22rpx --text-label
列间分割: 无分割线，用间距区分
背景: --bg-card r24rpx，整行一个卡片
```

## 徽章卡规格

```
宽度: 670rpx
圆角: 24rpx
背景: --bg-card
描边: 2rpx solid --accent-glow（金色微光描边）
内边距: 32rpx 40rpx
布局: flex
左侧: 星形盾牌徽章图形，64rpx，精美图标（非简单 emoji），需切图 badge-star.webp
顶部标签: "获得徽章" Label 24rpx w600 --text-label，位于卡片内顶部
右侧: 徽章名 H3 --text-primary + 积分 "--accent +120分"
积分行左侧: 金色圆形小图标（⊕ 或星形），约 20rpx，--accent
```

## 单词书进度卡（庆祝页内）

```
左侧书封面缩略图: icon-book-cover-dark.webp / icon-book-cover-light.webp，约 40×50rpx
书名: Body-S 28rpx --text-primary
进度数字: Body-L 34rpx w900
进度百分比: Body-S 28rpx --text-secondary
进度条: 全局 token 规格
```

## 装饰气氛元素

| 元素 | dark | light |
|------|------|-------|
| 背景星点粒子 | 有，零散发光小点（4–6rpx），--success-bright opacity 0.4–0.6 | 无 |
| 顶部彩纸/碎纸屑 | 无 | 有，绿色/橙色碎纸屑，lottie 或 canvas 实现 |
| 底部场景 | scene-desk-glow-dark.webp | scene-landscape-glow-light.webp |

## 按钮规格

```
"明天继续": CTA 主按钮 h88rpx --accent，跳转首页
  光晕: box-shadow 0 16rpx 48rpx rgba(217,119,87,0.25)（dark）/ rgba(212,147,90,0.3)（light）
"顺便复习错词": 次级按钮 h80rpx
  dark: 背景 rgba(94,138,122,0.12)，描边 2rpx --border-option，文字 --text-secondary
  light: 背景 rgba(255,255,255,0.50)，描边 2rpx --border-option，文字 --text-secondary
间距: 16rpx
```

## Codex 检查表

- [ ] 无 Tab 栏，全屏奖励页
- [ ] 三列统计等宽，数字突出
- [ ] 单词书进度条实时反映今日学习后的进度
- [ ] 徽章卡有金色微光描边
- [ ] "明天继续"回首页，"顺便复习错词"进错词复习
- [ ] 底部鼓励文案
- [ ] 背景可用 scene-desk-glow.webp（暖光版）
