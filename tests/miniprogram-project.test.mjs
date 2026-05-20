import { readFile, stat } from "node:fs/promises";
import assert from "node:assert/strict";

const projectConfig = JSON.parse(await readFile("project.config.json", "utf8"));
assert.equal(projectConfig.appid, "wxb87a2e601b3d1820");
assert.equal(projectConfig.miniprogramRoot, "miniprogram/");

const appJson = JSON.parse(await readFile("miniprogram/app.json", "utf8"));
assert.deepEqual(appJson.pages, ["pages/index/index"]);

const wordsFile = await stat("miniprogram/data/words.js");
assert.ok(wordsFile.size > 1000, "mini program word data should be generated");
assert.ok(wordsFile.size < 1_500_000, "mini program word data should stay below main package budget");

const pageJs = await readFile("miniprogram/pages/index/index.js", "utf8");
assert.match(pageJs, /Page\(/);
assert.match(pageJs, /startDailyLearning/);
assert.match(pageJs, /scheduleAutoPlay/);
assert.match(pageJs, /playWordAudio/);
assert.match(pageJs, /view === VIEWS\.WORD_STUDY/, "word study pages should auto-play pronunciation");
assert.match(pageJs, /getCurrentGroupReviewQuestion/, "group visual review should auto-play pronunciation");
assert.match(pageJs, /onCanplay\(safePlay\)/, "audio should wait for canplay before auto-playing");
assert.match(pageJs, /retryTimer = setTimeout\(safePlay/, "audio autoplay should retry after the source is assigned");

const appJs = await readFile("miniprogram/app.js", "utf8");
assert.match(appJs, /obeyMuteSwitch: false/);
assert.match(appJs, /success: finish/, "audio option setup should call back before playback starts");

console.log("miniprogram project checks passed");
