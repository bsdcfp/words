import assert from "node:assert/strict";
import { words } from "../data/words.js";
import { buildAssessmentResult } from "../src/report.js";
import { defaultState } from "../src/storage.js";
import {
  answerAudioQuestion,
  answerGroupReviewQuestion,
  answerMixedReviewQuestion,
  completeMixedReview,
  confirmPrecheck,
  getCurrentAudioQuestion,
  getCurrentGroupReviewQuestion,
  getCurrentMixedReviewQuestion,
  moveToNextAudioQuestion,
  moveToNextGroupReviewQuestion,
  moveToNextMixedReviewQuestion,
  prepareAudioQuestions,
  prepareGroupReviewQuestions,
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

const reviewState = structuredClone(defaultState);
startDailyLearning(reviewState);
reviewState.daily.selectedWordIds = selectedIds(["absolutely", "accident", "account"]);
confirmPrecheck(reviewState);
prepareGroupReviewQuestions(reviewState);
assert.equal(reviewState.daily.groupQuestions.length, 3, "group review should start with three visual questions");
assert.equal(getCurrentGroupReviewQuestion(reviewState).mode, "visual", "group review should test visual word meaning first");
answerGroupReviewQuestion(reviewState, "错误释义");
assert.equal(reviewState.daily.groupQuestions.length, 4, "wrong visual answer should append one retry question");
assert.equal(reviewState.daily.groupQuestions.at(-1).wordId, absolutely.id, "retry question should use the missed word");
assert.equal(moveToNextGroupReviewQuestion(reviewState), "group-review", "wrong answer should keep the group review running");
answerGroupReviewQuestion(reviewState, meaningFor("accident"));
assert.equal(moveToNextGroupReviewQuestion(reviewState), "group-review");
answerGroupReviewQuestion(reviewState, meaningFor("account"));
assert.equal(moveToNextGroupReviewQuestion(reviewState), "group-review", "retry should still be pending");
answerGroupReviewQuestion(reviewState, meaningFor("absolutely"));
assert.equal(moveToNextGroupReviewQuestion(reviewState), "audio-meaning", "group review should finish only after the retry is cleared");

const mixedModeState = structuredClone(defaultState);
startDailyLearning(mixedModeState);
completeGroup(mixedModeState, ["absolutely", "accident", "account"]);
completeGroup(mixedModeState, ["ache", "achievement", "acquire"]);
assert.equal(mixedModeState.daily.mixedQuestions.length, 12, "six-word mixed review should include visual and audio questions");
assert.equal(
  mixedModeState.daily.mixedQuestions.filter((question) => question.mode === "visual").length,
  6,
  "six-word mixed review should include six visual questions"
);
assert.equal(
  mixedModeState.daily.mixedQuestions.filter((question) => question.mode === "audio").length,
  6,
  "six-word mixed review should include six audio questions"
);

answerAllMixedQuestions(mixedModeState);
completeMixedReview(mixedModeState);
const masteredWordState = mixedModeState.userWordStates[absolutely.id];
assert.equal(masteredWordState.groupVisualPassed, true, "a mastered word should pass the group visual check");
assert.equal(masteredWordState.groupAudioPassed, true, "a mastered word should pass the group audio check");
assert.equal(masteredWordState.mixedVisualPassed, true, "a mastered word should pass the mixed visual check");
assert.equal(masteredWordState.mixedAudioPassed, true, "a mastered word should pass the mixed audio check");
assert.equal(masteredWordState.reviewStage, 1, "a word should enter the first review node only after full round mastery");
assert.ok(masteredWordState.nextReviewAt, "a mastered word should receive the next review time");

const dueReviewState = structuredClone(defaultState);
const account = words.find((word) => word.word === "account");
assert.ok(account, "fixture word should exist: account");
dueReviewState.userWordStates[account.id] = {
  familiarity: 5,
  correctStreak: 3,
  wrongCount: 0,
  lastSeenAt: new Date(Date.now() - 86400000).toISOString(),
  favorite: false,
  reviewStage: 2,
  nextReviewAt: new Date(Date.now() - 86400000).toISOString(),
  lastReviewAt: new Date(Date.now() - 3 * 86400000).toISOString()
};
startDailyLearning(dueReviewState);
assert.equal(dueReviewState.daily.candidateWordIds[0], account.id, "due review words should outrank fresh words");

const failedReviewState = structuredClone(defaultState);
failedReviewState.userWordStates[account.id] = {
  familiarity: 5,
  correctStreak: 3,
  wrongCount: 0,
  lastSeenAt: new Date(Date.now() - 86400000).toISOString(),
  favorite: false,
  reviewStage: 2,
  nextReviewAt: new Date(Date.now() - 86400000).toISOString(),
  lastReviewAt: new Date(Date.now() - 3 * 86400000).toISOString()
};
startDailyLearning(failedReviewState);
completeGroupWithOneWrongAnswer(failedReviewState, ["account", "absolutely", "accident"], "account");
completeGroup(failedReviewState, ["ache", "achievement", "acquire"]);
answerAllMixedQuestions(failedReviewState);
completeMixedReview(failedReviewState);
assert.equal(
  failedReviewState.userWordStates[account.id].reviewStage,
  2,
  "a due review word should stay on the current node after same-day remediation"
);
assert.ok(
  Date.parse(failedReviewState.userWordStates[account.id].nextReviewAt) > Date.now(),
  "same-day remediation should reschedule the current review node"
);

const overdueState = structuredClone(defaultState);
const achievement = words.find((word) => word.word === "achievement");
assert.ok(achievement, "fixture word should exist: achievement");
overdueState.userWordStates[achievement.id] = {
  familiarity: 5,
  correctStreak: 4,
  wrongCount: 0,
  lastSeenAt: new Date(Date.now() - 9 * 86400000).toISOString(),
  favorite: false,
  reviewStage: 4,
  nextReviewAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  lastReviewAt: new Date(Date.now() - 15 * 86400000).toISOString()
};
startDailyLearning(overdueState);
assert.equal(overdueState.userWordStates[achievement.id].reviewStage, 1, "seriously overdue review should fall back to day-1 review");
assert.equal(overdueState.daily.candidateWordIds[0], achievement.id, "overdue downgraded words should be reviewed first");

function completeGroup(state, headwords) {
  state.daily.selectedWordIds = selectedIds(headwords);
  confirmPrecheck(state);
  prepareGroupReviewQuestions(state);
  for (let index = 0; index < headwords.length; index += 1) {
    const question = getCurrentGroupReviewQuestion(state);
    const word = words.find((item) => item.id === question.wordId);
    answerGroupReviewQuestion(state, word.cn.join("，"));
    moveToNextGroupReviewQuestion(state);
  }
  prepareAudioQuestions(state);
  for (let index = 0; index < headwords.length; index += 1) {
    const question = getCurrentAudioQuestion(state);
    const word = words.find((item) => item.id === question.wordId);
    answerAudioQuestion(state, word.cn.join("，"));
    moveToNextAudioQuestion(state);
  }
}

function completeGroupWithOneWrongAnswer(state, headwords, wrongHeadword) {
  state.daily.selectedWordIds = selectedIds(headwords);
  confirmPrecheck(state);
  prepareGroupReviewQuestions(state);
  for (let index = 0; index < headwords.length; index += 1) {
    const question = getCurrentGroupReviewQuestion(state);
    const word = words.find((item) => item.id === question.wordId);
    answerGroupReviewQuestion(state, word.word === wrongHeadword ? "错误释义" : word.cn.join("，"));
    moveToNextGroupReviewQuestion(state);
  }
  const retryQuestion = getCurrentGroupReviewQuestion(state);
  const retryWord = words.find((item) => item.id === retryQuestion.wordId);
  answerGroupReviewQuestion(state, retryWord.cn.join("，"));
  moveToNextGroupReviewQuestion(state);

  prepareAudioQuestions(state);
  for (let index = 0; index < headwords.length; index += 1) {
    const question = getCurrentAudioQuestion(state);
    const word = words.find((item) => item.id === question.wordId);
    answerAudioQuestion(state, word.cn.join("，"));
    moveToNextAudioQuestion(state);
  }
}

function finishMixedReview(state) {
  state.daily.mixedIndex = state.daily.mixedQuestions.length - 1;
  assert.equal(moveToNextMixedReviewQuestion(state), "complete");
  return completeMixedReview(state);
}

function answerAllMixedQuestions(state) {
  while (state.daily.mixedIndex < state.daily.mixedQuestions.length) {
    const question = getCurrentMixedReviewQuestion(state);
    const word = words.find((item) => item.id === question.wordId);
    answerMixedReviewQuestion(state, word.cn.join("，"));
    if (moveToNextMixedReviewQuestion(state) === "complete") {
      return;
    }
  }
}

function selectedIds(headwords) {
  return headwords.map((headword) => {
    const word = words.find((item) => item.word === headword);
    assert.ok(word, `fixture word should exist: ${headword}`);
    return word.id;
  });
}

function meaningFor(headword) {
  const word = words.find((item) => item.word === headword);
  assert.ok(word, `fixture word should exist: ${headword}`);
  return word.cn.join("，");
}
