import { testQuestions } from "../data/test-questions.js";
import { words } from "../data/words.js";
import { buildAssessmentResult, buildDailyReport } from "./report.js";

export function startAssessment(state) {
  state.assessment = {
    completed: false,
    currentIndex: 0,
    answers: [],
    result: null
  };
}

export function getCurrentTestQuestion(state) {
  return testQuestions[state.assessment.currentIndex];
}

export function answerAssessmentQuestion(state, selected) {
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

export function startDailyLearning(state) {
  const candidateWordIds = buildCandidateWordIds(state.userWordStates);
  state.daily = {
    startedAt: new Date().toISOString(),
    selectedWordIds: [],
    groupQueue: [],
    currentGroupIndex: 0,
    roundIndex: 1,
    batchWordIds: [],
    completedWordIds: [],
    sessionCompletedWordIds: [],
    mixedReviewWordIds: [],
    candidateWordIds,
    precheck: {},
    studyIndex: 0,
    reviewPhase: "initial",
    reviewed: false,
    mixedReviewed: false,
    audioQuestions: [],
    audioIndex: 0,
    audioCompleted: false,
    mixedQuestions: [],
    mixedIndex: 0,
    groupFeedback: "",
    completed: false
  };
}

export function markPrecheck(state, wordId, status) {
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
      state.daily.selectedWordIds = [...state.daily.selectedWordIds, wordId];
    }
  }
}

export function togglePrecheckWord(state, wordId) {
  if (state.daily.selectedWordIds.includes(wordId)) {
    state.daily.selectedWordIds = state.daily.selectedWordIds.filter((id) => id !== wordId);
    return;
  }
  if (state.daily.selectedWordIds.length >= 3) {
    return;
  }
  state.daily.selectedWordIds = [...state.daily.selectedWordIds, wordId];
}

export function autoSelectPrecheckWords(state) {
  const unfamiliar = getRemainingCandidateWordIds(state).filter((wordId) => state.daily.precheck[wordId] !== "known");
  const fallback = getRemainingCandidateWordIds(state).filter((wordId) => !unfamiliar.includes(wordId));
  state.daily.selectedWordIds = [...unfamiliar, ...fallback].slice(0, 3);
}

export function confirmPrecheck(state) {
  if (state.daily.selectedWordIds.length !== 3) {
    autoSelectPrecheckWords(state);
  }
  const firstGroup = state.daily.selectedWordIds.slice(0, 3);
  state.daily.studyIndex = 0;
  state.daily.currentGroupIndex = 0;
  state.daily.groupQueue = [firstGroup];
  state.daily.batchWordIds = uniqueIds([
    ...state.daily.batchWordIds,
    ...firstGroup
  ]);
  state.daily.selectedWordIds = firstGroup;
  state.daily.reviewPhase = "initial";
  state.daily.reviewed = false;
  state.daily.mixedReviewed = false;
  state.daily.mixedReviewWordIds = [];
  state.daily.audioQuestions = [];
  state.daily.audioIndex = 0;
  state.daily.audioCompleted = false;
  state.daily.mixedQuestions = [];
  state.daily.mixedIndex = 0;
  state.daily.groupFeedback = "";
}

export function getCurrentStudyWord(state) {
  const group = state.daily.groupQueue[state.daily.currentGroupIndex] || state.daily.selectedWordIds;
  return words.find((word) => word.id === group[state.daily.studyIndex]);
}

export function markStudyWord(state, familiarity) {
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

export function prepareAudioQuestions(state) {
  const questionIds = currentGroupWordIds(state);
  state.daily.audioQuestions = questionIds.map((wordId) => createAudioQuestion(wordId));
  state.daily.audioIndex = 0;
  state.daily.audioCompleted = false;
}

export function getCurrentAudioQuestion(state) {
  return state.daily.audioQuestions[state.daily.audioIndex];
}

export function answerAudioQuestion(state, selectedCn) {
  const question = getCurrentAudioQuestion(state);
  const word = words.find((item) => item.id === question.wordId);
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
    type: "audio-meaning",
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

export function moveToNextAudioQuestion(state) {
  state.daily.audioIndex += 1;
  if (state.daily.audioIndex >= state.daily.audioQuestions.length) {
    state.daily.audioCompleted = true;
    const currentGroup = currentGroupWordIds(state);
    state.daily.completedWordIds = uniqueIds([
      ...state.daily.completedWordIds,
      ...currentGroup
    ]);
    state.daily.sessionCompletedWordIds = uniqueIds([
      ...(state.daily.sessionCompletedWordIds || []),
      ...currentGroup
    ]);
    state.daily.selectedWordIds = [];
    state.daily.studyIndex = 0;
    state.daily.reviewed = false;
    state.daily.audioQuestions = [];
    state.daily.audioIndex = 0;
    state.daily.audioCompleted = false;
    state.daily.groupQueue = [];
    if (state.daily.completedWordIds.length >= 6) {
      prepareMixedReview(state);
      state.daily.groupFeedback = state.daily.completedWordIds.length >= 9
        ? "3 组完成，进入 9 词混组复习"
        : "2 组完成，进入 6 词混组复习";
      return "mixed-review";
    }
    if (state.daily.completedWordIds.length < state.daily.candidateWordIds.length) {
      state.daily.reviewPhase = "initial";
      state.daily.mixedReviewWordIds = [];
      state.daily.groupFeedback = "本组完成，重新选下一组";
      return "next-selection";
    }
    prepareMixedReview(state);
    state.daily.groupFeedback = "本轮完成，进入混组复习";
    return "mixed-review";
  }

  return "audio";
}

export function getCurrentMixedReviewQuestion(state) {
  return state.daily.mixedQuestions[state.daily.mixedIndex];
}

export function answerMixedReviewQuestion(state, selectedCn) {
  const question = getCurrentMixedReviewQuestion(state);
  return answerChoiceQuestion(state, question, selectedCn, "mixed-review");
}

export function moveToNextMixedReviewQuestion(state) {
  state.daily.mixedIndex += 1;
  return state.daily.mixedIndex >= state.daily.mixedQuestions.length ? "complete" : "mixed-review";
}

export function completeMixedReview(state) {
  state.daily.mixedReviewed = true;
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
  if (state.user.streakDays >= 1 && !state.user.badges.includes("起步徽章")) {
    state.user.badges.push("起步徽章");
  }
  if (state.user.streakDays >= 3 && !state.user.badges.includes("三日连学")) {
    state.user.badges.push("三日连学");
  }
  state.lastReport = buildDailyReport(state, words);
  return startNextRound(state) ? "next-round" : "daily-report";
}

function createAudioQuestion(wordId) {
  return createChoiceQuestion(wordId, "audio-meaning");
}

function createChoiceQuestion(wordId, type) {
  const word = words.find((item) => item.id === wordId);
  const correct = word.cn.join("，");
  const allDistractors = Array.from(new Set(words
    .filter((item) => item.id !== wordId)
    .map((item) => item.cn.join("，"))
    .filter((meaning) => meaning !== correct)))
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
  const offset = word.sourceIndex % Math.max(1, allDistractors.length - 3);
  const distractors = allDistractors.slice(offset, offset + 3);
  const options = shuffle([correct, ...distractors]);
  return {
    wordId,
    type,
    options,
    answered: false,
    selected: null,
    isCorrect: null
  };
}

function answerChoiceQuestion(state, question, selectedCn, type) {
  const word = words.find((item) => item.id === question.wordId);
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
  return [
    ...items.filter((word) => word.starLevel === 1),
    ...items.filter((word) => word.starLevel === 2),
    ...items.filter((word) => word.starLevel === 0)
  ];
}

function buildCandidateWordIds(userWordStates, excludedWordIds = []) {
  const excluded = new Set(excludedWordIds);
  const weakIds = Object.entries(userWordStates || {})
    .filter(([, wordState]) => wordState.wrongCount > 0 || wordState.familiarity < 2)
    .map(([wordId]) => wordId);
  const learningPool = prioritiseCurriculumWords(words);
  const freshIds = learningPool.map((word) => word.id).filter((id) => !weakIds.includes(id));
  return uniqueIds([...weakIds, ...freshIds])
    .filter((id) => !excluded.has(id))
    .slice(0, 9);
}

function prepareMixedReview(state) {
  state.daily.reviewPhase = "mixed";
  state.daily.mixedReviewWordIds = buildSecondLevelReviewWordIds(state);
  state.daily.mixedQuestions = state.daily.mixedReviewWordIds.map((wordId) => createChoiceQuestion(wordId, "mixed-review"));
  state.daily.mixedIndex = 0;
}

function startNextRound(state) {
  let nextCandidateWordIds = buildCandidateWordIds(
    state.userWordStates,
    state.daily.sessionCompletedWordIds || []
  );
  if (!nextCandidateWordIds.length) {
    state.daily.sessionCompletedWordIds = [];
    nextCandidateWordIds = buildCandidateWordIds(state.userWordStates);
  }
  if (!nextCandidateWordIds.length) return false;

  state.daily.roundIndex = Number(state.daily.roundIndex || 1) + 1;
  state.daily.selectedWordIds = [];
  state.daily.groupQueue = [];
  state.daily.currentGroupIndex = 0;
  state.daily.batchWordIds = [];
  state.daily.completedWordIds = [];
  state.daily.mixedReviewWordIds = [];
  state.daily.candidateWordIds = nextCandidateWordIds;
  state.daily.precheck = {};
  state.daily.studyIndex = 0;
  state.daily.reviewPhase = "initial";
  state.daily.reviewed = false;
  state.daily.mixedReviewed = false;
  state.daily.audioQuestions = [];
  state.daily.audioIndex = 0;
  state.daily.audioCompleted = false;
  state.daily.mixedQuestions = [];
  state.daily.mixedIndex = 0;
  state.daily.groupFeedback = `上一轮完成，开始第 ${state.daily.roundIndex} 轮选词`;
  state.daily.completed = false;
  return true;
}

function buildSecondLevelReviewWordIds(state) {
  return uniqueIds(currentBatchWordIds(state));
}

function getRemainingCandidateWordIds(state) {
  return state.daily.candidateWordIds.filter((wordId) => !state.daily.completedWordIds.includes(wordId));
}

function currentGroupWordIds(state) {
  return state.daily.selectedWordIds;
}

function currentBatchWordIds(state) {
  return state.daily.batchWordIds.length ? state.daily.batchWordIds : state.daily.groupQueue.flat();
}

function uniqueIds(ids) {
  const seen = new Set();
  return ids.filter((id) => {
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function defaultWordState() {
  return {
    familiarity: 0,
    correctStreak: 0,
    wrongCount: 0,
    lastSeenAt: null,
    favorite: false
  };
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
