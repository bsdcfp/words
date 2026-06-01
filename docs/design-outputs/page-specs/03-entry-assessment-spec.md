# 03-entry-assessment 入学测页规格

Reference: `dark/03-entry-assessment.png`
共享 Token: `00-global-design-tokens.md`

---

## 页面特征

全屏深色，无 Tab 栏。顶部返回+进度，中部大单词，下方四个选项+不认识。

## 布局

```
┌─────────────────────────────────┐
│ 状态栏                           │
├─────────────────────────────────┤
│ ‹      12 / 36                  │ 返回(64rpx) + 进度(Body 30rpx)
├─────────────────────────────────┤
│    请选择最符合的中文释义          │ Caption 26rpx --text-secondary 居中
├─ gap: 48rpx ────────────────────┤
│                                 │
│        abandon                  │ Word 72rpx w900 居中
│       /əˈbændən/                │ IPA 28rpx --text-secondary 居中
│                                 │
├─ gap: 48rpx ────────────────────┤
│ ┌ A  放弃；抛弃              ✓ ┐│ 选项卡 h96rpx
│ ├ B  收获；收成                ┤│ 
│ ├ C  犹豫；迟疑                ┤│
│ └ D  受益；好处                ┘│
├─ gap: 24rpx ────────────────────┤
│ ┌──────── 不认识 ───────────────┐│ 次级按钮 h80rpx
│ └──────────────────────────────┘│
└─────────────────────────────────┘
```

## 选项卡特有规格

| 状态 | 背景 | 描边 | 左侧标号 |
|------|------|------|---------|
| 未选 | --bg-input | --border-option | A/B/C/D, 28rpx, --text-label |
| 选中正确 | rgba(94,138,122,0.15) | --success-bright | 标号变 --success-bright + ✓ |
| 选中错误 | rgba(217,87,87,0.15) | --error-flash | 标号变红 |

```
选项卡:
  宽度: 670rpx
  高度: 96rpx
  圆角: 20rpx
  布局: flex, align-items center
  左侧标号: 48rpx 宽, 居中, Caption 26rpx --text-label
  释义文字: Body 30rpx --text-primary
  间距: 16rpx
```

## "不认识"按钮

```
宽度: 670rpx
高度: 80rpx
圆角: 20rpx
背景: rgba(94, 138, 122, 0.12)
描边: 2rpx solid --border-option
文字: "不认识", Body 30rpx --text-secondary
居中
```

## 进度区规格

进度文字上方有一条水平细进度条，显示答题完成比例：

```
进度条:
  宽度: 670rpx（全内容宽）
  高度: 4rpx
  圆角: 2rpx
  轨道: --progress-track
  填充: --progress-fill（按完成题数/总题数比例）
  位置: 进度文字上方，margin-bottom 8rpx
```

## Codex 检查表

- [ ] 单词 Word 级别 72rpx，垂直居中偏上
- [ ] 4 个选项等高等宽，间距 16rpx
- [ ] 选中正确/错误有颜色反馈，不弹 toast
- [ ] "不认识"独立按钮，视觉低于 4 个选项
- [ ] 进度"12 / 36"文字上方有细进度条，二者共同指示进度
- [ ] 无 Tab 栏
