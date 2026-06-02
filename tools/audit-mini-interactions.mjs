import { readFile, writeFile } from "node:fs/promises";

const wxmlPath = new URL("../miniprogram/pages/index/index.wxml", import.meta.url);
const jsPath = new URL("../miniprogram/pages/index/index.js", import.meta.url);
const reportPath = new URL("../docs/interaction-audit.md", import.meta.url);

const wxml = await readFile(wxmlPath, "utf8");
const js = await readFile(jsPath, "utf8");
const auditAsyncBoundaries = new Set([
  "startInnerAudio",
  "startReadAlongWindow",
  "continueAfterReadAlongWindow",
  "scheduleAutoPlay",
  "scheduleFocusReveal",
  "scheduleFocusMiss",
  "showAudioCompletionThenRender"
]);
const bindings = extractBindings(wxml);
const pageMethods = extractMethodNames(js);
const contractHandlers = [
  "markGroupReviewUnfamiliar",
  "markAudioUnfamiliar",
  "rememberGroupReview",
  "rememberAudio",
  "markMixedUnfamiliar",
  "rememberMixedReview",
  "rememberMeaningRecall",
  "retryMeaningRecall",
  "markStudy",
  "answerReviewQuestion",
  "advanceReviewQuestion",
  "rememberAudioQuestion",
  "rememberRecallQuestion",
  "rememberReviewQuestion",
  "retryReviewQuestion"
];
const uniqueHandlers = [...new Set(bindings.map((binding) => binding.handler).concat(contractHandlers).concat(pageMethods))].sort();
const handlerBodies = Object.fromEntries(uniqueHandlers.map((handler) => [handler, extractMethodBody(js, handler)]));
const audits = buildAudits(bindings, handlerBodies);
const contractResults = checkContracts(handlerBodies);

await writeFile(reportPath, renderReport(bindings, audits, contractResults), "utf8");

const failed = contractResults.filter((item) => !item.pass);
if (failed.length) {
  console.error(`Interaction audit failed: ${failed.map((item) => item.name).join(", ")}`);
  process.exit(1);
}

console.log(`Interaction audit passed. Report: ${reportPath.pathname}`);

function extractBindings(source) {
  const results = [];
  const tagPattern = /<([a-z-]+)\b([^>]*)>/g;
  let match;
  while ((match = tagPattern.exec(source))) {
    const [, tag, attrs] = match;
    const handler = attr(attrs, "bindtap") || attr(attrs, "catchtap");
    if (!handler) continue;
    const context = nearestViewContext(source.slice(0, match.index));
    const text = textNear(source, tagPattern.lastIndex, tag);
    results.push({
      context,
      tag,
      handler,
      label: normaliseLabel(text),
      dataAction: attr(attrs, "data-action"),
      dataValue: attr(attrs, "data-value"),
      dataCount: attr(attrs, "data-count")
    });
  }
  return results;
}

function attr(attrs, name) {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match ? match[1] : "";
}

function nearestViewContext(prefix) {
  const matches = [...prefix.matchAll(/view\s*(?:==|=)=?\s*'([^']+)'/g)];
  return matches.length ? matches[matches.length - 1][1] : "unknown";
}

function textNear(source, startIndex, tag) {
  const endTag = `</${tag}>`;
  const endIndex = source.indexOf(endTag, startIndex);
  if (endIndex < 0 || endIndex - startIndex > 600) return "";
  return source.slice(startIndex, endIndex);
}

function normaliseLabel(source) {
  return source
    .replace(/<[^>]+>/g, " ")
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "(dynamic)";
}

function extractMethodNames(source) {
  return [...source.matchAll(/\n\s{2}([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)]
    .map((match) => match[1]);
}

function extractMethodBody(source, methodName) {
  const pattern = new RegExp(`\\n\\s*${escapeRegExp(methodName)}\\s*\\(`, "m");
  const match = pattern.exec(source);
  if (!match) return "";
  const openBraceIndex = source.indexOf("{", match.index + match[0].length);
  if (openBraceIndex < 0) return "";
  const bodyStart = openBraceIndex + 1;
  let depth = 1;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart, index) || "__empty__";
  }
  return "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildAudits(bindings, bodies) {
  return bindings.map((binding) => {
    const body = bodies[binding.handler] || "";
    const expandedBody = expandBindingBody(bodies, binding);
    return Object.assign({}, binding, {
      effects: classifyEffects(expandedBody || body),
      handlerFound: Boolean(body)
    });
  });
}

function expandBindingBody(bodies, binding) {
  const immediateOptions = { skip: auditAsyncBoundaries };
  if (binding.handler === "speak") {
    if (binding.context === "word-study") return expandMethodBody(bodies, "restartStudyPlayback", new Set(), immediateOptions);
    if (binding.context === "group-review") return expandMethodBody(bodies, "retryReviewQuestion", new Set(), immediateOptions);
    if (binding.context === "audio-meaning") return expandMethodBody(bodies, "markAudioUnfamiliar", new Set(), immediateOptions);
    return "playWordAudio";
  }
  if (binding.handler === "handleLearningSurfaceTap") {
    if (binding.context === "word-study") return expandMethodBody(bodies, "restartStudyPlayback", new Set(), immediateOptions);
    if (binding.context === "group-review") return expandMethodBody(bodies, "retryReviewQuestion", new Set(), immediateOptions);
    if (binding.context === "audio-meaning") return expandMethodBody(bodies, "markAudioUnfamiliar", new Set(), immediateOptions);
    if (binding.context === "meaning-recall") return expandMethodBody(bodies, "retryMeaningRecall", new Set(), immediateOptions);
  }
  return expandMethodBody(bodies, binding.handler, new Set(), immediateOptions);
}

function classifyEffects(body) {
  const effects = [];
  if (!body) return ["missing-handler"];
  if (body === "__empty__") return ["no-state-change"];
  if (/saveAndRender\(VIEWS\./.test(body)) effects.push("navigate/render");
  if (/advanceAfterStudyWord|advanceGroupReview|advanceReviewQuestion|advanceAfterGroupReviewPhase|advanceAfterMixedPhase|advanceAfterAudioPhase|advanceAfterMeaningRecallPhase|renderAfterMixedReview|advanceMixedReview/.test(body)) effects.push("advance-flow");
  if (/answer(GroupReview|Audio|MixedReview|MeaningRecall)Question/.test(body)) effects.push("records-answer");
  if (/markStudyWord/.test(body)) effects.push("records-study");
  if (/playWordAudio|playReviewAudioAndReveal|playStudyAudio/.test(body)) effects.push("plays-audio");
  if (/startDailyLearning|startAssessment|confirmPrecheck/.test(body)) effects.push("starts-flow");
  if (/setData/.test(body)) effects.push("updates-ui");
  if (/settings\./.test(body)) effects.push("updates-settings");
  return effects.length ? effects : ["no-state-change"];
}

function checkContracts(bodies) {
  const expanded = (handler) => expandMethodBody(bodies, handler);
  const immediate = (handler) => expandMethodBody(bodies, handler, new Set(), {
    skip: new Set(["scheduleFocusMiss", "handleFocusMiss", "advanceAfterGroupMiss", "advanceAfterMixedMiss", "advanceAfterAudioMiss"])
  });
  return [
    {
      name: "本组复习-再想想不应加入错词",
      pass: !/answerReviewQuestion|answerGroupReviewQuestion/.test(immediate("markGroupReviewUnfamiliar")) && /playReviewAudioAndReveal/.test(immediate("markGroupReviewUnfamiliar")),
      expected: "markGroupReviewUnfamiliar 只播放当前词并在播放后揭示，不调用 answerGroupReviewQuestion"
    },
    {
      name: "听音辨义-再想想不应加入错词",
      pass: !/answerAudioQuestion/.test(immediate("markAudioUnfamiliar")) && /playAudioMeaningAndReveal|playWordAudio/.test(immediate("markAudioUnfamiliar")),
      expected: "markAudioUnfamiliar 只重播当前词，不调用 answerAudioQuestion"
    },
    {
      name: "本组复习-记住了应进入下一题",
      pass: /rememberReviewQuestion\("group"\)|answerGroupReviewQuestion/.test(bodies.rememberGroupReview || "") && /answerReviewQuestion|answerGroupReviewQuestion/.test(expanded("rememberGroupReview")) && /advanceReviewQuestion|advanceGroupReview/.test(expanded("rememberGroupReview")),
      expected: "rememberGroupReview 记录正确答案并推进"
    },
    {
      name: "听音辨义-记住了应进入下一题",
      pass: /answerAudioQuestion/.test(expanded("rememberAudio")) && /advanceAfterAudioPhase/.test(expanded("rememberAudio")),
      expected: "rememberAudio 记录正确答案并推进"
    },
    {
      name: "混组复习-再想想不应加入错词",
      pass: !/answerReviewQuestion|answerMixedReviewQuestion/.test(immediate("markMixedUnfamiliar")) && /playReviewAudioAndReveal/.test(immediate("markMixedUnfamiliar")),
      expected: "markMixedUnfamiliar 只播放当前词并在播放后揭示，不调用 answerMixedReviewQuestion"
    },
    {
      name: "混组复习-记住了应进入下一题",
      pass: /rememberReviewQuestion\("mixed"\)|answerMixedReviewQuestion/.test(bodies.rememberMixedReview || "") && /answerReviewQuestion|answerMixedReviewQuestion/.test(expanded("rememberMixedReview")) && /advanceReviewQuestion|moveToNextMixedReviewQuestion/.test(expanded("rememberMixedReview")),
      expected: "rememberMixedReview 记录正确答案并推进"
    },
    {
      name: "看中文回忆英文-记住了应进入下一题",
      pass: /answerMeaningRecallQuestion/.test(expanded("rememberMeaningRecall")) && /moveToNextMeaningRecallQuestion/.test(expanded("rememberMeaningRecall")),
      expected: "rememberMeaningRecall 记录正确答案并推进"
    },
    {
      name: "看中文回忆英文-再想想只重置揭示计时",
      pass: !/answerMeaningRecallQuestion/.test(bodies.retryMeaningRecall || "") && /scheduleMeaningRecallReveal/.test(bodies.retryMeaningRecall || ""),
      expected: "retryMeaningRecall 不记录答案，只重新等待 2 秒揭示英文"
    },
    {
      name: "单词识记-再听听只重启当前轮",
      pass: /value < 3/.test(bodies.markStudy || "") && /restartStudyPlayback/.test(bodies.markStudy || ""),
      expected: "markStudy 的再听听分支不推进，只重启播放"
    },
    {
      name: "焦点页喇叭不应绕过播放后揭示链路",
      pass: /restartStudyPlayback/.test(expanded("speak")) && /retryReviewQuestion/.test(expanded("speak")) && /markAudioUnfamiliar/.test(expanded("speak")),
      expected: "speak 在单词识记/复习/听音辨义中分别走对应的安全 replay handler"
    },
    {
      name: "混组复习提示应在进入卡片前显示",
      pass: /buildCompletionTransition/.test(expanded("showAudioCompletionThenRender")) && /nextView === VIEWS\.GROUP_REVIEW/.test(expanded("showAudioCompletionThenRender")) && /audioCompletionNotice/.test(expanded("showAudioCompletionThenRender")),
      expected: "showAudioCompletionThenRender 对 GROUP_REVIEW 先设置提示，再延迟渲染目标页面"
    }
  ];
}

function expandMethodBody(bodies, methodName, seen = new Set(), options = {}) {
  if (options.skip && options.skip.has(methodName)) return "";
  if (seen.has(methodName)) return "";
  seen.add(methodName);
  const body = bodies[methodName] || "";
  const calls = [...body.matchAll(/this\.([A-Za-z0-9_]+)\(/g)]
    .map((match) => match[1])
    .filter((name) => bodies[name]);
  return [body].concat(calls.map((name) => expandMethodBody(bodies, name, seen, options))).join("\n");
}

function renderReport(bindings, audits, contracts) {
  const generatedAt = new Date().toISOString();
  const rows = audits.map((item) => (
    `| ${item.context} | ${escapeTable(item.label)} | ${item.handler} | ${item.handlerFound ? "yes" : "no"} | ${item.effects.join(", ")} |`
  )).join("\n");
  const contractRows = contracts.map((item) => (
    `| ${item.pass ? "通过" : "失败"} | ${escapeTable(item.name)} | ${escapeTable(item.expected)} |`
  )).join("\n");
  return `# 交互路径自动巡检

生成时间：${generatedAt}

## 契约校验

| 状态 | 规则 | 期望 |
| --- | --- | --- |
${contractRows}

## 按钮路径清单

共扫描 ${bindings.length} 个点击入口，${new Set(bindings.map((item) => item.handler)).size} 个 handler。

| 页面 | 按钮/入口 | Handler | 存在 | 触发路径 |
| --- | --- | --- | --- | --- |
${rows}
`;
}

function escapeTable(value) {
  return String(value || "").replace(/\|/g, "\\|");
}
