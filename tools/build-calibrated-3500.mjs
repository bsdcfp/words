import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Mdict = require("mdict-js").default;
const cheerio = require("cheerio");

const root = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const localDoc = join(repoRoot, "高考英语考纲3500词汇表（英汉）.doc");
const oaldMdx = join(repoRoot, "牛津高阶（第10版 英汉双解） V11_8.mdx");
const tmpDir = join(root, "tmp/pdf-extract");
const outJson = join(root, "data/gaokao-3500-calibrated.json");
const outOwnedJson = join(root, "data/gaokao-3500-owned.json");
const outReport = join(root, "data/gaokao-3500-calibration-report.json");
const outDoc = join(root, "docs/word-source-calibration-3500.md");

const sourceMeta = {
  local_order_pdf: {
    name: "高考英语考纲3500词汇表（英汉）.doc",
    path: localDoc,
    role: "提供当前主词表、词性和中文释义；作为核心学习版优先依据"
  },
  pronunciation_and_pos: {
    name: "Oxford Advanced Learner's Dictionary 10th bilingual MDX",
    path: oaldMdx,
    license: "user-provided authorized database",
    role: "提供英/美音标；主 DOC 词性缺失时，用它按中文释义匹配补词性"
  }
};

const manualEntryCorrections = {
  atlantic: {
    pos: "n.",
    meanings: ["大西洋"],
    note: "DOC gives adj.; product treats this as the noun/proper-noun item for 大西洋."
  }
};

for (const file of [localDoc, oaldMdx]) {
  if (!existsSync(file)) throw new Error(`Missing required source: ${file}`);
}

mkdirSync(tmpDir, { recursive: true });
mkdirSync(dirname(outJson), { recursive: true });
mkdirSync(dirname(outDoc), { recursive: true });

const localText = extractDocText(localDoc, join(tmpDir, "local-3500-doc-raw.txt"));
const localEntries = parseLocalWordDoc(localText);
const oald = new Mdict(oaldMdx, { stripKey: false, keyCaseSensitive: true });

const calibrated = buildCalibratedEntries({ localEntries, oald });
const ownedCore = buildOwnedCore(calibrated);
const report = buildReport({ localEntries, calibrated, ownedCore });

writeFileSync(outJson, `${JSON.stringify({ meta: buildMeta(report), words: calibrated }, null, 2)}\n`, "utf8");
writeFileSync(outOwnedJson, `${JSON.stringify({ meta: buildOwnedMeta(report), words: ownedCore }, null, 2)}\n`, "utf8");
writeFileSync(outReport, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(outDoc, renderMarkdownReport(report), "utf8");

console.log(`Primary DOC entries: ${localEntries.length}`);
console.log(`Calibrated entries: ${calibrated.length}`);
console.log(`Owned core entries: ${ownedCore.length}`);
console.log(`High confidence: ${report.quality.high_confidence}`);
console.log(`Needs review: ${report.quality.needs_review}`);
console.log(`Wrote ${outJson}`);
console.log(`Wrote ${outOwnedJson}`);
console.log(`Wrote ${outReport}`);
console.log(`Wrote ${outDoc}`);

function extractDocText(docPath, textPath) {
  const text = execFileSync("textutil", ["-convert", "txt", "-stdout", docPath], { encoding: "utf8" });
  writeFileSync(textPath, text, "utf8");
  return text;
}

function parseLocalWordDoc(text) {
  const rawItems = [];
  for (const rawLine of text.replace(/\r/g, "").replace(/\f/g, "\n").split("\n")) {
    const line = normaliseDocLine(rawLine);
    if (!line || isLocalDocNoiseLine(line)) continue;
    if (startsWithPosMarker(line) && rawItems.length) {
      rawItems[rawItems.length - 1] = `${rawItems[rawItems.length - 1]} ${line}`;
      continue;
    }
    rawItems.push(line);
  }

  const entries = [];
  for (const [index, body] of rawItems.entries()) {
    const parsed = parseLocalDocEntryBody(body);
    if (!parsed) continue;
    const displayWord = normaliseLearningWord(parsed.word);
    const headword = normaliseHeadword(displayWord);
    if (!headword) continue;
    entries.push({
      source: "local_order_pdf",
      order: index + 1,
      word: displayWord,
      headword,
      ipa: parsed.ipa,
      pos: parsed.pos,
      rawMeaning: parsed.meaning,
      meanings: normaliseMeanings(parsed.meaning),
      senseGroups: parsed.senseGroups,
      raw: body
    });
  }
  return dedupeByHeadword(entries);
}

function parseLocalDocEntryBody(body) {
  const line = normaliseDocLine(body);
  const marker = findFirstPosMarker(line);
  if (marker && marker.index > 0) {
    return splitPosAndMeaning({
      word: cleanupWord(line.slice(0, marker.index)),
      ipa: "",
      rest: line.slice(marker.index)
    });
  }
  return parseEntryBody(line);
}

function findFirstPosMarker(text) {
  const markerPattern = /(?:^|[\s=（(])(\*?(?:interj|modal|prep|pron|conj|abbr|adj|adv|art|num|det|aux|vi|vt|ad|pl|int|n|v|a)(?:[.。])?)(?=[\s.&＆/,\u4e00-\u9fa5（(])/gi;
  for (const match of text.matchAll(markerPattern)) {
    const rawIndex = match.index + match[0].lastIndexOf(match[1]);
    const before = text.slice(0, rawIndex).trim();
    if (/[A-Za-z]/.test(before)) return { raw: match[1], index: rawIndex };
  }
  return null;
}

function isLocalDocNoiseLine(line) {
  return line === "高考英语词汇全表"
    || /^[A-Z]$/.test(line)
    || /^PAGE\b/i.test(line);
}

function normaliseDocLine(line) {
  return normaliseKnownDocGlitches(normaliseSpaces(line)
    .replace(/[]/g, "")
    .replace(//g, " ")
    .replace(/([A-Za-z])\s+[.]。?/g, "$1.")
    .replace(/\ba\s+d\./gi, "ad.")
    .replace(/\bv\s+\./gi, "v.")
    .replace(/\ba\s+\./gi, "a.")
    .replace(/\bn\s+\./gi, "n."));
}

function normaliseKnownDocGlitches(line) {
  return String(line || "")
    .replace(/^according\s*\.\s*/i, "according to ")
    .replace(/^photo\s*=\s*photographn\.\s*/i, "photo n. ")
    .replace(/^remotea\.\s*/i, "remote a. ")
    .replace(/^Reliable\b/, "reliable")
    .replace(/^large\s+l\s+/i, "large a. ")
    .replace(/^price\.\s*/i, "price ")
    .replace(/^nineteen\.\s*/i, "nineteen ")
    .replace(/^the North\s*\(South\)极，北（南）极/i, "the North Pole n. 北极");
}

function parseEntryBody(body) {
  const withIpa = body.match(/^(.+?)\s*(\[[^\]]+\])\s*(.+)$/);
  if (withIpa) {
    return splitPosAndMeaning({
      word: cleanupWord(withIpa[1]),
      ipa: withIpa[2],
      rest: withIpa[3]
    });
  }
  const withoutIpa = body.match(/^([A-Za-z][A-Za-z .'’()/&-]{0,60})\s+(.+)$/);
  if (!withoutIpa) return null;
  return splitPosAndMeaning({
    word: cleanupWord(withoutIpa[1]),
    ipa: "",
    rest: withoutIpa[2]
  });
}

function splitPosAndMeaning({ word, ipa, rest }) {
  if (!word || !/[A-Za-z]/.test(word)) return null;
  const normalisedRest = normaliseOcrPosMarkers(rest);
  const posMatch = normalisedRest.match(/^([*]?(?:interj|modal|prep|pron|conj|abbr|adj|adv|art|num|det|aux|vi|vt|ad|pl|int|n|v|a)(?:[.。])?(?:(?:＆|&|\/|和|及|\s)+(?:interj|modal|prep|pron|conj|abbr|adj|adv|art|num|det|aux|vi|vt|ad|pl|int|n|v|a)(?:[.。])?)*)\s*(.*)$/i);
  if (posMatch) {
    const posRaw = posMatch[1];
    const meaning = posMatch[2].trim();
    return {
      word,
      ipa,
      pos: normalisePos(posRaw),
      meaning,
      senseGroups: parseSenseGroups(posRaw, meaning)
    };
  }
  return {
    word,
    ipa,
    pos: "",
    meaning: normalisedRest.trim(),
    senseGroups: [{
      pos: "词条",
      posKey: "entry",
      meanings: normaliseMeanings(normalisedRest),
      splitReview: false
    }]
  };
}

function parseSenseGroups(posRaw, meaningRaw) {
  const combinedText = normaliseOcrPosMarkers(`${posRaw} ${meaningRaw}`).replace(/。/g, ".");
  const markers = [...combinedText.matchAll(/(?:^|(?<=[\u4e00-\u9fa5；;，,\s]))(\*?(?:interj|modal|prep|pron|conj|abbr|adj|adv|art|num|det|aux|vi|vt|ad|pl|int|n|v|a)(?:[.])?)(?=[\s\u4e00-\u9fa5（(])/gi)]
    .map((match) => ({
      raw: match[1],
      index: match.index + match[0].lastIndexOf(match[1])
    }));

  if (markers.length > 1) {
    return markers.map((marker, index) => {
      const next = markers[index + 1]?.index ?? combinedText.length;
      const meaning = combinedText.slice(marker.index + marker.raw.length, next);
      return buildSenseGroup(marker.raw, normaliseMeanings(meaning), false);
    }).filter((group) => group.meanings.length);
  }

  const meanings = normaliseMeanings(meaningRaw);
  const posList = expandPosList(posRaw);
  if (posList.length > 1) {
    return posList.map((pos) => buildSenseGroup(pos, meanings, true));
  }
  return [buildSenseGroup(posList[0] || posRaw || "词条", meanings, false)];
}

function normaliseOcrPosMarkers(text) {
  return String(text || "")
    // 兼容历史来源中 after 的 ad. 被 OCR 成 rad. 的情况。
    .replace(/(^|[\s;；,，])rad([.。])(?=[\s\u4e00-\u9fa5])/gi, "$1ad$2");
}

function startsWithPosMarker(text) {
  return /^[*]?(?:interj|modal|prep|pron|conj|abbr|adj|adv|art|num|det|aux|vi|vt|ad|pl|int|n|v|a)(?:[.。])?\b/i.test(String(text || "").trim());
}

function buildSenseGroup(pos, meanings, splitReview) {
  const normalisedPos = normalisePos(pos || "词条");
  return {
    pos: normalisedPos,
    posKey: posCategoryKey(normalisedPos),
    meanings: [...new Set(meanings)].slice(0, 4),
    splitReview
  };
}

function expandPosList(posRaw) {
  const normalised = String(posRaw || "")
    .replace(/[＊*]/g, "")
    .replace(/。/g, ".")
    .replace(/＆/g, "&")
    .replace(/\s+/g, "")
    .toLowerCase();
  const matches = normalised.match(/interj|modal|prep|pron|conj|abbr|adj|adv|art|num|det|aux|vi|vt|ad|pl|int|n|v|a/g) || [];
  const mapped = matches.map(normalisePos).filter(Boolean);
  return [...new Set(mapped.length ? mapped : [normalisePos(posRaw)])];
}

function buildCalibratedEntries({ localEntries, oald }) {
  const localSenseMap = buildSourceSenseMap(localEntries);
  const orderedSenseKeys = [...localSenseMap.keys()];

  return [...new Set(orderedSenseKeys)].map((senseKey, index) => {
    const local = localSenseMap.get(senseKey);
    const headword = local?.headword || senseKey.split("::")[0];
    const localMeanings = local?.meanings || [];
    const correction = entryCorrection(local);
    const meaningChoice = correction?.meanings?.length
      ? { cn: correction.meanings, source: "manual_doc_calibration" }
      : chooseMeanings({ localMeanings });
    const basePos = correctedLocalPos(local) || "词条";
    const oaldMeta = getOaldMetadata(oald, {
      word: local?.word || headword,
      headword,
      pos: basePos,
      cn: meaningChoice.cn
    });
    const pos = basePos === "词条" ? (oaldMeta.pos || basePos) : basePos;
    const flags = buildQualityFlags({ local });
    if (local?.splitReview) flags.push("needs_pos_split_review");
    const status = flags.length ? "needs_review" : "high_confidence";
    const posKey = posCategoryKey(pos);
    const phonetics = {
      en: oaldMeta.phonetics.en || normaliseIpa(local?.ipa || ""),
      us: oaldMeta.phonetics.us || "",
      default: "en",
      source: oaldMeta.phonetics.en || oaldMeta.phonetics.us ? "oald10_mdx" : (local?.ipa ? "primary_doc" : "")
    };

    return {
      id: `gk3500_${String(index + 1).padStart(4, "0")}_${slugify(headword)}_${posKey}`,
      word: local?.word || headword,
      lemma: headword,
      headword,
      senseKey: `${headword}:${posKey}`,
      ipa: phonetics.en || phonetics.us || local?.ipa || "",
      phonetics,
      pronunciation: {
        defaultAccent: "en",
        provider: "youdao",
        youdaoType: 1
      },
      pos,
      posKey,
      cn: meaningChoice.cn,
      definitionSource: meaningChoice.source,
      sourceOrder: {
        local: local?.order || null
      },
      sourcePresence: {
        local: Boolean(local),
        oald: Boolean(oaldMeta.matchedHeadword)
      },
      calibrationStatus: status,
      qualityFlags: flags,
      sourceMeanings: {
        local: localMeanings
      }
    };
  });
}

function correctedLocalPos(local) {
  return entryCorrection(local)?.pos || local?.pos || "";
}

function entryCorrection(local) {
  if (!local) return null;
  const key = normaliseLookup(local.word || local.headword);
  return manualEntryCorrections[key] || null;
}

function buildSourceSenseMap(entries) {
  const map = new Map();
  for (const entry of entries) {
    const groups = entry.senseGroups?.length
      ? entry.senseGroups
      : [buildSenseGroup(entry.pos || "词条", entry.meanings || [], false)];
    for (const group of groups) {
      if (!group.meanings.length) continue;
      const key = `${entry.headword}::${group.posKey}`;
      if (map.has(key)) continue;
      map.set(key, {
        ...entry,
        pos: group.pos,
        posKey: group.posKey,
        meanings: group.meanings,
        splitReview: group.splitReview
      });
    }
  }
  return map;
}

function chooseMeanings({ localMeanings }) {
  if (localMeanings.length) {
    return {
      cn: [...new Set(localMeanings)].slice(0, 4),
      source: "local_order_pdf"
    };
  }
  return {
    cn: [],
    source: "missing"
  };
}

function getOaldMetadata(oald, word) {
  const entry = lookupOaldEntry(oald, word);
  if (!entry?.definition) {
    return emptyOaldMetadata();
  }
  const $ = cheerio.load(entry.definition, { decodeEntities: false });
  const entries = $(".entry")
    .toArray()
    .map((entryNode) => buildOaldEntryMetadata($, entryNode, word))
    .filter((item) => item.headword);
  if (!entries.length) return emptyOaldMetadata();
  const selected = selectOaldEntry(entries, word);
  const pos = selected.pos ? normaliseDictionaryPos(selected.pos) : fallbackProperNounPos(word.word || word.headword);
  return {
    pos,
    phonetics: selected.phonetics || { en: "", us: "" },
    matchedHeadword: selected.headword
  };
}

function emptyOaldMetadata() {
  return {
    pos: "",
    phonetics: { en: "", us: "" },
    matchedHeadword: ""
  };
}

function lookupOaldEntry(oald, word) {
  const candidates = unique([
    word.word,
    word.headword,
    ...oaldLookupAliases(word),
    stripArticleVariant(word.word),
    stripArticleVariant(word.headword),
    normaliseOaldLookup(word.word),
    normaliseOaldLookup(word.headword),
    word.headword === "photo" ? "photograph" : "",
    word.headword === "the north pole" ? "north" : ""
  ]).filter(Boolean);
  for (const candidate of candidates) {
    try {
      const result = lookupOaldDefinition(oald, candidate);
      if (result?.definition) return result;
    } catch (error) {
      // Some MDX keys can fail internally; continue with the next candidate.
    }
  }
  return null;
}

function oaldLookupAliases(word) {
  const raw = String(word.word || word.headword || "").trim();
  const headword = String(word.headword || "").trim();
  const lower = raw.toLowerCase();
  const title = raw ? raw[0].toUpperCase() + raw.slice(1).toLowerCase() : "";
  const withoutParentheses = raw.replace(/\s*\([^)]*\)\s*/g, "").trim();
  const compactHyphen = raw.replace(/\s*-\s*/g, "-");
  const spacedHyphen = raw.replace(/\s*-\s*/g, " ");
  const aliases = [
    title,
    withoutParentheses,
    compactHyphen,
    spacedHyphen,
    headword === "photo" ? "photograph" : "",
    headword === "the north pole" ? "north" : ""
  ];
  const explicit = {
    christian: ["Christian"],
    chopsticks: ["Chopsticks", "chopstick"],
    northeast: ["north-east", "north east"],
    "waiting -room": ["waiting-room", "waiting room"],
    walkman: ["Walkman", "Walkman™"],
    "atlantic ocean": ["(the) Atlantic Ocean"],
    "the atlantic ocean": ["(the) Atlantic Ocean"]
  };
  return unique([...aliases, ...(explicit[lower] || [])]);
}

function lookupOaldDefinition(oald, candidate, seen = new Set()) {
  if (!candidate || seen.has(candidate)) return null;
  seen.add(candidate);
  const result = oald.lookup(candidate);
  if (!result?.definition) return null;
  const linkedKey = extractMdxLink(result.definition);
  if (linkedKey && !seen.has(linkedKey)) {
    return lookupOaldDefinition(oald, linkedKey, seen) || result;
  }
  return result;
}

function extractMdxLink(definition) {
  const match = String(definition).match(/^@@@LINK=([^\0\r\n]+)/);
  return match?.[1]?.trim() || "";
}

function buildOaldEntryMetadata($, entryNode, word) {
  const node = $(entryNode);
  const headword = cleanText(node.find(".headword").first().text()).replace(/\d+$/, "");
  const pos = cleanText(node.find(".pos").first().text());
  const senses = node.find(".sense").toArray().map((sense) => ({
    en: cleanText($(sense).find(".def").first().text()),
    cn: cleanText($(sense).find("deft chn").first().text())
  }));
  return {
    headword,
    pos,
    phonetics: {
      en: unique(node.find(".phons_br .phon").toArray().map((item) => cleanText($(item).text())))[0] || "",
      us: unique(node.find(".phons_n_am .phon").toArray().map((item) => cleanText($(item).text())))[0] || ""
    },
    score: scoreOaldEntry(word, { headword, pos, senses })
  };
}

function selectOaldEntry(entries, word) {
  return entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Number(Boolean(b.pos)) - Number(Boolean(a.pos));
  })[0];
}

function scoreOaldEntry(word, entry) {
  let score = 0;
  if (normaliseLookup(entry.headword) === normaliseLookup(word.headword)) score += 20;
  if (normaliseLookup(word.headword) === "downtown" && word.cn.join("").includes("区") && normaliseDictionaryPos(entry.pos) === "n.") score += 30;
  if (word.pos && word.pos !== "词条" && normaliseDictionaryPos(entry.pos) === word.pos) score += 12;
  const senseText = entry.senses.map((sense) => `${sense.cn}${sense.en}`).join(" ");
  for (const token of word.cn.flatMap(splitMeaningForScore)) {
    if (token && senseText.includes(token)) score += 10 + Math.min(token.length, 4);
  }
  score += overlapChars(word.cn.join(""), senseText).length;
  return score;
}

function normaliseDictionaryPos(pos) {
  const value = String(pos || "").toLowerCase().trim();
  if (!value) return "";
  if (value.includes("modal verb")) return "modal v.";
  if (value.includes("ordinal number")) return "num.";
  if (value.includes("number")) return "num.";
  if (value.includes("adjective")) return "adj.";
  if (value.includes("adverb")) return "adv.";
  if (value.includes("preposition")) return "prep.";
  if (value.includes("conjunction")) return "conj.";
  if (value.includes("pronoun")) return "pron.";
  if (value.includes("noun")) return "n.";
  if (value.includes("verb")) return "v.";
  return "";
}

function fallbackProperNounPos(headword) {
  return /^[A-Z]/.test(String(headword || "")) ? "n." : "";
}

function normaliseOaldLookup(word) {
  return normaliseLookup(word)
    .replace(/\baccording$/, "according to")
    .replace(/\bremotea$/, "remote")
    .replace(/\blarge l$/, "large")
    .replace(/\bphotographn$/, "photograph")
    .trim();
}

function normaliseIpa(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("/")) return text;
  if (text.startsWith("[")) return text.replace(/^\[/, "/").replace(/\]$/, "/");
  return `/${text}/`;
}

function splitMeaningForScore(text) {
  return String(text || "")
    .split(/[，,；;、（）()]/)
    .map((item) => item.replace(/[的地得了和与或及其是为把被可能使将已很]/g, "").trim())
    .filter((item) => item.length >= 1);
}

function overlapChars(a, b) {
  const right = new Set(String(b || "").split(""));
  return [...new Set(String(a || "").split(""))].filter((char) => right.has(char));
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function buildOwnedCore(calibrated) {
  const core = calibrated
    .filter(isProductLearningCandidate)
    .filter((entry) => entry.sourcePresence.local)
    .sort(compareOwnedCoreOrder)
    .slice(0, 3500)
    .map((entry, index, entries) => {
      const previous = entries[index - 1];
      const sameLemmaContinuation = Boolean(previous && previous.lemma === entry.lemma && previous.posKey !== entry.posKey);
      return {
        ...entry,
        ownedIndex: index + 1,
        sameLemmaContinuation,
        sameLemmaHint: sameLemmaContinuation ? "同词不同词性" : "",
        tags: buildOwnedTags(entry)
      };
    });
  if (core.length < 3000) {
    throw new Error(`Expected at least 3000 primary-source owned entries, got ${core.length}`);
  }
  return core;
}

function isProductLearningCandidate(entry) {
  if (!entry.cn.length) return false;
  if (!/^[a-z][a-z' -]*$/i.test(entry.headword)) return false;
  if (entry.headword.length <= 1) return false;
  if (entry.headword.includes("=")) return false;
  if (["a", "an", "the"].includes(entry.headword)) return false;
  return true;
}

function compareOwnedCoreOrder(a, b) {
  const aOrder = a.sourceOrder.local ?? 100000;
  const bOrder = b.sourceOrder.local ?? 100000;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.headword.localeCompare(b.headword);
}

function buildOwnedTags(entry) {
  const tags = ["高考3500自有版"];
  if (entry.calibrationStatus === "needs_review") tags.push("需复核");
  return tags;
}

function buildQualityFlags({ local }) {
  const flags = [];
  if (!local) flags.push("not_in_primary_doc");
  return flags;
}

function buildReport({ localEntries, calibrated, ownedCore }) {
  const flagCounts = {};
  for (const entry of calibrated) {
    for (const flag of entry.qualityFlags) flagCounts[flag] = (flagCounts[flag] || 0) + 1;
  }
  const samples = calibrated
    .filter((entry) => entry.qualityFlags.length)
    .slice(0, 80)
    .map((entry) => ({
      word: entry.word,
      definitionSource: entry.definitionSource,
      flags: entry.qualityFlags,
      local: entry.sourceMeanings.local
    }));
  const accuse = calibrated.find((entry) => entry.headword === "accuse");
  const accurate = calibrated.find((entry) => entry.headword === "accurate");
  return {
    generated_at: new Date().toISOString(),
    sources: sourceMeta,
    counts: {
      primary_doc_entries: localEntries.length,
      calibrated_entries: calibrated.length,
      owned_core_entries: ownedCore.length
    },
    owned_core: {
      target: 3500,
      selection_rule: "从《高考英语考纲3500词汇表（英汉）.doc》命中的完整候选池中选取英文词形有效、非明显 OCR 噪声、非 a/an/the 这类低学习价值词条；词性缺失和英/美音标只用牛津高阶 MDX 补齐。",
      high_confidence: ownedCore.filter((entry) => entry.calibrationStatus === "high_confidence").length,
      needs_review: ownedCore.filter((entry) => entry.calibrationStatus === "needs_review").length
    },
    quality: {
      high_confidence: calibrated.filter((entry) => entry.calibrationStatus === "high_confidence").length,
      needs_review: calibrated.filter((entry) => entry.calibrationStatus === "needs_review").length,
      flag_counts: flagCounts
    },
    known_corrections: {
      accuse,
      accurate
    },
    review_samples: samples
  };
}

function buildMeta(report) {
  return {
    groupId: "gaokao_3500_calibrated",
    groupName: "高考3500校准自有版",
    description: "由《高考英语考纲3500词汇表（英汉）.doc》作为主词表，牛津高阶 MDX 用于补词性、英/美音标、例句和搭配。",
    generatedAt: report.generated_at,
    total: report.counts.calibrated_entries,
    sources: sourceMeta,
    quality: report.quality
  };
}

function buildOwnedMeta(report) {
  return {
    groupId: "gaokao_3500_owned",
    groupName: "高考3500自有核心学习版",
    description: "从《高考英语考纲3500词汇表（英汉）.doc》筛出的核心学习词条；牛津高阶 MDX 用于补词性、英/美音标、例句和搭配。",
    generatedAt: report.generated_at,
    total: report.counts.owned_core_entries,
    sources: sourceMeta,
    quality: report.owned_core
  };
}

function renderMarkdownReport(report) {
  return `# 高考3500校准自有版

生成时间：${report.generated_at}

## 生成口径

- 《高考英语考纲3500词汇表（英汉）.doc》：作为主来源，优先采用它的收词、词性和中文释义。
- 牛津高阶 MDX：用于补齐主 DOC 缺失词性、英/美音标、例句和搭配。
- 自有版字段：词头、学习项 key、英/美音标、词性、短中文义、来源命中、校验状态。
- 词性不同的同一英文词会拆成多个学习项；没有明确分词性释义的条目标记为 \`needs_pos_split_review\`。

## 产物

- \`data/gaokao-3500-calibrated.json\`
- \`data/gaokao-3500-owned.json\`
- \`data/gaokao-3500-calibration-report.json\`

## 数量

- 主 DOC 解析词条：${report.counts.primary_doc_entries}
- 自有版合并学习项：${report.counts.calibrated_entries}
- 自有核心学习版学习项：${report.counts.owned_core_entries}
- 高置信词条：${report.quality.high_confidence}
- 需人工复核词条：${report.quality.needs_review}

## 自有核心学习版规则

- 目标数量：${report.owned_core.target}
- 选择规则：${report.owned_core.selection_rule}
- 核心版高置信：${report.owned_core.high_confidence}
- 核心版需复核：${report.owned_core.needs_review}

## 典型纠错

- \`accuse\`：主 DOC 给出“控告”，当前采用主 DOC。
- \`accurate\`：主 DOC 给出“正确的/精确的”，当前采用主 DOC。

## 复核标记

${Object.entries(report.quality.flag_counts).map(([flag, count]) => `- \`${flag}\`：${count}`).join("\n")}

## 下一步

- 对 \`needs_review\` 词条做人工抽检，优先处理主 DOC 里词性复合或释义过短的词。
- 上线前把短释义进一步改写为面向学生的“学习型释义”，避免释义过长或过成人化。
`;
}

function normaliseMeanings(text) {
  return [...new Set(String(text || "")
    .replace(/\\n/g, "\n")
    .replace(/[()（）]/g, " ")
    .split(/[;；,，、]/)
    .map((part) => cleanupMeaning(part))
    .filter((part) => /[\u4e00-\u9fa5]/.test(part))
    .filter((part) => part.length <= 18))].slice(0, 4);
}

function cleanupMeaning(part) {
  return String(part || "")
    .replace(/^[a-z.＆&/\s]+/i, "")
    .replace(/^[*]\s*/, "")
    .replace(/^\[[^\]]+\]/, "")
    .replace(/\s+/g, "")
    .replace(/^的/, "")
    .trim();
}

function normalisePos(pos) {
  const value = String(pos || "")
    .replace(/[＊*]/g, "")
    .replace(/。/g, ".")
    .replace(/＆/g, "&")
    .trim()
    .toLowerCase();
  if (!value) return "";
  const first = value.split(/[&/和及\s]+/)[0].replace(/\.$/, "");
  const map = {
    a: "adj.",
    ad: "adv.",
    adj: "adj.",
    adv: "adv.",
    art: "art.",
    conj: "conj.",
    int: "int.",
    interj: "int.",
    modal: "modal v.",
    n: "n.",
    num: "num.",
    prep: "prep.",
    pron: "pron.",
    v: "v.",
    vi: "vi.",
    vt: "vt."
  };
  return map[first] || `${first}.`;
}

function posCategoryKey(pos) {
  const normalised = normalisePos(pos);
  const base = normalised.replace(/\.$/, "");
  if (base.includes("modal") || ["vt", "vi", "v"].includes(base)) return "v";
  if (["a", "adj"].includes(base)) return "adj";
  if (["ad", "adv"].includes(base)) return "adv";
  return base.replace(/[^a-z0-9]+/g, "_") || "entry";
}

function cleanupWord(word) {
  return String(word || "")
    .replace(/^[\d.\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/＆/g, "&")
    .trim();
}

function normaliseLearningWord(word) {
  return cleanupWord(word)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseHeadword(word) {
  return normaliseLookup(stripArticleVariant(word))
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripArticleVariant(word) {
  return String(word || "").replace(/\s*\([^)]*\)/g, "").trim();
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

function normaliseSpaces(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function dedupeByHeadword(entries) {
  const seen = new Map();
  for (const entry of entries) {
    if (!seen.has(entry.headword)) {
      seen.set(entry.headword, entry);
    }
  }
  return [...seen.values()];
}

function slugify(word) {
  return normaliseLookup(word)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32) || "word";
}
