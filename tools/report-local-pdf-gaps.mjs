import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const ownedPath = join(root, "data/gaokao-3500-owned.json");
const localRawPath = join(root, "tmp/pdf-extract/local-3500-doc-raw.txt");
const outJson = join(root, "data/local-pdf-gap-review.json");
const outDoc = join(root, "docs/local-pdf-gap-review.md");

const owned = JSON.parse(readFileSync(ownedPath, "utf8")).words;
const localEntriesByOrder = parsePrimaryDocEntries(readFileSync(localRawPath, "utf8"));

const localMissing = owned
  .filter((entry) => !entry.sourcePresence?.local)
  .map((entry) => reviewEntry(entry, "local_missing"));

const localFallbackPos = owned
  .filter((entry) => entry.sourcePresence?.local && entry.pos === "词条")
  .map((entry) => reviewEntry(entry, "local_pos_parse_failed"));

const review = {
  generatedAt: new Date().toISOString(),
  summary: {
    ownedTotal: owned.length,
    localDefinitionUsed: owned.filter((entry) => entry.definitionSource === "local_order_pdf").length,
    secondaryDefinitionUsedBecauseLocalMissing: localMissing.length,
    posFallbackTotal: owned.filter((entry) => entry.pos === "词条").length,
    localPosParseFailed: localFallbackPos.length
  },
  policy: {
    sourcePriority: "中文释义和词性优先使用《高考英语考纲3500词汇表（英汉）.doc》。主 DOC 未解析到或疑似错位时，先列入复核清单，再决定人工补录。",
    addingRule: "人工补录时保留 source=manual_from_local_pdf 或 manual_review，不能继续写 pos=词条。词性不同的同一英文词拆成多个学习项。"
  },
  lists: {
    localMissing,
    localFallbackPos
  }
};

mkdirSync(dirname(outJson), { recursive: true });
mkdirSync(dirname(outDoc), { recursive: true });
writeFileSync(outJson, `${JSON.stringify(review, null, 2)}\n`, "utf8");
writeFileSync(outDoc, renderMarkdown(review), "utf8");

console.log(`Wrote ${outJson}`);
console.log(`Wrote ${outDoc}`);
console.log(JSON.stringify(review.summary, null, 2));

function reviewEntry(entry, category) {
  const localRaw = entry.sourceOrder?.local ? localEntriesByOrder.get(entry.sourceOrder.local) || "" : "";
  return {
    ownedIndex: entry.ownedIndex,
    id: entry.id,
    word: entry.word,
    lemma: entry.lemma,
    currentPos: entry.pos,
    currentCn: entry.cn,
    definitionSource: entry.definitionSource,
    sourceOrder: entry.sourceOrder,
    category,
    localRawPreview: preview(localRaw),
    suggestedAction: suggestAction(entry, category, localRaw)
  };
}

function suggestAction(entry, category, localRaw) {
  if (category === "local_missing") {
    return "先人工检查主 DOC 是否真实缺失。若 DOC 有该词但解析未命中，补录主 DOC 词性/释义；若确实缺失，暂不进入学生端核心词库。";
  }
  if (category === "local_pos_parse_failed") {
    const hasEmbeddedPos = /(?:^|[\s\u4e00-\u9fa5=])(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|abbr|int)\s*[.。]/i.test(localRaw);
    return hasEmbeddedPos
      ? "主 DOC 原文里疑似有词性，只是解析没拆出；优先修解析器或人工补词性。"
      : "主 DOC 原文未显示明确词性；需要人工指定词性，不能继续使用“词条”。";
  }
  return "人工复核。";
}

function parsePrimaryDocEntries(text) {
  const map = new Map();
  const items = [];
  for (const rawLine of text.replace(/\r/g, "").replace(/\f/g, "\n").split("\n")) {
    const line = normaliseSpaces(rawLine)
      .replace(/[]/g, "")
      .replace(//g, " ")
      .replace(/\ba\s+d\./gi, "ad.");
    if (!line || line === "高考英语词汇全表" || /^[A-Z]$/.test(line) || /^PAGE\b/i.test(line)) continue;
    if (/^[*]?(?:interj|modal|prep|pron|conj|abbr|adj|adv|art|num|det|aux|vi|vt|ad|pl|int|n|v|a)(?:[.。])?\b/i.test(line) && items.length) {
      items[items.length - 1] = `${items[items.length - 1]} ${line}`;
      continue;
    }
    items.push(line);
  }
  for (const [index, item] of items.entries()) {
    map.set(index + 1, item);
  }
  return map;
}

function normaliseSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function preview(value) {
  const text = normaliseSpaces(value);
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function renderMarkdown(review) {
  return `# 主 DOC 缺口复核清单

生成时间：${review.generatedAt}

## 结论先行

- 当前核心学习项：${review.summary.ownedTotal}
- 已直接采用主 DOC 释义：${review.summary.localDefinitionUsed}
- 主 DOC 未命中：${review.summary.secondaryDefinitionUsedBecauseLocalMissing}
- 当前仍显示 \`词条\` 占位：${review.summary.posFallbackTotal}
- 其中主 DOC 命中但词性解析失败：${review.summary.localPosParseFailed}

## 处理原则

- 中文释义和词性优先使用《高考英语考纲3500词汇表（英汉）.doc》。
- 如果主 DOC 没有解析到，先列清单复核，不自动补入学生端核心词库。
- 如果主 DOC 有内容但解析失败，优先修解析器或人工补录。
- 不允许最终数据继续出现 \`pos: "词条"\`。

## 主 DOC 未命中

${renderTable(review.lists.localMissing)}

## 主 DOC 命中，但词性解析失败

${renderTable(review.lists.localFallbackPos)}
`;
}

function renderTable(entries) {
  if (!entries.length) return "无。\n";
  const rows = entries.map((entry) => [
    entry.ownedIndex,
    entry.word,
    entry.currentPos,
    entry.currentCn.join("；"),
    entry.sourceOrder.local || "",
    entry.suggestedAction
  ]);
  return [
    "| 序号 | 单词 | 当前词性 | 当前释义 | 主 DOC 序号 | 建议 |",
    "| ---: | --- | --- | --- | ---: | --- |",
    ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`)
  ].join("\n");
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}
