import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const require = createRequire(import.meta.url);
const automator = require("miniprogram-automator");
const execFileAsync = promisify(execFile);

const root = process.cwd();
const cliPath = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";
const referenceRoot = "docs/design-outputs/page-references-v2-imagegen/light";
const outputRoot = "docs/design-outputs/visual-regression-v2/light";
const compareExisting = process.argv.includes("--compare-existing");
const captureScreenshots = process.argv.includes("--capture");

const allPages = [
  ["01-new-user-home", "新用户首页"],
  ["02-level-select", "选择单词水平"],
  ["03-entry-assessment", "词汇量测试"],
  ["04-assessment-result", "测评结果"],
  ["05-home-normal", "学习首页"],
  ["06-pre-learning-scan", "训前检测"],
  ["07-memorize", "单词识记"],
  ["08-word-detail-modal", "详细词卡弹窗"],
  ["09-recall-before-reveal", "回忆复习-揭示前"],
  ["10-recall-after-reveal", "回忆复习-揭示后"],
  ["11-listening", "听音辨义"],
  ["12-list-complete-animation", "完成提示"],
  ["13-wrong-words", "错词本"],
  ["14-celebration", "完成页"],
  ["15-profile-settings", "我的/设置"],
  ["16-monthly-stage-test", "月度进展/阶段测"]
];
const pageFilter = process.env.VISUAL_PAGE;
const pages = pageFilter ? allPages.filter(([id]) => id === pageFilter) : allPages;

if (pageFilter && pages.length === 0) {
  throw new Error(`Unknown VISUAL_PAGE: ${pageFilter}`);
}

await mkdir(outputRoot, { recursive: true });

const rows = [];

if (compareExisting || !captureScreenshots) {
  for (const [id, title] of pages) {
    const screenshotPath = path.join(outputRoot, `${id}.current.png`);
    const diffPath = path.join(outputRoot, `${id}.diff.png`);
    const referencePath = path.join(referenceRoot, `${id}.png`);
    const result = await compareImages(referencePath, screenshotPath, diffPath);
    rows.push({ id, title, referencePath, screenshotPath, diffPath, ...result });
  }
  await writeReport(rows);
  process.exit(0);
}

for (const [id, title] of pages) {
  let miniProgram = null;
  try {
    miniProgram = await launchAutomator();
    const row = await capturePage(miniProgram, id, title);
    rows.push(row);
    console.log(`${id} ${row.score.toFixed(1)} ${row.mismatchPercent.toFixed(2)}%`);
  } catch (error) {
    console.error(`${id} failed: ${error.message}`);
    rows.push({
      id,
      title,
      referencePath: path.join(referenceRoot, `${id}.png`),
      screenshotPath: "",
      diffPath: "",
      score: 0,
      mismatchPercent: 100,
      error: error.message
    });
  } finally {
    await closeAutomator(miniProgram);
    await writeReport(rows);
  }
}

async function launchAutomator() {
  console.log("launching WeChat DevTools automator");
  const miniProgram = await automator.launch({
    cliPath,
    projectPath: root,
    trustProject: true,
    timeout: 60000
  });
  console.log("automator connected");
  return miniProgram;
}

async function closeAutomator(miniProgram) {
  if (miniProgram) {
    await withTimeout(miniProgram.close(), 8000, "close automator").catch(() => {});
  }
  await withTimeout(execFileAsync(cliPath, ["quit"]), 5000, "quit devtools").catch(() => {});
}

async function capturePage(miniProgram, id, title) {
  console.log(`capturing ${id}`);
  const page = await withTimeout(
    miniProgram.reLaunch(`/pages/index/index?visual=${id}`),
    15000,
    `render ${id}`
  );
  console.log(`rendered ${id}`);
  await page.waitFor(1200);
  const screenshotPath = path.join(outputRoot, `${id}.current.png`);
  const diffPath = path.join(outputRoot, `${id}.diff.png`);
  await captureScreenshotWithRetry(miniProgram, screenshotPath, id);
  console.log(`screenshot ${id}`);
  const referencePath = path.join(referenceRoot, `${id}.png`);
  const result = await compareImages(referencePath, screenshotPath, diffPath);
  return { id, title, referencePath, screenshotPath, diffPath, ...result };
}

async function captureScreenshotWithRetry(miniProgram, screenshotPath, id) {
  // DevTools screenshot can be slow right after launch. Avoid issuing a second
  // screenshot while the first capture is still pending, because that can wedge
  // the automator websocket.
  await withTimeout(miniProgram.screenshot({ path: screenshotPath }), 90000, `screenshot ${id}`);
}

async function compareImages(referencePath, screenshotPath, diffPath) {
  const reference = PNG.sync.read(await readFile(referencePath));
  const current = PNG.sync.read(await readFile(screenshotPath));
  const croppedReference = cropReferenceToAppBody(reference);
  const resizedReference = resizeNearest(croppedReference, current.width, current.height);
  const diff = new PNG({ width: current.width, height: current.height });
  const mismatched = pixelmatch(
    resizedReference.data,
    current.data,
    diff.data,
    current.width,
    current.height,
    { threshold: 0.16, includeAA: false }
  );
  await writeFile(diffPath, PNG.sync.write(diff));
  const total = current.width * current.height;
  const mismatchPercent = total ? (mismatched / total) * 100 : 100;
  return {
    width: current.width,
    height: current.height,
    mismatched,
    mismatchPercent,
    score: Math.max(0, 100 - mismatchPercent)
  };
}

function cropReferenceToAppBody(image) {
  // References include a generated iOS status area. Automator screenshots start at
  // the Mini Program webview body, so compare the app body instead of fake chrome.
  const cropTop = Math.round(image.height * 0.055);
  const height = image.height - cropTop;
  const cropped = new PNG({ width: image.width, height });
  PNG.bitblt(image, cropped, 0, cropTop, image.width, height, 0, 0);
  return cropped;
}

function resizeNearest(source, width, height) {
  const target = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor((y / height) * source.height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x / width) * source.width));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      const targetIndex = (y * width + x) * 4;
      target.data[targetIndex] = source.data[sourceIndex];
      target.data[targetIndex + 1] = source.data[sourceIndex + 1];
      target.data[targetIndex + 2] = source.data[sourceIndex + 2];
      target.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }
  return target;
}

async function writeReport(items) {
  const average = items.reduce((sum, item) => sum + item.score, 0) / Math.max(items.length, 1);
  const lines = [
    "# V2 Light Visual Regression",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Average pixel score: ${average.toFixed(1)}`,
    "",
    "| Page | Score | Mismatch | Current | Diff | Reference |",
    "|---|---:|---:|---|---|---|",
    ...items.map((item) => [
      `| ${item.id} ${item.title}`,
      item.score.toFixed(1),
      item.error ? item.error : `${item.mismatchPercent.toFixed(2)}%`,
      item.screenshotPath ? imageLink(item.screenshotPath) : "",
      item.diffPath ? imageLink(item.diffPath) : "",
      imageLink(item.referencePath)
    ].join(" | ") + " |")
  ];
  await writeFile(path.join(outputRoot, "report.md"), `${lines.join("\n")}\n`);
}

function imageLink(filePath) {
  return `![${path.basename(filePath)}](${path.relative(outputRoot, filePath)})`;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    })
  ]);
}
