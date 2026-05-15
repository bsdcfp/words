import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const curriculumPdf = join(root, "data_sources/moe-high-school-english-curriculum-2017-2020.pdf");
const ecdictCsv = join(root, "data_sources/ecdict.csv");
const textFile = join(root, "tmp/curriculum-raw-128-190.txt");
const wordsOut = join(root, "data/words.js");
const questionsOut = join(root, "data/test-questions.js");
const reportOut = join(root, "data/word-source-report.json");

const curriculumSourceUrl = "https://www.pep.com.cn/xw/zt/rjwy/gzkb2020/202205/P020220517522153664167.pdf";
const dictionarySourceUrl = "https://github.com/skywind3000/ECDICT";

if (!existsSync(curriculumPdf)) {
  throw new Error(`Missing curriculum PDF: ${curriculumPdf}`);
}

if (!existsSync(ecdictCsv)) {
  throw new Error(`Missing ECDICT CSV: ${ecdictCsv}`);
}

execFileSync("pdftotext", ["-raw", "-f", "128", "-l", "190", curriculumPdf, textFile], {
  stdio: "inherit"
});

const curriculumEntries = parseCurriculumWords(readFileSync(textFile, "utf8"));
const dictionary = parseEcdict(readFileSync(ecdictCsv, "utf8"));
const words = curriculumEntries.map((entry, index) => buildWordItem(entry, index, dictionary));
const testQuestions = buildTestQuestions(words);
const report = buildReport(words, testQuestions);

writeFileSync(wordsOut, renderWordsModule(words, report), "utf8");
writeFileSync(questionsOut, renderQuestionsModule(testQuestions), "utf8");
writeFileSync(reportOut, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`Generated ${words.length} curriculum words -> ${wordsOut}`);
console.log(`Generated ${testQuestions.length} assessment questions -> ${questionsOut}`);
console.log(`Dictionary matches: ${report.dictionary.matched}/${words.length}`);

function parseCurriculumWords(text) {
  const lines = text.replace(/\f/g, "\n").split(/\n/).map((line) => line.trim()).filter(Boolean);
  const start = lines.findIndex((line) => line === "A");
  const end = lines.findIndex((line, index) => index > start && line.includes("主要国家名称及相关信息"));
  if (start < 0 || end < 0) {
    throw new Error("Could not locate Appendix 2 vocabulary table in curriculum PDF text");
  }

  const entries = [];
  for (let index = start; index < end; index += 1) {
    let line = lines[index];
    if (shouldSkipCurriculumLine(line)) continue;
    if (line === "I" && entries.some((entry) => entry.sourceText === "I")) continue;
    if (line.endsWith(",") && index + 1 < end && /^[A-Za-z]+?\)$/.test(lines[index + 1])) {
      line = `${line} ${lines[index + 1]}`;
      index += 1;
    }
    if (!/^[A-Za-zÉé][A-Za-zÉé .()'’\-/,\u00A0]*(\*{1,2})?$/.test(line)) {
      throw new Error(`Unexpected curriculum word line: ${line}`);
    }
    const starMatch = line.match(/\*+$/);
    const starLevel = starMatch ? starMatch[0].length : 0;
    const sourceText = line.replace(/\*+$/, "").trim();
    entries.push({
      sourceText,
      starLevel,
      curriculumStage: getCurriculumStage(starLevel),
      sourceIndex: entries.length + 1
    });
  }

  if (entries.length !== 3000) {
    throw new Error(`Expected 3000 curriculum entries, got ${entries.length}`);
  }
  return entries;
}

function shouldSkipCurriculumLine(line) {
  return (
    /^[A-HJ-Z]$/.test(line) ||
    /^(\d+)$/.test(line) ||
    line.startsWith("│") ||
    line.includes("普通高中英语课程标准") ||
    line.includes("附录") ||
    line.includes("续表")
  );
}

function getCurriculumStage(starLevel) {
  if (starLevel === 1) return "高中必修词";
  if (starLevel === 2) return "选择性必修词";
  return "义务教育基础词";
}

function parseEcdict(csvText) {
  const rows = parseCsvRows(csvText);
  const headers = rows.next().value;
  const wordIndex = headers.indexOf("word");
  const phoneticIndex = headers.indexOf("phonetic");
  const translationIndex = headers.indexOf("translation");
  const posIndex = headers.indexOf("pos");
  const map = new Map();

  for (const fields of rows) {
    const word = normaliseLookup(fields[wordIndex]);
    if (!word || map.has(word)) continue;
    map.set(word, {
      word: fields[wordIndex],
      phonetic: fields[phoneticIndex] || "",
      translation: fields[translationIndex] || "",
      pos: fields[posIndex] || ""
    });
  }
  return map;
}

function* parseCsvRows(text) {
  const fields = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\"") {
      if (quoted && text[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      fields.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      fields.push(current);
      if (fields.some((field) => field.length)) yield fields.splice(0, fields.length);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  if (fields.some((field) => field.length)) yield fields;
}

function buildWordItem(entry, index, dictionary) {
  const lookupCandidates = buildLookupCandidates(entry.sourceText);
  const dictionaryEntry = lookupCandidates
    .map((candidate) => dictionary.get(normaliseLookup(candidate)))
    .find(Boolean);
  const meanings = dictionaryEntry ? extractMeanings(dictionaryEntry.translation) : [];
  const primaryMeaning = meanings[0] || "释义待自建";
  const canonicalWord = lookupCandidates[0] || entry.sourceText;
  const displayWord = entry.sourceText.includes("/") ? entry.sourceText : canonicalWord;
  const pos = dictionaryEntry ? extractPos(dictionaryEntry.translation, dictionaryEntry.pos) : "词条";
  const sourceTag = entry.starLevel === 1 ? "高中必修" : entry.starLevel === 2 ? "选择性必修" : "义务教育基础";
  const memoryImage = buildMemoryImage({
    word: displayWord,
    meaning: primaryMeaning,
    pos,
    curriculumStage: entry.curriculumStage
  });

  return {
    id: `moe_${String(index + 1).padStart(4, "0")}_${slugify(canonicalWord)}`,
    word: displayWord,
    headword: canonicalWord,
    sourceText: entry.sourceText,
    syllables: displayWord,
    ipa: dictionaryEntry?.phonetic ? `/${dictionaryEntry.phonetic}/` : "",
    pos,
    cn: [primaryMeaning],
    memoryImage,
    example_en: "",
    example_cn: "",
    collocations: [],
    level: entry.starLevel === 0 ? "foundation" : "high_school",
    curriculumStage: entry.curriculumStage,
    starLevel: entry.starLevel,
    sourceIndex: entry.sourceIndex,
    source: {
      word_list: "普通高中英语课程标准（2017年版2020年修订）附录2词汇表",
      word_list_url: curriculumSourceUrl,
      definition: dictionaryEntry ? "ECDICT 英汉词典开源数据" : "待自建",
      definition_url: dictionaryEntry ? dictionarySourceUrl : "",
      license_status: dictionaryEntry ? "ECDICT MIT License；上线前保留署名与许可文件" : "待补充自建释义",
      verified_at: "2026-05-14"
    },
    tags: ["高考课标词", sourceTag]
  };
}

function buildMemoryImage({ word, meaning, pos, curriculumStage }) {
  const scene = `一个学生在真实生活场景里遇到“${meaning}”，画面中心突出 ${word} 的含义`;
  return {
    meaning,
    pos,
    scene,
    prompt: `生成一张用于高中生背单词的纯画面插图，不要边框、不要按钮、不要 UI 卡片。画面中自然融入英文单词 ${word}、中文释义「${meaning}」、词性 ${pos}。场景：${scene}。风格干净、明亮、夸张但不幼稚，适合微信小程序学习素材。`,
    status: "prompt_ready",
    image_url: ""
  };
}

function buildLookupCandidates(sourceText) {
  const normalised = sourceText.replace("’", "'");
  if (normalised.includes("/")) {
    return normalised.split("/").map((part) => stripVariant(part)).filter(Boolean);
  }
  const first = stripVariant(normalised);
  const variants = [...normalised.matchAll(/\(([^)]+)\)/g)]
    .flatMap((match) => match[1].split(/,\s*/))
    .map((variant) => variant.replace(/^pl\.\s*/i, "").trim())
    .filter(Boolean);
  return [...new Set([first, ...variants])];
}

function stripVariant(text) {
  return text.replace(/\([^)]*\)/g, "").trim();
}

function extractMeanings(translation) {
  const cleaned = translation
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\r/g, "")
    .split(/\n/)
    .filter((line) => line.trim() && !line.includes("[网络]"))
    .map((line) => line.replace(/^[a-z.]+\s*/i, "").trim())
    .join("；")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/\s+/g, " ");
  if (cleaned.includes("无线局域网")) return ["无线局域网"];
  if (cleaned.includes("无线网络")) return ["无线网络"];
  const parts = cleaned
    .split(/[;；，,]/)
    .map((part) => part.trim())
    .filter((part) => /[\u4e00-\u9fa5]/.test(part))
    .filter((part) => part.length <= 18);
  return [...new Set(parts)].slice(0, 3);
}

function extractPos(translation, posValue) {
  const match = translation.match(/(?:^|\\n|\n)([a-z.]+)\s/i);
  if (match) return normalisePos(match[1]);
  if (posValue) return posValue.split(/[/:]/)[0] || "词条";
  return "词条";
}

function normalisePos(pos) {
  const lower = pos.toLowerCase();
  const map = {
    a: "adj.",
    ad: "adv.",
    adj: "adj.",
    adv: "adv.",
    art: "art.",
    conj: "conj.",
    int: "int.",
    n: "n.",
    num: "num.",
    prep: "prep.",
    pron: "pron.",
    v: "v.",
    vi: "vi.",
    vt: "vt."
  };
  return map[lower.replace(/\.$/, "")] || `${lower.replace(/\.$/, "")}.`;
}

function buildTestQuestions(words) {
  const pool = prioritiseLearningPool(words).filter((word) => word.cn[0] !== "释义待自建");
  const selected = pickSpread(pool, 50);
  return selected.map((word, index) => {
    const answer = word.cn.join("，");
    const distractors = pool
      .filter((item) => item.id !== word.id)
      .map((item) => item.cn.join("，"))
      .filter((meaning) => meaning !== answer);
    return {
      id: `gaokao_test_${String(index + 1).padStart(2, "0")}`,
      word: word.word,
      sourceWordId: word.id,
      options: shuffleItems([answer, ...unique(distractors).slice(index % 11, index % 11 + 3), "不认识"]).slice(0, 5),
      answer
    };
  });
}

function prioritiseLearningPool(words) {
  return [
    ...words.filter((word) => word.starLevel === 1),
    ...words.filter((word) => word.starLevel === 2),
    ...words.filter((word) => word.starLevel === 0)
  ];
}

function pickSpread(items, count) {
  const result = [];
  const step = items.length / count;
  for (let index = 0; index < count; index += 1) {
    result.push(items[Math.floor(index * step)]);
  }
  return result;
}

function buildReport(words, testQuestions) {
  const counts = words.reduce((acc, word) => {
    acc.by_star[word.starLevel] = (acc.by_star[word.starLevel] || 0) + 1;
    acc.by_stage[word.curriculumStage] = (acc.by_stage[word.curriculumStage] || 0) + 1;
    if (word.cn[0] !== "释义待自建") acc.dictionary.matched += 1;
    return acc;
  }, {
    generated_at: new Date().toISOString(),
    curriculum: {
      source: "普通高中英语课程标准（2017年版2020年修订）附录2词汇表",
      source_url: curriculumSourceUrl,
      total: words.length
    },
    dictionary: {
      source: "ECDICT",
      source_url: dictionarySourceUrl,
      license: "MIT",
      matched: 0,
      missing: 0
    },
    assessment: {
      questions: testQuestions.length
    },
    by_star: {},
    by_stage: {}
  });
  counts.dictionary.missing = words.length - counts.dictionary.matched;
  return counts;
}

function renderWordsModule(words, report) {
  return `export const wordDatasetMeta = ${JSON.stringify({
    groupId: "gaokao_curriculum",
    groupName: "高考课标词",
    description: "教育部普通高中英语课程标准附录2词汇表，词义来自 ECDICT 开源英汉词典，例句和搭配待自建。",
    total: report.curriculum.total,
    sourceUrl: curriculumSourceUrl,
    dictionaryUrl: dictionarySourceUrl,
    generatedAt: report.generated_at,
    byStage: report.by_stage,
    dictionary: report.dictionary
  }, null, 2)};

export const words = ${JSON.stringify(words, null, 2)};

export function getWordById(id) {
  return words.find((word) => word.id === id);
}
`;
}

function renderQuestionsModule(testQuestions) {
  return `export const testQuestions = ${JSON.stringify(testQuestions, null, 2)};
`;
}

function normaliseLookup(word) {
  return String(word || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/’/g, "'")
    .replace(/[.]/g, "")
    .trim();
}

function slugify(word) {
  return normaliseLookup(word)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32) || "word";
}

function unique(items) {
  return [...new Set(items)];
}

function shuffleItems(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
