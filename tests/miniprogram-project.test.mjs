import { readFile, stat } from "node:fs/promises";
import assert from "node:assert/strict";
import vm from "node:vm";

const projectConfig = JSON.parse(await readFile("project.config.json", "utf8"));
assert.equal(projectConfig.appid, "wxb87a2e601b3d1820");
assert.equal(projectConfig.miniprogramRoot, "miniprogram/");

const appJson = JSON.parse(await readFile("miniprogram/app.json", "utf8"));
assert.deepEqual(appJson.pages, ["pages/index/index"]);

const wordsFile = await stat("miniprogram/data/words.js");
assert.ok(wordsFile.size > 1000, "mini program word data should be generated");
assert.ok(wordsFile.size < 1_500_000, "mini program word data should stay below main package budget");

const wordsSource = await readFile("miniprogram/data/words.js", "utf8");
const dataSandbox = { module: { exports: {} } };
vm.runInNewContext(wordsSource, dataSandbox);
assert.equal(dataSandbox.module.exports.words.length, 3000, "mini program should package the full 3000-word base list");
assert.equal(dataSandbox.module.exports.wordDatasetMeta.miniProgramTotal, 3000, "mini program metadata should report 3000 packaged words");

const pageJs = await readFile("miniprogram/pages/index/index.js", "utf8");
assert.match(pageJs, /Page\(/);
assert.match(pageJs, /startDailyLearning/);
assert.match(pageJs, /scheduleAutoPlay/);
assert.match(pageJs, /playWordAudio/);
assert.match(pageJs, /view === VIEWS\.WORD_STUDY/, "word study pages should auto-play pronunciation");
assert.match(pageJs, /getCurrentGroupReviewQuestion/, "group visual review should auto-play pronunciation");
assert.match(pageJs, /onCanplay\(safePlay\)/, "audio should wait for canplay before auto-playing");
assert.match(pageJs, /retryTimer = setTimeout\(safePlay/, "audio autoplay should retry after the source is assigned");
assert.match(pageJs, /const AUTO_PLAY_DELAY_MS = 0/, "card pronunciation should start immediately after render");
assert.match(pageJs, /const AUDIO_PLAY_RETRY_MS = 80/, "audio retry fallback should not add visible delay");
assert.match(pageJs, /this\.configureAudioPlayback\(\);\n    this\.startInnerAudio\(word\);/, "playback should not wait for audio-option callback on every card");
assert.match(pageJs, /showAudioCompletionThenRender/, "audio completion should show notice before switching views");
assert.match(pageJs, /audioCompletionNotice/, "audio completion notice should stay on the audio page");
assert.match(pageJs, /audioCompletionHint/, "mixed-review hints should be shown before the mixed card appears");
assert.match(pageJs, /lastPrecheckNoticeKey = precheckNotice\.key/, "audio completion should suppress duplicate precheck notices");

const pageWxml = await readFile("miniprogram/pages/index/index.wxml", "utf8");
assert.match(pageWxml, /wx:if="{{audioCompletionNotice}}"/, "audio page should render the completion notice");
assert.doesNotMatch(pageWxml, /wx:if="{{mixedTransition}}"/, "mixed-review notice should not render on top of the mixed card");

const appJs = await readFile("miniprogram/app.js", "utf8");
assert.match(appJs, /obeyMuteSwitch: false/);
assert.match(appJs, /success: finish/, "audio option setup should call back before playback starts");

console.log("miniprogram project checks passed");
