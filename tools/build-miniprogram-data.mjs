import { readFile, writeFile } from "node:fs/promises";

const ownedDataset = JSON.parse(await readFile(new URL("../data/gaokao-3500-owned.json", import.meta.url), "utf8"));
const usageDataset = await readOptionalJson(new URL("../data/oald-usage.json", import.meta.url));
const usageByWordId = usageDataset?.usageByWordId || {};
const words = ownedDataset.words.map(compactWord);
const wordDatasetMeta = {
  groupId: ownedDataset.meta.groupId,
  groupName: ownedDataset.meta.groupName,
  description: ownedDataset.meta.description,
  total: ownedDataset.meta.total,
  miniProgramTotal: words.length,
  sourceUrl: "local:高考英语考纲3500词汇表（英汉）.doc",
  dictionary: {
    source: "高考英语考纲3500词汇表（英汉）.doc",
    source_url: "",
    license: "自有校准版",
    matched: words.length,
    missing: 0
  }
};

const testQuestions = buildTestQuestions(words);
const compactUsageByWordId = compactUsageMap(usageByWordId);

const compactMeta = {
  groupId: wordDatasetMeta.groupId,
  groupName: wordDatasetMeta.groupName,
  description: wordDatasetMeta.description,
  total: wordDatasetMeta.total,
  miniProgramTotal: words.length,
  sourceUrl: wordDatasetMeta.sourceUrl,
  dictionary: wordDatasetMeta.dictionary
};

await writeFile(
  new URL("../miniprogram/data/words.js", import.meta.url),
  `const wordDatasetMeta = ${JSON.stringify(compactMeta, null, 2)};\n\nconst words = ${JSON.stringify(words, null, 2)};\n\nmodule.exports = { wordDatasetMeta, words };\n`
);

await writeFile(
  new URL("../miniprogram/data/test-questions.js", import.meta.url),
  `const testQuestions = ${JSON.stringify(testQuestions, null, 2)};\n\nmodule.exports = { testQuestions };\n`
);

await writeFile(
  new URL("../miniprogram/data/usage.js", import.meta.url),
  `const usageByWordId = ${JSON.stringify(compactUsageByWordId, null, 2)};\n\nmodule.exports = { usageByWordId };\n`
);

function compactWord(word) {
  const sourceIndex = Number(word.ownedIndex || 0);
  const starLevel = stageForOwnedIndex(sourceIndex);
  const item = {
    id: word.id,
    word: word.word,
    ipa: word.phonetics?.en || word.ipa,
    phonetics: {
      en: word.phonetics?.en || word.ipa || "",
      us: word.phonetics?.us || ""
    },
    pos: word.pos,
    displayPos: displayPosFor(word),
    cn: word.cn,
    starLevel,
    sourceIndex
  };
  if (word.sameLemmaHint) item.sameLemmaHint = word.sameLemmaHint;
  if (word.lemma && word.lemma !== word.word) item.lemma = word.lemma;
  return item;
}

function displayPosFor(word) {
  const text = String(word.word || "").trim();
  if (/\s/.test(text)) return "词组";
  return word.pos;
}

async function readOptionalJson(url) {
  try {
    return JSON.parse(await readFile(url, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function compactUsageMap(source) {
  return Object.fromEntries(
    Object.entries(source || {})
      .map(([wordId, usage]) => [wordId, compactUsage(usage)])
      .filter(([, usage]) => usage.collocations || usage.example || usage.aiFallback)
  );
}

function compactUsage(usage) {
  const item = {};
  const collocations = compactCollocations(usage.collocations);
  if (collocations.length) item.collocations = collocations;
  const example = compactExample(usage.example);
  if (example) item.example = example;
  const aiFallback = compactExample(usage.aiFallback);
  if (aiFallback) {
    item.aiFallback = aiFallback;
    const fallbackCollocations = compactCollocations(usage.aiFallback.collocations);
    if (fallbackCollocations.length) item.aiFallback.collocations = fallbackCollocations;
  }
  return item;
}

function compactCollocations(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === "string") return { text: item, contentType: "dictionary" };
      if (!item || typeof item !== "object") return null;
      const text = item.text || item.en || item.phrase || "";
      if (!text) return null;
      return {
        text,
        cn: item.cn || "",
        contentType: item.contentType || "dictionary",
        reviewStatus: item.reviewStatus || ""
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function compactExample(item) {
  if (!item || typeof item !== "object" || !item.en) return null;
  return {
    en: item.en,
    cn: item.cn || "",
    contentType: item.contentType || "dictionary",
    reviewStatus: item.reviewStatus || "",
    translationSource: item.translationSource || ""
  };
}

function stageForOwnedIndex(index) {
  if (index <= 1200) return 1;
  if (index <= 2400) return 2;
  return 0;
}

function buildTestQuestions(items) {
  const layers = [
    { layer: "foundation", starLevel: 0, count: 16 },
    { layer: "required", starLevel: 1, count: 17 },
    { layer: "selective", starLevel: 2, count: 17 }
  ];
  return layers.flatMap((config) => {
    const layerWords = items.filter((word) => word.starLevel === config.starLevel);
    const step = Math.max(1, Math.floor(layerWords.length / config.count));
    return Array.from({ length: config.count }, (_, index) => {
      const word = layerWords[(index * step) % layerWords.length];
      return createTestQuestion(word, config.layer, index, items);
    });
  });
}

function createTestQuestion(word, layer, index, items) {
  const answer = word.cn.join("，");
  return {
    id: `gaokao_3500_test_${layer}_${String(index + 1).padStart(2, "0")}`,
    word: word.word,
    sourceWordId: word.id,
    layer,
    options: [answer, "不认识"],
    answer
  };
}
