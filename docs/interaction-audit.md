# 交互路径自动巡检

生成时间：2026-06-01T12:42:24.182Z

## 契约校验

| 状态 | 规则 | 期望 |
| --- | --- | --- |
| 通过 | 本组复习-再想想不应加入错词 | markGroupReviewUnfamiliar 只播放当前词并在播放后揭示，不调用 answerGroupReviewQuestion |
| 通过 | 听音辨义-再想想不应加入错词 | markAudioUnfamiliar 只重播当前词，不调用 answerAudioQuestion |
| 通过 | 本组复习-记住了应进入下一题 | rememberGroupReview 记录正确答案并推进 |
| 通过 | 听音辨义-记住了应进入下一题 | rememberAudio 记录正确答案并推进 |
| 通过 | 混组复习-再想想不应加入错词 | markMixedUnfamiliar 只播放当前词并在播放后揭示，不调用 answerMixedReviewQuestion |
| 通过 | 混组复习-记住了应进入下一题 | rememberMixedReview 记录正确答案并推进 |
| 通过 | 看中文回忆英文-记住了应进入下一题 | rememberMeaningRecall 记录正确答案并推进 |
| 通过 | 看中文回忆英文-再想想只重置揭示计时 | retryMeaningRecall 不记录答案，只重新等待 2 秒揭示英文 |
| 通过 | 单词识记-再听听只重启当前轮 | markStudy 的再听听分支不推进，只重启播放 |

## 按钮路径清单

共扫描 74 个点击入口，32 个 handler。

| 页面 | 按钮/入口 | Handler | 存在 | 触发路径 |
| --- | --- | --- | --- | --- |
| home | 重置体验数据 | resetData | yes | navigate/render, updates-ui |
| home | (dynamic) | openLevelSelect | yes | navigate/render |
| home | (dynamic) | openProfile | yes | navigate/render |
| home | (dynamic) | startDailyLearning | yes | navigate/render, starts-flow |
| home | 选择后可随时在【我的】中更改 | openProfile | yes | navigate/render |
| home | (dynamic) | openWrongBook | yes | navigate/render |
| home | (dynamic) | openWordsTab | yes | navigate/render |
| home | (dynamic) | openProfile | yes | navigate/render |
| profile | (dynamic) | resetData | yes | navigate/render, updates-ui |
| profile | (dynamic) | openLevelSelect | yes | navigate/render |
| profile | List | setListGroupCount | yes | navigate/render, updates-settings |
| profile | (dynamic) | setPronunciationLoopCount | yes | navigate/render, updates-settings |
| profile | (dynamic) | setLearningTheme | yes | navigate/render, updates-settings |
| profile | (dynamic) | openMonthProgress | yes | navigate/render |
| profile | (dynamic) | startTest | yes | navigate/render, starts-flow |
| profile | (dynamic) | startTest | yes | navigate/render, starts-flow |
| profile | (dynamic) | openLevelSelect | yes | navigate/render |
| profile | (dynamic) | startTest | yes | navigate/render, starts-flow |
| profile | (dynamic) | openWrongBook | yes | navigate/render |
| profile | (dynamic) | openWordsTab | yes | navigate/render |
| profile | (dynamic) | openProfile | yes | navigate/render |
| month-progress | (dynamic) | goBack | yes | no-state-change |
| month-progress | 上一月 | shiftProgressMonth | yes | navigate/render |
| month-progress | 下一月 | shiftProgressMonth | yes | navigate/render |
| month-progress | 开始阶段测 | startTest | yes | navigate/render, starts-flow |
| level-select | (dynamic) | goBack | yes | no-state-change |
| level-select | 跳过 | skipLevelSelect | yes | navigate/render |
| level-select | (dynamic) | selectLevel | yes | navigate/render, starts-flow |
| level-select | 不确定？做个测试 | startTest | yes | navigate/render, starts-flow |
| test | (dynamic) | goBack | yes | no-state-change |
| test | (dynamic) | answerTest | yes | no-state-change |
| test | 我不认识 | answerTest | yes | no-state-change |
| test-result | (dynamic) | goBack | yes | no-state-change |
| test-result | 返回首页 | goHome | yes | navigate/render |
| precheck | (dynamic) | speak | yes | plays-audio |
| precheck | ↑ 上滑认识 | markPrecheck | yes | no-state-change |
| precheck | ↓ 下滑不熟 | markPrecheck | yes | no-state-change |
| precheck | Ⅱ 长按侧边暂停 | handleLearningSurfaceTap | yes | plays-audio, updates-ui |
| word-study | Ⅱ 长按侧边暂停 | openPausePanel | yes | updates-ui |
| word-study | (dynamic) | noop | yes | no-state-change |
| word-study | (dynamic) | speak | yes | plays-audio |
| word-study | 记住了 | markStudy | yes | advance-flow, records-study |
| word-study | Ⅱ 长按侧边暂停 | handleLearningSurfaceTap | yes | plays-audio, updates-ui |
| group-review | Ⅱ 长按侧边暂停 | openPausePanel | yes | updates-ui |
| group-review | (dynamic) | noop | yes | no-state-change |
| group-review | (dynamic) | speak | yes | plays-audio |
| group-review | (dynamic) | speak | yes | plays-audio |
| group-review | 记住了 | rememberMixedReview | yes | navigate/render, advance-flow, records-answer |
| group-review | 记住了 | rememberGroupReview | yes | advance-flow, records-answer |
| group-review | Ⅱ 长按侧边暂停 | handleLearningSurfaceTap | yes | plays-audio, updates-ui |
| audio-meaning | Ⅱ 长按侧边暂停 | openPausePanel | yes | updates-ui |
| audio-meaning | (dynamic) | noop | yes | no-state-change |
| audio-meaning | (dynamic) | speak | yes | plays-audio |
| audio-meaning | 记住了 | rememberAudio | yes | advance-flow, records-answer |
| audio-meaning | (dynamic) | handleLearningSurfaceTap | yes | plays-audio, updates-ui |
| meaning-recall | (dynamic) | noop | yes | no-state-change |
| meaning-recall | (dynamic) | goBack | yes | no-state-change |
| meaning-recall | Ⅱ 长按侧边暂停 | openPausePanel | yes | updates-ui |
| meaning-recall | (dynamic) | noop | yes | no-state-change |
| meaning-recall | 记住了 | rememberMeaningRecall | yes | advance-flow, records-answer |
| wrong-book | (dynamic) | goBack | yes | no-state-change |
| wrong-book | · 错 次 | openDetail | yes | no-state-change |
| wrong-book | (dynamic) | speak | yes | plays-audio |
| wrong-book | 开始今日学习 | startDailyLearning | yes | navigate/render, starts-flow |
| daily-report | (dynamic) | goBack | yes | no-state-change |
| daily-report | 回到首页 | goHome | yes | navigate/render |
| daily-report | (dynamic) | closeDetail | yes | updates-ui |
| daily-report | (dynamic) | noop | yes | no-state-change |
| daily-report | (dynamic) | closeDetail | yes | updates-ui |
| daily-report | 继续学习 | closePausePanel | yes | updates-ui |
| daily-report | 继续学习 | noop | yes | no-state-change |
| daily-report | 继续学习 | closePausePanel | yes | updates-ui |
| daily-report | 暂停休息 | pauseToHome | yes | updates-ui |
| daily-report | 调整计划 | pauseToProfile | yes | navigate/render, updates-ui |
