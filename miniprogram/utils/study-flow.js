const { testQuestions } = require("../data/test-questions");
const { words } = require("../data/words");
const { buildAssessmentResult, buildDailyReport } = require("./report");

function startAssessment(state) {
  state.assessment = { completed: false, currentIndex: 0, answers: [], result: null };
}

function getCurrentTestQuestion(state) {
  return testQuestions[state.assessment.currentIndex];
}

function answerAssessmentQuestion(state, selected) {
  const question = getCurrentTestQuestion(state);
  const isCorrect = selected === question.answer;
  state.assessment.answers.push({
    questionId: question.id,
    word: question.word,
    selected,
    answer: question.answer,
    isCorrect,
    durationMs: 0
  });
  state.assessment.currentIndex += 1;
  if (state.assessment.currentIndex >= testQuestions.length) {
    state.assessment.completed = true;
    state.assessment.result = buildAssessmentResult(state.assessment);
  }
}

function startDailyLearning(state) {
  state.daily = {
    startedAt: new Date().toISOString(),
    selectedWordIds: [],
    groupQueue: [],
    roundIndex: 1,
    batchWordIds: [],
    completedWordIds: [],
    sessionCompletedWordIds: [],
    mixedReviewWordIds: [],
    candidateWordIds: buildCandidateWordIds(state.userWordStates),
    precheck: {},
    studyIndex: 0,
    reviewPhase: "initial",
    audioQuestions: [],
    audioIndex: 0,
    mixedQuestions: [],
    mixedIndex: 0,
    groupFeedback: "",
    completed: false
  };
}

function markPrecheck(state, wordId, status) {
  if (status === "known") {
    state.daily.precheck[wordId] = "known";
    state.daily.selectedWordIds = state.daily.selectedWordIds.filter((id) => id !== wordId);
    return;
  }
  if (state.daily.precheck[wordId] === status) {
    delete state.daily.precheck[wordId];
  } else {
    state.daily.precheck[wordId] = status;
    if (!state.daily.selectedWordIds.includes(wordId) && state.daily.selectedWordIds.length < 3) {
      state.daily.selectedWordIds = state.daily.selectedWordIds.concat(wordId);
    }
  }
}

function togglePrecheckWord(state, wordId) {
  if (state.daily.selectedWordIds.includes(wordId)) {
    state.daily.selectedWordIds = state.daily.selectedWordIds.filter((id) => id !== wordId);
    return;
  }
  if (state.daily.selectedWordIds.length < 3) {
    state.daily.selectedWordIds = state.daily.selectedWordIds.concat(wordId);
  }
}

function autoSelectPrecheckWords(state) {
  const remaining = state.daily.candidateWordIds.filter((wordId) => !state.daily.completedWordIds.includes(wordId));
  const unfamiliar = remaining.filter((wordId) => state.daily.precheck[wordId] !== "known");
  const fallback = remaining.filter((wordId) => !unfamiliar.includes(wordId));
  state.daily.selectedWordIds = unfamiliar.concat(fallback).slice(0, 3);
}

function confirmPrecheck(state) {
  if (state.daily.selectedWordIds.length !== 3) autoSelectPrecheckWords(state);
  const firstGroup = state.daily.selectedWordIds.slice(0, 3);
  state.daily.studyIndex = 0;
  state.daily.groupQueue = [firstGroup];
  state.daily.batchWordIds = uniqueIds(state.daily.batchWordIds.concat(firstGroup));
  state.daily.selectedWordIds = firstGroup;
  state.daily.reviewPhase = "initial";
  state.daily.mixedReviewWordIds = [];
  state.daily.audioQuestions = [];
  state.daily.audioIndex = 0;
  state.daily.mixedQuestions = [];
  state.daily.mixedIndex = 0;
  state.daily.groupFeedback = "";
}

function getCurrentStudyWord(state) {
  const group = state.daily.groupQueue[0] || state.daily.selectedWordIds;
  return getWordById(group[state.daily.studyIndex]);
}

function markStudyWord(state, familiarity) {
  const word = getCurrentStudyWord(state);
  if (!word) return;
  const current = state.userWordStates[word.id] || defaultWordState();
  state.userWordStates[word.id] = {
    ...current,
    familiarity: Math.max(current.familiarity, familiarity),
    lastSeenAt: new Date().toISOString()
  };
  state.daily.studyIndex += 1;
}

function prepareAudioQuestions(state) {
  state.daily.audioQuestions = state.daily.selectedWordIds.map((wordId) => createChoiceQuestion(wordId, "audio-meaning"));
  state.daily.audioIndex = 0;
}

function getCurrentAudioQuestion(state) {
  return state.daily.audioQuestions[state.daily.audioIndex];
}

function answerAudioQuestion(state, selectedCn) {
  return answerChoiceQuestion(state, getCurrentAudioQuestion(state), selectedCn, "audio-meaning");
}

function moveToNextAudioQuestion(state) {
  state.daily.audioIndex += 1;
  if (state.daily.audioIndex < state.daily.audioQuestions.length) return "audio";
  const currentGroup = state.daily.selectedWordIds;
  state.daily.completedWordIds = uniqueIds(state.daily.completedWordIds.concat(currentGroup));
  state.daily.sessionCompletedWordIds = uniqueIds(state.daily.sessionCompletedWordIds.concat(currentGroup));
  state.daily.selectedWordIds = [];
  state.daily.studyIndex = 0;
  state.daily.audioQuestions = [];
  state.daily.audioIndex = 0;
  state.daily.groupQueue = [];
  if (state.daily.completedWordIds.length >= 6) {
    prepareMixedReview(state);
    state.daily.groupFeedback = state.daily.completedWordIds.length >= 9
      ? "3 组完成，进入 9 词混组复习"
      : "2 组完成，进入 6 词混组复习";
    return "mixed-review";
  }
  state.daily.groupFeedback = "本组完成，重新选下一组";
  return "next-selection";
}

function getCurrentMixedReviewQuestion(state) {
  return state.daily.mixedQuestions[state.daily.mixedIndex];
}

function answerMixedReviewQuestion(state, selectedCn) {
  return answerChoiceQuestion(state, getCurrentMixedReviewQuestion(state), selectedCn, "mixed-review");
}

function moveToNextMixedReviewQuestion(state) {
  state.daily.mixedIndex += 1;
  return state.daily.mixedIndex >= state.daily.mixedQuestions.length ? "complete" : "mixed-review";
}

function completeMixedReview(state) {
  if (state.daily.mixedReviewWordIds.length < 9) {
    state.daily.reviewPhase = "initial";
    state.daily.mixedReviewWordIds = [];
    state.daily.mixedQuestions = [];
    state.daily.mixedIndex = 0;
    state.daily.groupFeedback = "2 组混合复习完成，继续选择第 3 组";
    return "next-selection";
  }
  state.daily.completed = true;
  state.user.streakDays = Math.max(1, state.user.streakDays + 1);
  state.user.longestStreak = Math.max(state.user.longestStreak || 0, state.user.streakDays);
  if (!state.user.badges.includes("起步徽章")) state.user.badges.push("起步徽章");
  state.lastReport = buildDailyReport(state, words);
  return "daily-report";
}

function getWordById(id) {
  return words.find((word) => word.id === id);
}

function buildCandidateWordIds(userWordStates, excludedWordIds = []) {
  const excluded = {};
  excludedWordIds.forEach((id) => { excluded[id] = true; });
  const weakIds = Object.keys(userWordStates || {}).filter((wordId) => {
    const wordState = userWordStates[wordId];
    return wordState.wrongCount > 0 || wordState.familiarity < 2;
  });
  const freshIds = prioritiseCurriculumWords(words).map((word) => word.id).filter((id) => !weakIds.includes(id));
  return uniqueIds(weakIds.concat(freshIds)).filter((id) => !excluded[id]).slice(0, 9);
}

function prepareMixedReview(state) {
  state.daily.reviewPhase = "mixed";
  state.daily.mixedReviewWordIds = uniqueIds(state.daily.batchWordIds);
  state.daily.mixedQuestions = state.daily.mixedReviewWordIds.map((wordId) => createChoiceQuestion(wordId, "mixed-review"));
  state.daily.mixedIndex = 0;
}

function createChoiceQuestion(wordId, type) {
  const word = getWordById(wordId);
  const correct = word.cn.join("，");
  const allDistractors = uniqueIds(words
    .filter((item) => item.id !== wordId)
    .map((item) => item.cn.join("，"))
    .filter((meaning) => meaning !== correct));
  const offset = word.sourceIndex % Math.max(1, allDistractors.length - 3);
  const distractors = allDistractors.slice(offset, offset + 3);
  return { wordId, type, options: shuffle([correct].concat(distractors)), answered: false, selected: null, isCorrect: null };
}

function answerChoiceQuestion(state, question, selectedCn, type) {
  const word = getWordById(question.wordId);
  const isCorrect = word.cn.join("，") === selectedCn;
  const current = state.userWordStates[word.id] || defaultWordState();
  state.userWordStates[word.id] = {
    ...current,
    familiarity: isCorrect ? Math.min(current.familiarity + 1, 5) : Math.max(current.familiarity - 1, 0),
    correctStreak: isCorrect ? current.correctStreak + 1 : 0,
    wrongCount: isCorrect ? current.wrongCount : current.wrongCount + 1,
    lastSeenAt: new Date().toISOString()
  };
  state.answerRecords.push({
    id: `answer_${Date.now()}_${state.answerRecords.length}`,
    sessionId: state.daily.startedAt,
    type,
    wordId: word.id,
    selected: selectedCn,
    answer: word.cn.join("，"),
    isCorrect,
    createdAt: new Date().toISOString()
  });
  question.answered = true;
  question.selected = selectedCn;
  question.isCorrect = isCorrect;
  return { isCorrect, word };
}

function prioritiseCurriculumWords(items) {
  return items.filter((word) => word.starLevel === 1)
    .concat(items.filter((word) => word.starLevel === 2))
    .concat(items.filter((word) => word.starLevel === 0));
}

function defaultWordState() {
  return { familiarity: 0, correctStreak: 0, wrongCount: 0, lastSeenAt: null, favorite: false };
}

function uniqueIds(ids) {
  const seen = {};
  return ids.filter((id) => {
    if (!id || seen[id]) return false;
    seen[id] = true;
    return true;
  });
}

function shuffle(items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = result[index];
    result[index] = result[swapIndex];
    result[swapIndex] = temp;
  }
  return result;
}

module.exports = {
  answerAssessmentQuestion,
  answerAudioQuestion,
  answerMixedReviewQuestion,
  autoSelectPrecheckWords,
  completeMixedReview,
  confirmPrecheck,
  getCurrentAudioQuestion,
  getCurrentMixedReviewQuestion,
  getCurrentStudyWord,
  getCurrentTestQuestion,
  getWordById,
  markPrecheck,
  markStudyWord,
  moveToNextAudioQuestion,
  moveToNextMixedReviewQuestion,
  prepareAudioQuestions,
  startAssessment,
  startDailyLearning,
  togglePrecheckWord
};
