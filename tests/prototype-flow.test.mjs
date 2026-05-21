import assert from "node:assert/strict";
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { words } from "../data/words.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);

const { chromium } = loadPlaywright();
const selectedGroups = [
  ["flash", "duty", "energetic"],
  ["tear", "loss", "fortunately"],
  ["ballet", "alarm", "recover"]
];
const firstTwoGroupWords = selectedGroups.slice(0, 2).flat();
const mixedReviewWords = selectedGroups.flat();

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const safePath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath === "/" ? "index.html" : safePath);
  if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": types[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
});

const port = await listen(server);
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
await page.addInitScript(() => {
  window.__testTimeoutMs = 40;
  window.__spokenWords = [];
  window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
    this.text = text;
  };
  window.speechSynthesis = {
    cancel() {},
    speak(utterance) {
      window.__spokenWords.push(utterance.text);
    }
  };
});
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "重置体验数据" }).click();
  assert.match(await page.locator("#view-home").innerText(), /高考课标词/);
  assert.match(await page.locator("#view-home").innerText(), /3000 词/);
  assert.match(await page.locator("#view-home").innerText(), /自主选词/);
  assert.match(await page.locator("#view-home").innerText(), /分步练习/);
  assert.doesNotMatch(await page.locator("#view-home").innerText(), /老师/);
  assert.match(await page.locator("#view-home").innerText(), /错词本/);

  await page.getByRole("button", { name: "词汇量测试" }).click();
  await page.waitForSelector('[data-view="test"].active');
  assert.equal(await page.locator("#view-test .option-card").count(), 4);
  assert.match(await page.locator("#view-test").innerText(), /我不认识/);
  await page.waitForTimeout(70);
  assert.match(await page.locator("#view-test").innerText(), /停留太久可以选不认识/);
  for (let index = 0; index < 36; index += 1) {
    await page.locator('[data-action="answer-test"]').first().click();
  }
  await page.waitForSelector('[data-view="test-result"].active');
  assert.match(await page.locator("#view-test-result").innerText(), /现实掌握词汇/);
  await page.locator('#view-test-result [data-action="go-home"].primary-button').click();

  await page.getByRole("button", { name: "开始今日学习" }).click();
  await page.waitForSelector('[data-view="precheck"].active');
  assert.match(await page.locator("#view-precheck").innerText(), /训前检测/);
  assert.match(await page.locator("#view-precheck").innerText(), /book/, "vocabulary assessment should move the first precheck window to shuffled foundation words");
  assert.doesNotMatch(await page.locator("#view-precheck").innerText(), /\ba\b/, "foundation precheck should not start with single-letter function words");
  await page.getByRole("button", { name: "返回首页" }).click();
  await page.getByRole("button", { name: "重置体验数据" }).click();
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await page.waitForSelector('[data-view="precheck"].active');
  assert.match(await page.locator("#view-precheck").innerText(), /flash/);
  const precheckFooter = page.locator('#view-precheck .bottom-actions');
  const initialCards = page.locator('#view-precheck .precheck-row');
  assert.equal(await initialCards.count(), 9);
  assert.match(await precheckFooter.innerText(), /已选 0\/3/);
  await page.locator('[data-action="confirm-precheck"]').evaluate((button) => {
    if (!button.disabled) throw new Error("Start button should be disabled until three words are selected");
  });
  await page.locator('#view-precheck [data-action="mark-precheck"][data-value="unfamiliar"]').nth(0).click();
  await page.locator('#view-precheck [data-action="mark-precheck"][data-value="unfamiliar"]').nth(1).click();
  await page.locator('#view-precheck [data-action="mark-precheck"][data-value="unfamiliar"]').nth(2).click();
  await page.waitForSelector('[data-view="word-study"].active');

  for (let groupIndex = 0; groupIndex < 3; groupIndex += 1) {
    await page.waitForSelector('[data-view="word-study"].active');
    assert.match(await page.locator("#view-word-study").innerText(), /记忆图/);
    assert.match(await page.locator("#view-word-study").innerText(), /词性/);
    assert.match(await page.locator("#view-word-study").innerText(), /场景/);
    assert.equal(await page.locator("#view-word-study svg.memory-illustration").count(), 1);
    assert.match(await page.locator("#view-word-study").innerText(), /1\/3/);
    await waitForSpoken(page, selectedGroups[groupIndex][0]);
    for (let index = 0; index < 3; index += 1) {
      await page.getByRole("button", { name: "已记住" }).click();
      if (index < 2) {
        await waitForSpoken(page, selectedGroups[groupIndex][index + 1]);
      }
    }
    await page.waitForSelector('[data-view="group-review"].active');
    assert.match(await page.locator("#view-group-review").innerText(), /看词辨义/);
    assert.equal(await page.locator('#view-group-review [data-action="answer-group-review"]').count(), 4);
    for (let index = 0; index < 3; index += 1) {
      await clickAnswer(page, "answer-group-review", meaningFor(selectedGroups[groupIndex][index]));
      if (index < 2) {
        await waitForText(page, "#view-group-review.active", `${index + 2}/3`);
      }
    }

    await page.waitForSelector('[data-view="audio-meaning"].active');
    assert.match(await page.locator("#view-audio-meaning").innerText(), /1\/3/);
    await page.waitForFunction(() => window.__spokenWords.length > 0);
    if (groupIndex === 0) {
      await page.locator('[data-action="answer-audio"]').filter({ hasNotText: meaningFor("flash") }).first().click();
      await page.locator('[data-action="next-audio"]:not([disabled])').click();
      await waitForText(page, "#view-audio-meaning.active", "2/4");
      await clickAnswer(page, "answer-audio", meaningFor("duty"));
      await waitForText(page, "#view-audio-meaning.active", "3/4");
      await clickAnswer(page, "answer-audio", meaningFor("energetic"));
      await waitForText(page, "#view-audio-meaning.active", "4/4");
      await clickAnswer(page, "answer-audio", meaningFor("flash"));
    } else {
      for (let index = 0; index < 3; index += 1) {
        await clickAnswer(page, "answer-audio", meaningFor(selectedGroups[groupIndex][index]));
        if (index < 2) {
          await waitForText(page, "#view-audio-meaning.active", `${index + 2}/3`);
        }
      }
    }
    if (groupIndex === 0) {
      await page.waitForSelector('[data-view="precheck"].active');
      assert.match(await page.locator("#view-precheck").innerText(), /本组完成/);
      assert.match(await precheckFooter.innerText(), new RegExp(`已选 0/3`));
      assert.equal(await page.locator('#view-precheck .precheck-row').count(), 6 - groupIndex * 3);
      await page.getByRole("button", { name: "自动选词" }).click();
      assert.match(await precheckFooter.innerText(), /已选 3\/3/);
      await page.getByRole("button", { name: "开始识记" }).click();
    } else if (groupIndex === 1) {
      await answerMixedReview(page, firstTwoGroupWords);
      await page.waitForSelector('[data-view="precheck"].active');
      assert.match(await page.locator("#view-precheck").innerText(), /2 组混合复习完成/);
      assert.match(await precheckFooter.innerText(), new RegExp(`已选 0/3`));
      assert.equal(await page.locator('#view-precheck .precheck-row').count(), 3);
      await page.getByRole("button", { name: "自动选词" }).click();
      assert.match(await precheckFooter.innerText(), /已选 3\/3/);
      await page.getByRole("button", { name: "开始识记" }).click();
    }
  }

  await answerMixedReview(page, mixedReviewWords);

  await page.waitForSelector('[data-view="precheck"].active');
  assert.match(await page.locator("#view-precheck").innerText(), /上一轮完成/);
  assert.match(await page.locator("#view-precheck").innerText(), /file/);
  assert.equal(await page.locator('#view-precheck .precheck-row').count(), 9);
  await page.getByRole("button", { name: "返回首页" }).click();
  assert.match(await page.locator("#view-home").innerText(), /连续打卡 1 天/);
  await page.getByRole("button", { name: /错词本/ }).click();
  await page.waitForSelector('[data-view="wrong-book"].active');
  assert.match(await page.locator("#view-wrong-book").innerText(), /flash/);

  await page.reload({ waitUntil: "networkidle" });
  assert.match(await page.locator("#view-home").innerText(), /现实词汇量/);
  assert.equal(errors.length, 0, `Console/page errors:\n${errors.join("\n")}`);
} finally {
  await browser.close();
  server.close();
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    return createRequire("/Users/fuping.chu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/")("playwright");
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

function listen(instance) {
  return new Promise((resolve) => {
    instance.listen(0, "127.0.0.1", () => resolve(instance.address().port));
  });
}

function meaningFor(headword) {
  const word = words.find((item) => item.word === headword);
  if (!word) throw new Error(`Missing test word: ${headword}`);
  return word.cn.join("，");
}

async function clickAnswer(page, action, meaning) {
  await page.locator(`[data-action="${action}"]`).filter({ hasText: meaning }).first().click();
}

async function answerMixedReview(page, headwords) {
  await page.waitForSelector('[data-view="group-review"].active');
  assert.match(await page.locator("#view-group-review").innerText(), /混组/);
  assert.match(await page.locator("#view-group-review").innerText(), new RegExp(`${headwords.length} 个词`));
  assert.match(await page.locator("#view-group-review").innerText(), new RegExp(`1/${headwords.length}`));
  assert.equal(await page.locator('#view-group-review [data-action="answer-mixed"]').count(), 4);
  const questionHeadwords = headwords;
  for (let index = 0; index < questionHeadwords.length; index += 1) {
    await clickAnswer(page, "answer-mixed", meaningFor(questionHeadwords[index]));
    if (index < questionHeadwords.length - 1) {
      await waitForText(page, "#view-group-review.active", `${index + 2}/${questionHeadwords.length}`);
    }
  }
}

async function waitForText(page, selector, text) {
  await page.waitForFunction(
    ({ selector: targetSelector, text: targetText }) => document.querySelector(targetSelector)?.innerText.includes(targetText),
    { selector, text }
  );
}

async function waitForSpoken(page, headword) {
  await page.waitForFunction(
    (word) => window.__spokenWords.includes(word),
    headword,
    { timeout: 2000 }
  );
}
