import { words, wordDatasetMeta } from "../data/words.js";
import { testQuestions } from "../data/test-questions.js";
import { writeFile } from "node:fs/promises";

const TEST_SOURCE_IDS = new Set(testQuestions.map((question) => question.sourceWordId));
const starterWords = words
  .filter((word) => word.starLevel === 1 || word.starLevel === 2)
  .slice(0, 160);
const selected = dedupeById([
  ...starterWords,
  ...words.filter((word) => TEST_SOURCE_IDS.has(word.id))
]).map(compactWord);

const compactMeta = {
  groupId: wordDatasetMeta.groupId,
  groupName: wordDatasetMeta.groupName,
  description: wordDatasetMeta.description,
  total: wordDatasetMeta.total,
  miniProgramTotal: selected.length,
  sourceUrl: wordDatasetMeta.sourceUrl,
  dictionary: wordDatasetMeta.dictionary
};

await writeFile(
  new URL("../miniprogram/data/words.js", import.meta.url),
  `const wordDatasetMeta = ${JSON.stringify(compactMeta, null, 2)};\n\nconst words = ${JSON.stringify(selected, null, 2)};\n\nmodule.exports = { wordDatasetMeta, words };\n`
);

await writeFile(
  new URL("../miniprogram/data/test-questions.js", import.meta.url),
  `const testQuestions = ${JSON.stringify(testQuestions, null, 2)};\n\nmodule.exports = { testQuestions };\n`
);

function compactWord(word) {
  return {
    id: word.id,
    word: word.word,
    headword: word.headword,
    syllables: word.syllables,
    ipa: word.ipa,
    pos: word.pos,
    cn: word.cn,
    memoryImage: {
      meaning: word.memoryImage?.meaning || word.cn.join("，"),
      pos: word.memoryImage?.pos || word.pos,
      scene: word.memoryImage?.scene || ""
    },
    example_en: word.example_en || "",
    example_cn: word.example_cn || "",
    collocations: word.collocations || [],
    level: word.level,
    curriculumStage: word.curriculumStage,
    starLevel: word.starLevel,
    sourceIndex: word.sourceIndex,
    tags: word.tags || []
  };
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
