import assert from "node:assert/strict";
import { words } from "../data/words.js";
import { buildAssessmentResult } from "../src/report.js";
import { defaultState } from "../src/storage.js";
import {
  completeMixedReview,
  confirmPrecheck,
  moveToNextAudioQuestion,
  moveToNextMixedReviewQuestion,
  prepareAudioQuestions,
  startDailyLearning
} from "../src/study-flow.js";

const absolutely = words.find((word) => word.word === "absolutely");
assert.ok(absolutely, "fixture word should exist");

const optionOrders = new Set();
for (let index = 0; index < 24; index += 1) {
  const state = structuredClone(defaultState);
  state.daily.selectedWordIds = [absolutely.id];
  prepareAudioQuestions(state);
  optionOrders.add(state.daily.audioQuestions[0].options.join("|"));
}

assert.ok(optionOrders.size > 1, "audio options should be shuffled randomly across attempts");

const fullScore = buildAssessmentResult({
  answers: Array.from({ length: 50 }, (_, index) => ({
    questionId: `q_${index}`,
    selected: "正确",
    isCorrect: true
  }))
});
assert.ok(fullScore.vocabulary <= 3900, "50-question full score should not inflate above a high-school vocabulary range");

const mostlyUnknown = buildAssessmentResult({
  answers: Array.from({ length: 50 }, (_, index) => ({
    questionId: `q_${index}`,
    selected: index < 38 ? "不认识" : "错误",
    isCorrect: false
  }))
});
assert.ok(mostlyUnknown.vocabulary < 900, "many unknown answers should stay in a remedial range");

const state = structuredClone(defaultState);
startDailyLearning(state);
completeGroup(state, ["absolutely", "accident", "account"]);
assert.equal(state.daily.reviewPhase, "initial", "one group should continue to next selection without mixed review");

completeGroup(state, ["ache", "achievement", "acquire"]);
assert.equal(state.daily.reviewPhase, "mixed", "two completed groups should trigger mixed review");
assert.equal(state.daily.mixedReviewWordIds.length, 6, "two groups should mix six words");
finishMixedReview(state);
assert.equal(state.daily.reviewPhase, "initial", "six-word mixed review should return to selecting the third group");
assert.equal(state.daily.completedWordIds.length, 6, "six-word mixed review should keep the current round progress");

completeGroup(state, ["actually", "adapt", "addict"]);
assert.equal(state.daily.reviewPhase, "mixed", "three completed groups should trigger mixed review");
assert.equal(state.daily.mixedReviewWordIds.length, 9, "three groups should mix nine words");
finishMixedReview(state);
assert.equal(state.daily.reviewPhase, "initial", "nine-word mixed review should restart a new round");
assert.equal(state.daily.completedWordIds.length, 0, "new round should reset round progress");
assert.equal(state.daily.batchWordIds.length, 0, "new round should reset mixed review batch");
assert.equal(state.daily.candidateWordIds.length, 9, "new round should expose nine fresh candidates");
assert.ok(
  !state.daily.candidateWordIds.some((id) => selectedIds(["absolutely", "accident", "account", "ache", "achievement", "acquire", "actually", "adapt", "addict"]).includes(id)),
  "new round candidates should not repeat the just completed round"
);

function completeGroup(state, headwords) {
  state.daily.selectedWordIds = selectedIds(headwords);
  confirmPrecheck(state);
  prepareAudioQuestions(state);
  for (let index = 0; index < headwords.length; index += 1) {
    moveToNextAudioQuestion(state);
  }
}

function finishMixedReview(state) {
  state.daily.mixedIndex = state.daily.mixedQuestions.length - 1;
  assert.equal(moveToNextMixedReviewQuestion(state), "complete");
  return completeMixedReview(state);
}

function selectedIds(headwords) {
  return headwords.map((headword) => {
    const word = words.find((item) => item.word === headword);
    assert.ok(word, `fixture word should exist: ${headword}`);
    return word.id;
  });
}
