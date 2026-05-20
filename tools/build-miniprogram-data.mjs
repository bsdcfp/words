import { words, wordDatasetMeta } from "../data/words.js";
import { testQuestions } from "../data/test-questions.js";
import { writeFile } from "node:fs/promises";

const selected = words.map(compactWord);

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
      pos: word.memoryImage?.pos || word.pos
    },
    example_en: "",
    example_cn: "",
    collocations: [],
    level: word.level,
    curriculumStage: word.curriculumStage,
    starLevel: word.starLevel,
    sourceIndex: word.sourceIndex,
    tags: []
  };
}
