# 12-list-complete-animation List 完成动画规格

Reference: `dark/12-list-complete-animation.png`
共享 Token: `00-global-design-tokens.md`

---

## 页面特征

单个 list 完成后的过渡动画。不是独立页面，是学习页内的全屏状态。自动播放 2 秒后进入下一个 list 或错词引导。

## 布局

```
┌─────────────────────────────────┐
│ 状态栏                           │
├─────────────────────────────────┤
│  ● ● ● ● ● ● ● ● ●             │ 进度圆点全部亮起 --dot-complete
├─────────────────────────────────┤
│                                 │
│                                 │
│           ✓                     │ 大勾 120rpx 圆形
│                                 │ 描边 3rpx --success-bright
│                                 │ 内部 ✓ 56rpx --success-bright
│      光环扩散动画                 │ 同心圆从中心向外扩散
│                                 │
│        List 完成                 │ H1 48rpx w900 --text-primary
│      即将进入下一步               │ Caption 26rpx --text-secondary
│                                 │
│                                 │
├─────────────────────────────────┤
│       自动继续…                   │ Small 22rpx --text-label 居中
└─────────────────────────────────┘
```

## 动画规格

```
阶段 1 (0-300ms): 进度圆点逐个从 --dot-pending → --dot-complete，波浪式点亮
阶段 2 (300-800ms): 中心大勾从 scale(0) → scale(1) + opacity 0→1
阶段 3 (800-1200ms): 光环同心圆扩散 3 层，opacity 0.3→0
阶段 4 (1200-1500ms): "List 完成" 文字 fadeIn
阶段 5 (2000ms): 自动切换到下一步

可选：微信 vibrateShort() 在阶段 2 触发一次振动
```

## 大勾规格

```
外圈: 120rpx 直径, 描边 3rpx --success-bright
内部勾: ✓, 56rpx, --success-bright
光环: 3 层同心圆扩散
  内: 160rpx, opacity 0.3 --success
  中: 240rpx, opacity 0.15 --success
  外: 320rpx, opacity 0.05 --success
  扩散时间: 800ms ease-out
```

## 装饰气氛元素

| 元素 | dark | light |
|------|------|-------|
| 轨道环形线 | 大勾外有 2–3 条椭圆轨道线（科技感），描边 1rpx --success-bright opacity 0.2，不旋转 | 无 |
| 星点粒子 | 若干小发光点（4–6px），--success-bright opacity 0.4–0.8，随机散落于大勾周围 | 无 |
| 底部山水场景 | 无 | `scene-landscape-light.webp` 半透明叠加于页面底部，opacity 0.3 |

## 文字装饰

```
"即将进入下一步" 两侧 em-dash 装饰:
  完整文字: "— 即将进入下一步 —"
  字号: Caption 26rpx
  颜色: --text-secondary
  "—" 与文字间距: 12rpx
```

## 底部进度指示器

"自动继续…" 下方有 2–3 个小圆点指示器：

```
圆点: 直径 8rpx
当前激活: --dot-current（脉动）
非激活: --dot-pending
排列: 横向，间距 8rpx，居中
```

## Codex 检查表

- [ ] 不是独立页面，是学习页的全屏覆盖状态
- [ ] 2 秒后自动进入下一步，不需要用户点击
- [ ] 进度圆点波浪式点亮
- [ ] 振动反馈（vibrateShort）
- [ ] "自动继续…" 用动画提示（三个点循环闪烁）
- [ ] "即将进入下一步"文字两侧有 em-dash 装饰
- [ ] dark 图：大勾外有轨道环形线 + 星点粒子
- [ ] light 图：底部有山水场景透出
