import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { words } = require("../miniprogram/data/words.js");
const { buildAssessmentResult } = require("../miniprogram/utils/report.js");
const { defaultState } = require("../miniprogram/utils/storage.js");
const {
  answerAudioQuestion,
  answerAssessmentQuestion,
  answerGroupReviewQuestion,
  answerMeaningRecallQuestion,
  answerMixedReviewQuestion,
  completeMixedReview,
  confirmPrecheck,
  getCurrentAudioQuestion,
  getCurrentTestQuestion,
  getCurrentGroupReviewQuestion,
  getCurrentMeaningRecallQuestion,
  getCurrentMixedReviewQuestion,
  markPrecheck,
  moveToNextAudioQuestion,
  moveToNextGroupReviewQuestion,
  moveToNextMeaningRecallQuestion,
  moveToNextMixedReviewQuestion,
  prepareAudioQuestions,
  prepareGroupReviewQuestions,
  refillPrecheckCandidateWordIds,
  startAssessment,
  startStageTest,
  getStageTestCount,
  startDailyLearning
} = require("../miniprogram/utils/study-flow.js");

const abandon = words.find((word) => word.word === "abandon");
assert.ok(abandon, "fixture word should exist");

const noDistractorState = structuredClone(defaultState);
noDistractorState.daily.selectedWordIds = [abandon.id];
prepareAudioQuestions(noDistractorState);
assert.deepEqual(
  noDistractorState.daily.audioQuestions[0].options,
  [abandon.cn.join("，")],
  "audio questions should only expose the original meaning"
);

const fullScore = buildAssessmentResult({
  answers: ["foundation", "required", "selective"].flatMap((layer) => Array.from({ length: 12 }, (_, index) => ({
    questionId: `q_${index}`,
    layer,
    selected: "正确",
    isCorrect: true
  })))
});
assert.equal(fullScore.startLevel, "selective", "full score should start from the highest V1 layer");
assert.equal(fullScore.vocabularyRange.upper, 3000, "full score should cover the 3000-word base list");

const mostlyUnknown = buildAssessmentResult({
  answers: ["foundation", "required", "selective"].flatMap((layer) => Array.from({ length: 12 }, (_, index) => ({
    questionId: `q_${index}`,
    layer,
    selected: index < 38 ? "不认识" : "错误",
    isCorrect: false
  })))
});
assert.equal(mostlyUnknown.startLevel, "foundation", "mostly unknown answers should start from foundation words");
assert.ok(mostlyUnknown.vocabularyRange.upper < 900, "many unknown answers should stay in a remedial range");

const assessmentState = structuredClone(defaultState);
startAssessment(assessmentState, "assessment-critical-required");
assert.equal(assessmentState.assessment.questions.length, 18, "assessment should start with an 18-question first phase");
assert.ok(
  assessmentState.assessment.questions.every((question) =>
    question.options.length === 4 &&
    question.options.includes(question.answer) &&
    !question.options.includes("不认识") &&
    new Set(question.options).size === 4),
  "assessment questions should offer four distinct meaning choices including the correct one"
);
assert.deepEqual(
  ["foundation", "required", "selective"].map((layer) => assessmentState.assessment.questions.filter((question) => question.layer === layer).length),
  [6, 6, 6],
  "first assessment phase should sample six questions from each layer"
);
const seededAssessmentA = structuredClone(defaultState);
const seededAssessmentB = structuredClone(defaultState);
const seededAssessmentC = structuredClone(defaultState);
startAssessment(seededAssessmentA, "assessment-seed-a");
startAssessment(seededAssessmentB, "assessment-seed-a");
startAssessment(seededAssessmentC, "assessment-seed-c");
assert.deepEqual(
  seededAssessmentA.assessment.questions.map((question) => question.sourceWordId),
  seededAssessmentB.assessment.questions.map((question) => question.sourceWordId),
  "the same assessment seed should keep one test session stable"
);
assert.notDeepEqual(
  seededAssessmentA.assessment.questions.map((question) => question.sourceWordId),
  seededAssessmentC.assessment.questions.map((question) => question.sourceWordId),
  "different assessment seeds should sample different vocabulary questions"
);
for (let index = 0; index < 18; index += 1) {
  const question = getCurrentTestQuestion(assessmentState);
  const shouldPassRequiredBoundary = question.layer === "foundation" || (question.layer === "required" && assessmentState.assessment.answers.filter((answer) => answer.layer === "required" && answer.isCorrect).length < 4);
  answerAssessmentQuestion(assessmentState, shouldPassRequiredBoundary ? question.answer : "不认识");
}
assert.equal(assessmentState.assessment.questions.length, 36, "assessment should append an 18-question adaptive phase");
assert.equal(
  assessmentState.assessment.questions.slice(18).filter((question) => question.layer === "required").length,
  18,
  "a single critical layer should receive all adaptive questions"
);

const state = structuredClone(defaultState);
state.user.settings.dailyTargetListCount = 1;
startDailyLearning(state);
assert.equal(state.daily.candidateWordIds.length, 9, "daily learning should open with a nine-word precheck window");
assert.equal(state.daily.dailyTargetWordCount, 9, "one daily List should require nine unfamiliar words");
assert.deepEqual(
  [...new Set(state.daily.candidateWordIds.map((wordId) => words.find((word) => word.id === wordId)?.starLevel))],
  [1],
  "fresh precheck windows should start from one curriculum stage"
);
const foundationStartState = structuredClone(defaultState);
foundationStartState.user.learningStartLevel = "foundation";
startDailyLearning(foundationStartState);
const foundationCandidateWords = foundationStartState.daily.candidateWordIds.map((wordId) => words.find((word) => word.id === wordId));
assert.deepEqual(
  [...new Set(foundationCandidateWords.map((word) => word?.starLevel))],
  [0],
  "assessment start level should move fresh candidates to foundation words"
);
assert.ok(
  !foundationCandidateWords.some((word) => word.word === "a" || /^(art\.|conj\.|prep\.|pron\.)/.test(word.pos)),
  "foundation candidates should not surface single-letter or function words as learning targets"
);
assert.ok(
  foundationCandidateWords.map((word) => word.word).join("|") !== foundationCandidateWords.map((word) => word.word).sort().join("|"),
  "foundation candidates should be stably shuffled instead of alphabetical"
);
const firstCandidateId = state.daily.candidateWordIds[0];
markPrecheck(state, firstCandidateId, "known");
assert.equal(state.daily.candidateWordIds.length, 9, "marking a word known should refill the precheck list to nine candidates");
assert.ok(!state.daily.candidateWordIds.includes(firstCandidateId), "known words should be removed from the visible precheck candidates");

const interruptedGroupState = structuredClone(defaultState);
startDailyLearning(interruptedGroupState);
interruptedGroupState.daily.learningWordIds = selectedIds([
  "abandon", "accident", "account",
  "ache", "acquire", "adapt",
  "add", "address", "advantage"
]);
confirmPrecheck(interruptedGroupState);
assert.deepEqual(interruptedGroupState.daily.seenWordIds, selectedIds([
  "abandon", "accident", "account",
  "ache", "acquire", "adapt",
  "add", "address", "advantage"
]), "confirmed precheck words should be remembered as seen for today");
interruptedGroupState.daily.candidateWordIds = selectedIds(["abandon", "accident", "account", "ache", "acquire", "adapt", "add", "address", "advantage"]);
refillPrecheckCandidateWordIds(interruptedGroupState);
assert.ok(
  !interruptedGroupState.daily.candidateWordIds.some((id) => selectedIds([
    "abandon", "accident", "account",
    "ache", "acquire", "adapt",
    "add", "address", "advantage"
  ]).includes(id)),
  "words selected into an interrupted list should not reappear in precheck before tomorrow"
);
assert.equal(interruptedGroupState.daily.completedWordIds.length, 0, "seen words should not be treated as completed");
startDailyLearning(interruptedGroupState);
assert.ok(
  !interruptedGroupState.daily.candidateWordIds.some((id) => selectedIds([
    "abandon", "accident", "account",
    "ache", "acquire", "adapt",
    "add", "address", "advantage"
  ]).includes(id)),
  "restarting today's learning should still exclude words already selected into an interrupted list"
);
assert.deepEqual(interruptedGroupState.daily.seenWordIds, selectedIds([
  "abandon", "accident", "account",
  "ache", "acquire", "adapt",
  "add", "address", "advantage"
]), "today's seen words should survive a same-day restart");

const directSeenState = structuredClone(defaultState);
directSeenState.daily.startedAt = new Date().toISOString();
directSeenState.daily.seenWordIds = selectedIds(["abandon", "accident", "account"]);
startDailyLearning(directSeenState);
assert.ok(
  !directSeenState.daily.candidateWordIds.some((id) => selectedIds(["abandon", "accident", "account"]).includes(id)),
  "candidate generation itself should exclude today's seen words even without completed state"
);

setLearningList(state, [
  "abandon", "accident", "account",
  "ache", "acquire", "adapt",
  "add", "address", "advantage"
]);
assert.deepEqual(state.daily.selectedWordIds, selectedIds(["abandon", "accident", "account"]), "precheck should prepare the first micro-list");

assert.equal(completeGroup(state, ["abandon", "accident", "account"]), "word-study", "first micro-list should move straight to the second micro-list");
assert.equal(state.daily.reviewPhase, "initial", "one micro-list should not trigger mixed review");
assert.deepEqual(state.daily.selectedWordIds, selectedIds(["ache", "acquire", "adapt"]), "second micro-list should be prepared automatically");

assert.equal(completeGroup(state, ["ache", "acquire", "adapt"]), "mixed-review", "second micro-list should trigger 1+2 mixed review");
assert.equal(state.daily.activeMixedReview.groupLabel, "片段 1 + 片段 2", "two micro-lists should name their source fragments");
assert.equal(state.daily.mixedReviewWordIds.length, 6, "two micro-lists should mix six words");
assert.equal(finishMixedReview(state), "word-study", "six-word mixed review should continue to the third micro-list");
assert.equal(state.daily.completedWordIds.length, 6, "six-word mixed review should keep the current list progress");
assert.deepEqual(state.daily.selectedWordIds, selectedIds(["add", "address", "advantage"]), "third micro-list should be prepared after mixed review");

assert.equal(completeGroup(state, ["add", "address", "advantage"]), "mixed-review", "third micro-list should trigger list-level mixed review");
assert.equal(state.daily.activeMixedReview.groupLabel, "List 1 内复习", "third micro-list should mix the whole List");
assert.equal(state.daily.mixedReviewWordIds.length, 9, "third micro-list should mix all nine words in the List");
assert.equal(finishMixedReview(state), "daily-report", "one configured List should complete after its list-level review");
const todayKey = new Date().toLocaleDateString("en-CA");
assert.equal(state.user.streakDays, 1, "completing a daily round should count as one calendar-day checkin");
assert.equal(state.user.checkins[todayKey].completed, true, "daily completion should be stored in the user's checkin calendar");
assert.equal(state.user.checkins[todayKey].learnedWords, 9, "today's checkin should store the learned word count");
assert.equal(state.user.checkins[todayKey].completedGroups, 3, "today's checkin should store completed groups");
assert.equal(state.daily.completedWordIds.length, 9, "completed list should keep the learned words for reporting");

const crossBigGroupState = structuredClone(defaultState);
crossBigGroupState.user.settings.dailyTargetListCount = 2;
startDailyLearning(crossBigGroupState);
setLearningList(crossBigGroupState, [
  "abandon", "accident", "account",
  "ache", "acquire", "adapt",
  "add", "address", "advantage",
  "advice", "advise", "afford",
  "afraid", "after", "ability",
  "able", "abnormal", "abroad"
]);
completeGroup(crossBigGroupState, ["abandon", "accident", "account"]);
completeGroup(crossBigGroupState, ["ache", "acquire", "adapt"]);
finishMixedReview(crossBigGroupState);
completeGroup(crossBigGroupState, ["add", "address", "advantage"]);
assert.equal(crossBigGroupState.daily.activeMixedReview.groupLabel, "List 1 内复习", "third micro-list should queue List 1 review");
assert.equal(crossBigGroupState.daily.mixedReviewWordIds.length, 9, "List 1 review should contain nine words");
assert.equal(finishMixedReview(crossBigGroupState), "word-study", "first List review should continue to List 2");
completeGroup(crossBigGroupState, ["advice", "advise", "afford"]);
completeGroup(crossBigGroupState, ["afraid", "after", "ability"]);
finishMixedReview(crossBigGroupState);
completeGroup(crossBigGroupState, ["able", "abnormal", "abroad"]);
assert.equal(crossBigGroupState.daily.activeMixedReview.groupLabel, "List 2 内复习", "sixth micro-list should first run List 2 review");
assert.equal(crossBigGroupState.daily.mixedReviewWordIds.length, 9, "List 2 review should contain nine words");
assert.equal(finishMixedReview(crossBigGroupState), "mixed-review", "two completed Lists should then queue one group review");
assert.equal(crossBigGroupState.daily.activeMixedReview.groupLabel, "List 1 + List 2", "two completed Lists should name the paired group review");
assert.equal(crossBigGroupState.daily.mixedReviewWordIds.length, 18, "two completed Lists should trigger one paired group review");
assert.equal(finishMixedReview(crossBigGroupState), "daily-report", "two-List target should finish after the paired group review");

const reviewState = structuredClone(defaultState);
startDailyLearning(reviewState);
setLearningList(reviewState, [
  "abandon", "accident", "account",
  "ache", "acquire", "adapt",
  "add", "address", "advantage"
]);
prepareGroupReviewQuestions(reviewState);
assert.equal(reviewState.daily.groupQuestions.length, 3, "group review should start with three visual questions");
assert.equal(getCurrentGroupReviewQuestion(reviewState).mode, "visual", "group review should test visual word meaning first");
answerGroupReviewQuestion(reviewState, "错误释义");
assert.equal(reviewState.daily.groupQuestions.length, 4, "wrong visual answer should append one retry question");
assert.equal(reviewState.daily.groupQuestions.at(-1).wordId, abandon.id, "retry question should use the missed word");
assert.equal(moveToNextGroupReviewQuestion(reviewState), "group-review", "wrong answer should keep the group review running");
answerGroupReviewQuestion(reviewState, meaningFor("accident"));
assert.equal(moveToNextGroupReviewQuestion(reviewState), "group-review");
answerGroupReviewQuestion(reviewState, meaningFor("account"));
assert.equal(moveToNextGroupReviewQuestion(reviewState), "group-review", "retry should still be pending");
answerGroupReviewQuestion(reviewState, meaningFor("abandon"));
assert.equal(moveToNextGroupReviewQuestion(reviewState), "audio-meaning", "group review should finish only after the retry is cleared");

const mixedModeState = structuredClone(defaultState);
startDailyLearning(mixedModeState);
setLearningList(mixedModeState, [
  "abandon", "accident", "account",
  "ache", "acquire", "adapt",
  "add", "address", "advantage"
]);
completeGroup(mixedModeState, ["abandon", "accident", "account"]);
completeGroup(mixedModeState, ["ache", "acquire", "adapt"]);
assert.equal(mixedModeState.daily.mixedQuestions.length, 6, "six-word mixed review should include visual questions only");
assert.equal(
  mixedModeState.daily.mixedQuestions.filter((question) => question.mode === "visual").length,
  6,
  "six-word mixed review should include six visual questions"
);
assert.equal(
  mixedModeState.daily.mixedQuestions.filter((question) => question.mode === "audio").length,
  0,
  "six-word mixed review should not include audio questions"
);

answerAllMixedQuestions(mixedModeState);
completeMixedReview(mixedModeState);
const masteredWordState = mixedModeState.userWordStates[abandon.id];
assert.equal(masteredWordState.groupVisualPassed, true, "a mastered word should pass the group visual check");
assert.equal(masteredWordState.groupAudioPassed, true, "a mastered word should pass the group audio check");
assert.equal(masteredWordState.mixedVisualPassed, true, "a mastered word should pass the mixed visual check");
assert.equal(masteredWordState.reviewStage, 0, "mastered words should no longer enter an Ebbinghaus review node");
assert.equal(masteredWordState.nextReviewAt, null, "mastered words should not receive Ebbinghaus next-review time");

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
assert.ok(
  !dueReviewState.daily.candidateWordIds.includes(account.id),
  "due review words should no longer be injected into the main list flow"
);

function completeGroup(state, headwords) {
  assert.deepEqual(state.daily.selectedWordIds, selectedIds(headwords), "current micro-list should match the expected fixture words");
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
  return completeMeaningRecall(state, headwords);
}

function completeGroupWithOneWrongAnswer(state, headwords, wrongHeadword) {
  assert.deepEqual(state.daily.selectedWordIds, selectedIds(headwords), "current micro-list should match the expected fixture words");
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
  return completeMeaningRecall(state, headwords);
}

function completeMeaningRecall(state, headwords) {
  let phase = "meaning-recall";
  for (let index = 0; index < headwords.length; index += 1) {
    const question = getCurrentMeaningRecallQuestion(state);
    assert.ok(question, "meaning recall question should exist");
    answerMeaningRecallQuestion(state);
    phase = moveToNextMeaningRecallQuestion(state);
  }
  return phase;
}

function setLearningList(state, headwords) {
  const listCount = Math.ceil(headwords.length / 9);
  const ids = selectedIds(headwords);
  state.user.settings.dailyTargetListCount = listCount;
  state.user.settings.listGroupCount = listCount * 3;
  state.daily.learningWordIds = ids;
  state.daily.dailyTargetListCount = listCount;
  state.daily.dailyTargetWordCount = listCount * 9;
  state.daily.listTargetGroupCount = listCount * 3;
  state.daily.currentListIndex = 0;
  state.daily.currentMicroListIndex = 0;
  state.daily.completedGroups = [];
  state.daily.pendingMixedReviews = [];
  state.daily.activeMixedReview = null;
  state.daily.completedWordIds = [];
  state.daily.sessionCompletedWordIds = [];
  state.daily.batchWordIds = [];
  state.daily.precheck = ids.reduce((result, id) => {
    result[id] = "unfamiliar";
    return result;
  }, {});
  state.daily.precheckCompleted = true;
  state.daily.seenWordIds = ids;
  confirmPrecheck(state);
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

// ---- 阶段测 (stage test) ----
// The stage test draws from already-learned words, tracks how many you've
// learned, reports mastery, and never re-levels you (unlike the placement test).
const stageState = structuredClone(defaultState);
stageState.user.wordLevelId = "senior";
stageState.user.learningStartLevel = "required";
const stageWords = words.slice(0, 15);
stageWords.forEach((word, index) => {
  stageState.userWordStates[word.id] = { familiarity: (index % 4) + 1, wrongCount: index < 5 ? 2 : 0 };
});

assert.equal(getStageTestCount(stageState), 15, "stage test length should equal the learned-word count (under the cap)");

startStageTest(stageState);
assert.equal(stageState.assessment.mode, "stage", "stage test runs in stage mode");
assert.equal(stageState.assessment.questions.length, 15, "stage test should ask one question per sampled learned word");
assert.ok(!stageState.assessment.completed, "stage test should not be complete before answering");

let stageGuard = 0;
while (!stageState.assessment.completed && stageGuard < 50) {
  const question = getCurrentTestQuestion(stageState);
  answerAssessmentQuestion(stageState, question.answer);
  stageGuard += 1;
}
assert.equal(stageState.assessment.result.mode, "stage", "completed stage test yields a stage result");
assert.equal(stageState.assessment.result.total, 15, "stage result counts every answered question");
assert.equal(stageState.assessment.result.accuracy, 100, "all-correct stage test reports 100% mastery");
assert.equal(stageState.user.learningStartLevel, "required", "stage test must not change the learning level");
assert.equal(stageState.user.wordLevelId, "senior", "stage test must not re-confirm the word level");

const cappedState = structuredClone(defaultState);
words.slice(0, 40).forEach((word) => {
  cappedState.userWordStates[word.id] = { familiarity: 2, wrongCount: 0 };
});
assert.ok(getStageTestCount(cappedState) <= 20, "stage test length is capped so a quick check stays quick");

const unlearnedState = structuredClone(defaultState);
assert.equal(getStageTestCount(unlearnedState), 0, "a student with no learned words has no stage test to take");
