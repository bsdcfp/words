# 交互路径自动巡检

生成时间：2026-06-09T12:14:39.486Z

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
| 通过 | 焦点页喇叭不应绕过播放后揭示链路 | speak 在单词识记/复习/听音辨义中分别走对应的安全 replay handler |
| 通过 | 混组复习提示应在进入卡片前显示 | showAudioCompletionThenRender 对 GROUP_REVIEW 先设置提示，再延迟渲染目标页面 |

## 按钮路径清单

共扫描 65 个点击入口，34 个 handler。

| 页面 | 按钮/入口 | Handler | 存在 | 触发路径 |
| --- | --- | --- | --- | --- |
| home | 重置体验数据 | resetData | yes | navigate/render, updates-ui |
| home | (dynamic) | openLevelSelect | yes | navigate/render |
| home | (dynamic) | startDailyLearning | yes | navigate/render, starts-flow |
| home | 选择后可随时在【我的】中更改 | openProfile | yes | navigate/render |
| home | 个错词待复习 晚间入口已开启 | openWrongBook | yes | navigate/render, updates-ui |
| profile | (dynamic) | openLevelSelect | yes | navigate/render |
| profile | (dynamic) | openMonthProgress | yes | navigate/render |
| profile | 个错词待复习 | openWrongBook | yes | navigate/render, updates-ui |
| profile | 入学测 36 题 | startTest | yes | navigate/render, starts-flow |
| profile | 阶段测 题 | startStageTest | yes | navigate/render |
| profile | (dynamic) | confirmReset | yes | navigate/render, updates-ui |
| month-progress | (dynamic) | goBack | yes | no-state-change |
| month-progress | (dynamic) | shiftProgressMonth | yes | navigate/render |
| month-progress | (dynamic) | shiftProgressMonth | yes | navigate/render |
| month-progress | 开始阶段测 | startStageTest | yes | navigate/render |
| level-select | 跳过 | skipLevelSelect | yes | navigate/render |
| level-select | (dynamic) | selectLevel | yes | navigate/render, starts-flow |
| level-select | 不确定？做个测试 | takeLevelTest | yes | navigate/render, starts-flow |
| test | (dynamic) | goBack | yes | no-state-change |
| test | (dynamic) | answerTest | yes | no-state-change |
| test | 不认识 | answerTest | yes | no-state-change |
| test-result | 完成 | openProfile | yes | navigate/render |
| test-result | 开始学习 | startDailyLearning | yes | navigate/render, starts-flow |
| test-result | 重新选择水平 | openLevelSelect | yes | navigate/render |
| precheck | (dynamic) | speak | yes | plays-audio |
| precheck | 认识 | markPrecheck | yes | navigate/render |
| precheck | 不熟 | markPrecheck | yes | navigate/render |
| precheck | Ⅱ 长按侧边暂停 | handleLearningSurfaceTap | yes | plays-audio, updates-ui |
| word-study | (dynamic) | noop | yes | no-state-change |
| word-study | (dynamic) | speak | yes | plays-audio, updates-ui |
| word-study | 记住了 | markStudy | yes | navigate/render, advance-flow, records-study, plays-audio, updates-ui |
| word-study | Ⅱ 长按侧边暂停 | handleLearningSurfaceTap | yes | plays-audio, updates-ui |
| group-review | (dynamic) | noop | yes | no-state-change |
| group-review | (dynamic) | speak | yes | plays-audio, updates-ui |
| group-review | 记住了 | rememberMixedReview | yes | navigate/render, advance-flow, records-answer, updates-ui |
| group-review | 记住了 | rememberGroupReview | yes | navigate/render, advance-flow, records-answer, updates-ui |
| group-review | Ⅱ 长按侧边暂停 | handleLearningSurfaceTap | yes | plays-audio, updates-ui |
| audio-meaning | (dynamic) | noop | yes | no-state-change |
| audio-meaning | (dynamic) | speak | yes | plays-audio, updates-ui |
| audio-meaning | 记住了 | rememberAudio | yes | navigate/render, advance-flow, records-answer, updates-ui |
| audio-meaning | (dynamic) | handleLearningSurfaceTap | yes | plays-audio, updates-ui |
| meaning-recall | (dynamic) | noop | yes | no-state-change |
| meaning-recall | (dynamic) | goBack | yes | no-state-change |
| meaning-recall | (dynamic) | noop | yes | no-state-change |
| meaning-recall | 记住了 | rememberMeaningRecall | yes | navigate/render, advance-flow, records-answer |
| wrong-book | (dynamic) | goBack | yes | no-state-change |
| wrong-book | (dynamic) | toggleWrongBookEdit | yes | updates-ui |
| wrong-book | 开始复习 | startWrongReview | yes | navigate/render, starts-flow |
| wrong-book | 移除 | openDetail | yes | updates-ui |
| wrong-book | 移除 | removeWrongWord | yes | navigate/render |
| wrong-book | (dynamic) | startDailyLearning | yes | navigate/render, starts-flow |
| daily-report | 已完成 词、 小时 | goHome | yes | navigate/render |
| daily-report | 错词复习 | openWrongBook | yes | navigate/render, updates-ui |
| daily-report | (dynamic) | closeDetail | yes | updates-ui |
| daily-report | (dynamic) | noop | yes | no-state-change |
| daily-report | (dynamic) | closeDetail | yes | updates-ui |
| daily-report | 继续学习 | closePausePanel | yes | updates-ui |
| daily-report | 继续学习 | noop | yes | no-state-change |
| daily-report | 继续学习 | closePausePanel | yes | updates-ui |
| daily-report | 暂停休息 | pauseToHome | yes | navigate/render, updates-ui |
| daily-report | 调整计划 | pauseToProfile | yes | navigate/render, updates-ui |
| home | 单词 | openWordsTab | yes | navigate/render |
| home | 我的 | openProfile | yes | navigate/render |
| profile | 单词 | openWordsTab | yes | navigate/render |
| profile | 我的 | openProfile | yes | navigate/render |
