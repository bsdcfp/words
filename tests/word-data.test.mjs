import assert from "node:assert/strict";
import { testQuestions } from "../data/test-questions.js";
import { wordDatasetMeta, words } from "../data/words.js";

assert.equal(wordDatasetMeta.groupName, "高考课标词");
assert.equal(wordDatasetMeta.total, 3000);
assert.equal(words.length, 3000);
assert.equal(testQuestions.length, 50);

const sourceTexts = new Set(words.map((word) => word.sourceText));
assert.equal(sourceTexts.size, 3000);

const byStage = words.reduce((acc, word) => {
  acc[word.curriculumStage] = (acc[word.curriculumStage] || 0) + 1;
  return acc;
}, {});

assert.equal(byStage["义务教育基础词"], 1500);
assert.equal(byStage["高中必修词"] + byStage["选择性必修词"], 1500);
assert.equal(words.filter((word) => word.cn.length > 0 && word.cn[0] !== "释义待自建").length, 3000);
assert.ok(words.every((word) => word.cn.length === 1));
assert.ok(words.every((word) => word.memoryImage?.meaning === word.cn[0]));
assert.ok(words.every((word) => word.memoryImage?.pos === word.pos));
assert.ok(words.every((word) => word.memoryImage?.scene));
assert.ok(words.every((word) => word.memoryImage?.prompt.includes(word.word)));
assert.ok(words.every((word) => word.source.word_list.includes("普通高中英语课程标准")));
assert.ok(testQuestions.every((question) => question.options.includes(question.answer)));
assert.ok(testQuestions.every((question) => question.options.includes("不认识")));
