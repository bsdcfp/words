import { readFile, stat } from "node:fs/promises";
import assert from "node:assert/strict";
import vm from "node:vm";

const projectConfig = JSON.parse(await readFile("project.config.json", "utf8"));
assert.equal(projectConfig.appid, "wxb87a2e601b3d1820");
assert.equal(projectConfig.miniprogramRoot, "miniprogram/");

const appJson = JSON.parse(await readFile("miniprogram/app.json", "utf8"));
assert.deepEqual(appJson.pages, ["pages/index/index"]);
assert.ok(!appJson.permission?.["scope.record"], "scope.record should be requested at runtime; static app.json permission is invalid in the 3.16 devtools environment");

const wordsFile = await stat("miniprogram/data/words.js");
assert.ok(wordsFile.size > 1000, "mini program word data should be generated");
assert.ok(wordsFile.size < 1_500_000, "mini program word data should stay below main package budget");

const usageFile = await stat("miniprogram/data/usage.js");
assert.ok(usageFile.size > 1000, "mini program usage data should be generated separately");
assert.ok(usageFile.size < 2_500_000, "usage data should stay compact enough for the first package");

const wordsSource = await readFile("miniprogram/data/words.js", "utf8");
const dataSandbox = { module: { exports: {} } };
vm.runInNewContext(wordsSource, dataSandbox);
assert.ok(dataSandbox.module.exports.words.length >= 3300, "mini program should package the primary-source owned learning list");
assert.equal(dataSandbox.module.exports.wordDatasetMeta.groupId, "gaokao_3500_owned", "mini program should use the owned 3500 dataset");
assert.equal(dataSandbox.module.exports.wordDatasetMeta.miniProgramTotal, dataSandbox.module.exports.words.length, "mini program metadata should report packaged learning items");
assert.equal(dataSandbox.module.exports.words.some((word) => word.id.startsWith("moe_")), false, "legacy 3000 curriculum ids should not be packaged");
assert.ok(dataSandbox.module.exports.words.some((word) => word.id.startsWith("gk3500_")), "owned 3500 ids should be packaged");

const pageJs = await readFile("miniprogram/pages/index/index.js", "utf8");
assert.match(pageJs, /Page\(/);
assert.match(pageJs, /startDailyLearning/);
assert.match(pageJs, /hasSelectedWordLevel/, "vocabulary test should require a selected word level first");
assert.match(pageJs, /pendingAfterLevelSelect = VIEWS\.TEST/, "vocabulary test should continue after choosing an enabled level");
assert.match(pageJs, /id: "senior", label: "高中", enabled: true/, "only the high-school level should be enabled while the app packages high-school words");
assert.match(pageJs, /id: "primary", label: "小学", enabled: false/, "unsupported levels should be visible but disabled");
assert.match(pageJs, /scheduleAutoPlay/);
assert.match(pageJs, /startStudyPlaybackNow/, "word study should start playback directly after entering the first card");
assert.match(pageJs, /this\.saveAndRender\(VIEWS\.WORD_STUDY, \{ playImmediately: true \}\);/, "every automatic entry into word study should force immediate playback");
assert.match(pageJs, /startStudyPlaybackNow\(\)[\s\S]*this\.stopCurrentAudio\(\);/, "switching study words should stop stale audio before replaying");
assert.match(pageJs, /playWordAudio/);
assert.match(pageJs, /view === VIEWS\.WORD_STUDY/, "word study pages should auto-play pronunciation");
assert.match(pageJs, /ensureRecordPermission/, "word study should request microphone permission for read-aloud practice");
assert.match(pageJs, /const READ_ALONG_DURATION_MS = 1200/, "read-aloud detection should create a 1.2s pronunciation gap");
assert.match(pageJs, /wx\.getRecorderManager/, "read-aloud detection should use the local recorder instead of cloud recognition");
assert.match(pageJs, /onFrameRecorded/, "read-aloud detection should inspect local audio frames");
assert.match(pageJs, /hasVoiceInFrame/, "read-aloud detection should only check whether the student spoke");
assert.match(pageJs, /const READ_ALONG_REPLAY_DELAY_MS = 0/, "word study should not add extra delay beyond the 1.2s read-aloud gap");
assert.match(pageJs, /pronunciationLoopCountFor/, "word study should respect the configured pronunciation loop count");
assert.match(pageJs, /pronunciationLoopOptionsFor/, "profile should expose 3, 6, 9, and infinite playback options");
assert.match(pageJs, /setPronunciationLoopCount/, "profile should save the selected playback loop count");
assert.match(pageJs, /learningThemeOptionsFor/, "profile should expose learning page theme options");
assert.match(pageJs, /setLearningTheme/, "profile should save the selected learning page theme");
assert.match(pageJs, /learningThemeClassFor/, "learning pages should receive a theme class");
assert.match(pageJs, /continueAfterReadAlongWindow/, "word study should continue after each read-aloud detection window");
assert.match(pageJs, /stopReadAlong\(\{ silent: true \}\);[\s\S]*const value = Number\(event\.currentTarget\.dataset\.value\)/, "manual study actions should silence stale read-aloud callbacks before advancing");
assert.match(pageJs, /const shouldIgnoreStop = this\.ignoreNextReadAlongStop;[\s\S]*if \(shouldIgnoreStop\) return;/, "stale recorder stop callbacks should not drive the next word");
assert.match(pageJs, /if \(this\.currentReadAlongWordId !== word\.id\) return;/, "read-aloud continuation should only apply to the word that opened the recording window");
assert.match(pageJs, /playbackKeyFor\(view, wordId\)/, "auto-play pages should use a per-question playback key");
assert.match(pageJs, /this\.activePlaybackKey = key;[\s\S]*playReviewAudioAndReveal\(wordId, key\)/, "review playback should be tied to the active question key");
assert.match(pageJs, /if \(options\.playbackKey && this\.activePlaybackKey !== options\.playbackKey\) return;/, "stale audio callbacks should not update the next question");
assert.match(pageJs, /cancelPagePlayback\(\)[\s\S]*this\.activePlaybackKey = ""/, "manual answers should cancel stale page playback before advancing");
assert.match(pageJs, /\(this\.studyPlaybackCount \|\| 0\) < targetCount/, "word study should repeat playback until the configured loop count is complete");
assert.match(pageJs, /playStudyAudio\(wordId\)[\s\S]*this\.studyPlaybackCount = \(this\.studyPlaybackCount \|\| 0\) \+ 1/, "word study should count the initial playback as part of the configured loop total");
assert.doesNotMatch(pageJs, /audio\.onEnded\(\(\) => \{[\s\S]*this\.studyPlaybackCount = \(this\.studyPlaybackCount \|\| 0\) \+ 1/, "word study should not add an extra count after audio ends");
assert.doesNotMatch(pageJs, /continueAfterReadAlongWindow\(\)[\s\S]*flow\.markStudyWord\(this\.state, 3\)/, "word study should not auto-advance after loop completion");
assert.doesNotMatch(pageJs, /replayIfReadAlongMissingVoice/, "word study should not replay or block when no voice is detected");
assert.doesNotMatch(pageJs, /getRecordRecognitionManager/, "first version should not wait for cloud speech recognition");
assert.match(pageJs, /getCurrentGroupReviewQuestion/, "group visual review should auto-play pronunciation");
assert.match(pageJs, /reviewAnswerVisible/, "group review should delay showing meaning until the student hesitates");
assert.match(pageJs, /onComplete: \(\) => this\.revealCurrentReviewAnswer\(wordId, key\)/, "review meaning should reveal only after pronunciation completes for the active question");
const reviewRevealBody = pageJs.match(/scheduleReviewAnswerReveal\(view\) \{([\s\S]*?)\n  \},/)?.[1] || "";
assert.doesNotMatch(reviewRevealBody, /setTimeout/, "review meaning should not use a fixed timer that can beat audio playback");
assert.match(pageJs, /onCanplay\(safePlay\)/, "audio should wait for canplay before auto-playing");
assert.match(pageJs, /const MAX_AUDIO_PLAY_ATTEMPTS = 24/, "first-entry audio should retry long enough for resource preparation");
assert.match(pageJs, /playAttempts \+= 1;[\s\S]*audio\.play\(\);[\s\S]*scheduleRetry\(\);/, "audio play should retry until onPlay confirms real playback");
assert.doesNotMatch(pageJs, /const safePlay = \(\) => \{[\s\S]*playStarted = true;[\s\S]*audio\.play\(\);/, "audio should not mark playback as started before onPlay fires");
assert.match(pageJs, /const AUTO_PLAY_DELAY_MS = 0/, "card pronunciation should start immediately after render");
assert.match(pageJs, /const AUDIO_PLAY_RETRY_MS = 80/, "audio retry fallback should not add visible delay");
assert.match(pageJs, /this\.configureAudioPlayback\(\(\) => this\.startInnerAudio\(word, options\)\)/, "playback should wait for audio options before starting");
assert.match(pageJs, /showAudioCompletionThenRender/, "audio completion should show notice before switching views");
assert.match(pageJs, /audioCompletionNotice/, "audio completion notice should stay on the audio page");
assert.match(pageJs, /audioCompletionHint/, "mixed-review hints should be shown before the mixed card appears");
assert.match(pageJs, /lastPrecheckNoticeKey = precheckNotice\.key/, "audio completion should suppress duplicate precheck notices");
assert.match(pageJs, /this\.data && this\.data\.view === view/, "back navigation should not return to the same logical view");
assert.match(pageJs, /canReturnToPrecheck/, "back navigation should validate whether precheck is still a valid learning state");
assert.match(pageJs, /daily\.reviewPhase === "mixed"/, "mixed review should not allow returning to stale precheck pages");
assert.match(pageJs, /daily\.mixedQuestions && daily\.mixedQuestions\.length/, "active mixed review questions should invalidate old precheck history");
assert.match(pageJs, /saveAndRender\(VIEWS\.GROUP_REVIEW, \{ track: false \}\)/, "automatic transition into review should not pollute back history");
assert.match(pageJs, /saveAndRender\(VIEWS\.AUDIO_MEANING, \{ track: false \}\)/, "automatic transition into audio review should not pollute back history");
assert.match(pageJs, /saveAndRender\(VIEWS\.MEANING_RECALL, \{ track: false \}\)/, "audio review should transition into Chinese-to-English recall without polluting back history");
assert.match(pageJs, /moveToNextMeaningRecallQuestion/, "meaning recall should advance as its own review phase");
assert.match(pageJs, /saveAndRender\(nextView, \{ track: false \}\)/, "completion notices should switch views without adding stale history entries");
assert.match(pageJs, /this\.viewHistory = \[\];\n    this\.setData\(\{ bootError: "" \}\);/, "reset should clear stale page history");
assert.match(pageJs, /const wrongBook = buildWrongBookData\(state\);\n  const weakCount = wrongBook\.count;/, "weak-count badges should match the visible wrong-book list");
assert.match(pageJs, /buildUsageContent/, "mini program should decorate words with usage content for examples and collocations");
assert.match(pageJs, /isBetaUser/, "AI fallback visibility should be gated by beta or review status");
assert.ok(pageJs.includes('require("../../data/usage")'), "usage content should be split from the core word data file");

const pageWxml = await readFile("miniprogram/pages/index/index.wxml", "utf8");
assert.match(pageWxml, /focus-flow {{study\.themeClass}}/, "word study should use the focus-mode shell");
assert.match(pageWxml, /wx:for="{{study\.progressDots}}"/, "word study should use progress dots instead of numeric progress");
assert.doesNotMatch(pageWxml, /study-page-title">单词识记/, "word study should hide title chrome in focus mode");
assert.doesNotMatch(pageWxml, /{{study\.groupContext\.currentLabel}}/, "word study should hide group labels in focus mode");
assert.doesNotMatch(pageWxml, /bindtap="toggleStudyAudio">播放/, "word study should not show a manual play button");
assert.doesNotMatch(pageWxml, /data-value="1"[^>]*>再听听/, "word study should not reserve a fixed retry button");
assert.match(pageWxml, /class="primary-button focus-primary" data-value="3" catchtap="markStudy">记住了/, "word study should keep one primary next action");
assert.match(pageWxml, /pronunciationLoopOptions/, "profile should render playback loop options");
assert.match(pageWxml, /learningThemeOptions/, "profile should render learning theme options");
assert.match(pageWxml, /学习页主题/, "profile should let students switch learning page theme");
assert.match(pageWxml, /word-study[\s\S]*learning-view[\s\S]*{{study\.themeClass}}/, "word study should apply the configured learning theme");
assert.match(pageWxml, /group-review[\s\S]*learning-view[\s\S]*{{review\.themeClass}}/, "review should apply the configured learning theme");
assert.match(pageWxml, /read-pulse/, "word study should show read-aloud state as a quiet pulse");
assert.doesNotMatch(pageWxml, /<text class="page-title">听音辨义<\/text>/, "audio meaning should hide title chrome in focus mode");
assert.doesNotMatch(pageWxml, /{{audio\.groupContext\.currentLabel}}/, "audio meaning should hide group labels in focus mode");
assert.doesNotMatch(pageWxml, /{{audio\.word\.id}}" bindtap="openDetail">看词卡/, "audio meaning page should not distract with a word-card entry");
assert.doesNotMatch(pageWxml, /{{audio\.word\.id}}" bindtap="speak">重播/, "audio meaning page should rely on the main play button instead of duplicate replay controls");
const audioTemplate = pageWxml.slice(
  pageWxml.indexOf('<view wx:elif="{{view == \'audio-meaning\'}}"'),
  pageWxml.indexOf('<view wx:elif="{{view == \'meaning-recall\'}}"')
);
assert.match(audioTemplate, /wx:if="{{audioAnswerVisible \|\| audio\.question\.answered}}"/, "audio meaning should reveal meaning after a short recall window");
assert.doesNotMatch(audioTemplate, /bindtap="answerAudio"/, "audio meaning should not use tappable text choices before speech/self recall");
assert.doesNotMatch(audioTemplate, /听英文，说出词性和中文释义/, "audio meaning should not show instructional copy in focus mode");
assert.match(audioTemplate, /class="speaker-tile focus-speaker"/, "audio meaning should center a compact replay target");
assert.match(audioTemplate, /catchtap="rememberAudio">记住了/, "audio meaning should keep one primary next action");
assert.match(pageJs, /const REVEAL_DELAY_MS = 2000/, "focus recall should reveal after two seconds");
assert.match(pageJs, /markAudioUnfamiliar\(\)[\s\S]*audioAnswerVisible: false[\s\S]*scheduleAudioAnswerReveal\(VIEWS\.AUDIO_MEANING\)/, "audio retry should hide the meaning and restart the reveal timer");
const meaningRecallTemplate = pageWxml.slice(
  pageWxml.indexOf('<view wx:elif="{{view == \'meaning-recall\'}}"'),
  pageWxml.indexOf('<view wx:elif="{{view == \'wrong-book\'}}"')
);
assert.doesNotMatch(meaningRecallTemplate, /<text class="page-title">本组复习<\/text>/, "meaning recall should hide title chrome in focus mode");
assert.doesNotMatch(meaningRecallTemplate, /{{recall\.groupContext\.currentLabel}}/, "meaning recall should hide group labels in focus mode");
assert.doesNotMatch(meaningRecallTemplate, /看中文，回忆英文/, "meaning recall should not show instructional copy in focus mode");
assert.match(meaningRecallTemplate, /先在心里拼出英文/, "meaning recall should initially hide the English word");
assert.match(meaningRecallTemplate, /wx:if="{{recallAnswerVisible}}"/, "meaning recall should reveal the English word after a delay");
assert.match(meaningRecallTemplate, /catchtap="rememberMeaningRecall">记住了/, "meaning recall should keep one primary next action");
assert.match(pageJs, /scheduleFocusMiss/, "focus pages should auto-mark missed words after reveal");
assert.match(pageJs, /missMeaningRecallQuestion/, "meaning recall timeout should be recorded as a miss");
assert.doesNotMatch(pageWxml, /wx:if="{{mixedTransition}}"/, "mixed-review notice should not render on top of the mixed card");
assert.match(pageWxml, /选择单词水平/, "level page should use the product vocabulary-level language");
assert.match(pageWxml, /data-enabled="{{option\.enabled}}"/, "disabled vocabulary levels should not be tappable");
assert.doesNotMatch(pageWxml, /先跳过/, "vocabulary level is required before assessment and should not be skipped");
const groupReviewTemplate = pageWxml.slice(
  pageWxml.indexOf('<view wx:if="{{!review.isMixed}}"'),
  pageWxml.indexOf('<view wx:else class="focus-card audio-panel audio-minimal">')
);
assert.match(groupReviewTemplate, /wx:if="{{reviewAnswerVisible \|\| review\.question\.answered}}"/, "group review should initially keep meaning hidden");
assert.doesNotMatch(pageWxml, /{{review\.groupContext\.currentLabel}}/, "review should hide current group labels in focus mode");
assert.doesNotMatch(pageWxml, /{{review\.groupContext\.mixedLabel}}/, "mixed review should hide source group labels in focus mode");
assert.doesNotMatch(groupReviewTemplate, /bindtap="openDetail">看词卡/, "group review should not show a word-card button");
assert.doesNotMatch(groupReviewTemplate, /bindtap="speak">播放/, "group review should not show a manual play button");
assert.doesNotMatch(groupReviewTemplate, /bindtap="answerGroupReview"/, "group review should not use tappable choice options in focus mode");
assert.match(groupReviewTemplate, /focus-reveal/, "group review should reveal the original meaning inline");
const mixedReviewTemplate = pageWxml.slice(
  pageWxml.indexOf('<view wx:else class="focus-card audio-panel audio-minimal">'),
  pageWxml.indexOf('<view wx:elif="{{view == \'audio-meaning\'}}"')
);
assert.match(mixedReviewTemplate, /wx:if="{{reviewAnswerVisible \|\| review\.question\.answered}}"/, "mixed review should hide meaning until pronunciation completes");
assert.doesNotMatch(mixedReviewTemplate, /audio-tools/, "mixed review should match group review without word-card or replay tools");
assert.doesNotMatch(mixedReviewTemplate, /bindtap="answerMixed"/, "mixed review should not use tappable choice options in focus mode");
assert.match(mixedReviewTemplate, /focus-reveal/, "mixed review should use the same reveal UI as group review");
assert.doesNotMatch(pageWxml, /option-sub/, "review and audio meaning options should not split meanings into a second line");
assert.doesNotMatch(pageWxml, /toggleStudyUsage/, "word study should not expose usage toggles in focus mode");
assert.match(pageWxml, /搭配/, "usage content should show collocations before examples");
assert.match(pageWxml, /aiLabel/, "AI fallback content should have a light student-facing label");
assert.doesNotMatch(pageWxml, /translationSource/, "student-facing template should not expose internal translation audit fields");
assert.match(pageWxml, /focusPauseVisible/, "focus mode should provide a pause panel");
assert.match(pageWxml, /bindlongpress="openPausePanel"/, "focus mode should use long press for pause instead of persistent navigation");

const appJs = await readFile("miniprogram/app.js", "utf8");
assert.match(appJs, /obeyMuteSwitch: false/);
assert.match(appJs, /success: finish/, "audio option setup should call back before playback starts");

const pageWxss = await readFile("miniprogram/pages/index/index.wxss", "utf8");
assert.doesNotMatch(pageWxss, /\.audio-view\s*\{[^}]*justify-content:\s*center/s, "audio meaning page should keep the same top-down layout height as review pages");
assert.match(pageWxss, /\.audio-minimal\s*\{[^}]*min-height:\s*520rpx/s, "audio cards should keep a stable height");
assert.match(pageWxss, /\.learning-view\.learning-dark\s*\{[\s\S]*#141413/, "learning pages should default to a dark focus theme");
assert.match(pageWxss, /\.learning-dark \.primary-button\s*\{[\s\S]*#d97757/, "dark focus theme should keep the ember primary action");

console.log("miniprogram project checks passed");
