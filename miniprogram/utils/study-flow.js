const { testQuestions } = require("../data/test-questions");
const { words } = require("../data/words");
const { buildAssessmentResult, buildDailyReport } = require("./report");

const REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 15];
const PRECHECK_WINDOW_SIZE = 9;
const MAX_REVIEW_CANDIDATES = 3;
const CURRICULUM_STAGE_ORDER = [1, 2, 0];

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
  applyOverdueDowngrades(state);
  state.daily = {
    startedAt: new Date().toISOString(),
    selectedWordIds: [],
    groupQueue: [],
    roundIndex: 1,
    batchWordIds: [],
    completedWordIds: [],
    sessionCompletedWordIds: [],
    mixedReviewWordIds: [],
    candidateWordIds: buildCandidateWordIds(state),
    precheck: {},
    studyIndex: 0,
    reviewPhase: "initial",
    groupQuestions: [],
    groupIndex: 0,
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
    refillPrecheckCandidateWordIds(state);
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
  resetRoundMasteryForWords(state, firstGroup);
  state.daily.batchWordIds = uniqueIds(state.daily.batchWordIds.concat(firstGroup));
  state.daily.selectedWordIds = firstGroup;
  state.daily.reviewPhase = "initial";
  state.daily.mixedReviewWordIds = [];
  state.daily.groupQuestions = [];
  state.daily.groupIndex = 0;
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
  state.userWordStates[word.id] = Object.assign({}, current, {
    familiarity: Math.max(current.familiarity, familiarity),
    lastSeenAt: new Date().toISOString()
  });
  state.daily.studyIndex += 1;
}

function prepareGroupReviewQuestions(state) {
  state.daily.groupQuestions = currentGroupWordIds(state).map((wordId) => createChoiceQuestion(wordId, "group-word-meaning", "visual"));
  state.daily.groupIndex = 0;
}

function getCurrentGroupReviewQuestion(state) {
  return state.daily.groupQuestions[state.daily.groupIndex];
}

function answerGroupReviewQuestion(state, selectedCn) {
  return answerChoiceQuestion(state, getCurrentGroupReviewQuestion(state), selectedCn, "group-word-meaning");
}

function moveToNextGroupReviewQuestion(state) {
  state.daily.groupIndex += 1;
  if (state.daily.groupIndex >= state.daily.groupQuestions.length) {
    state.daily.groupQuestions = [];
    state.daily.groupIndex = 0;
    return "audio-meaning";
  }
  return "group-review";
}

function prepareAudioQuestions(state) {
  state.daily.audioQuestions = currentGroupWordIds(state).map((wordId) => createChoiceQuestion(wordId, "audio-meaning", "audio"));
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
  if (state.user.streakDays >= 3 && !state.user.badges.includes("三日连学")) {
    state.user.badges.push("三日连学");
  }
  state.lastReport = buildDailyReport(state, words);
  return startNextRound(state) ? "next-round" : "daily-report";
}

function getWordById(id) {
  return words.find((word) => word.id === id);
}

function getAllWords() {
  return words;
}

function buildCandidateWordIds(stateOrWordStates, excludedWordIds = []) {
  const userWordStates = stateOrWordStates.userWordStates || stateOrWordStates || {};
  const streakDays = stateOrWordStates.user && stateOrWordStates.user.streakDays ? stateOrWordStates.user.streakDays : 0;
  const excluded = {};
  excludedWordIds.forEach((id) => { excluded[id] = true; });
  const reviewWordIds = prioritiseCurriculumWords(words)
    .filter((word) => !excluded[word.id] && isReviewCandidate(userWordStates[word.id]))
    .map((word, index) => ({
      id: word.id,
      index,
      score: scoreWordRisk(word, userWordStates[word.id], streakDays)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.id)
    .slice(0, MAX_REVIEW_CANDIDATES);

  reviewWordIds.forEach((wordId) => { excluded[wordId] = true; });

  return reviewWordIds
    .concat(buildCurrentStageNewWordIds(userWordStates, excluded, PRECHECK_WINDOW_SIZE - reviewWordIds.length))
    .slice(0, PRECHECK_WINDOW_SIZE);
}

function buildCurrentStageNewWordIds(userWordStates, excluded, count) {
  const result = [];
  for (let stageIndex = 0; stageIndex < CURRICULUM_STAGE_ORDER.length; stageIndex += 1) {
    const stage = CURRICULUM_STAGE_ORDER[stageIndex];
    const stageWords = words.filter((word) => word.starLevel === stage);
    for (let index = 0; index < stageWords.length; index += 1) {
      const word = stageWords[index];
      if (result.length >= count) return result;
      if (excluded[word.id] || !isFreshWordCandidate(userWordStates[word.id])) continue;
      result.push(word.id);
      excluded[word.id] = true;
    }
    if (result.length > 0 && result.length >= count) return result;
  }
  return result;
}

function refillPrecheckCandidateWordIds(state) {
  const visibleWordIds = state.daily.candidateWordIds.filter((wordId) => isVisiblePrecheckCandidate(state, wordId));
  const excluded = uniqueIds([]
    .concat(state.daily.completedWordIds || [])
    .concat(state.daily.sessionCompletedWordIds || [])
    .concat(visibleWordIds)
    .concat(Object.keys(state.daily.precheck || {}).filter((wordId) => state.daily.precheck[wordId] === "known")));

  state.daily.candidateWordIds = uniqueIds(visibleWordIds.concat(buildCandidateWordIds(state, excluded))).slice(0, PRECHECK_WINDOW_SIZE);
}

function isVisiblePrecheckCandidate(state, wordId) {
  return Boolean(
    wordId &&
    !state.daily.completedWordIds.includes(wordId) &&
    state.daily.precheck[wordId] !== "known"
  );
}

function prepareMixedReview(state) {
  state.daily.reviewPhase = "mixed";
  state.daily.mixedReviewWordIds = uniqueIds(state.daily.batchWordIds);
  state.daily.mixedQuestions = state.daily.mixedReviewWordIds.map((wordId) => createChoiceQuestion(wordId, "mixed-review", "visual"));
  state.daily.mixedIndex = 0;
}

function startNextRound(state) {
  let nextCandidateWordIds = buildCandidateWordIds(state, state.daily.sessionCompletedWordIds || []);
  if (!nextCandidateWordIds.length) {
    state.daily.sessionCompletedWordIds = [];
    nextCandidateWordIds = buildCandidateWordIds(state);
  }
  if (!nextCandidateWordIds.length) return false;

  state.daily.roundIndex = Number(state.daily.roundIndex || 1) + 1;
  state.daily.selectedWordIds = [];
  state.daily.groupQueue = [];
  state.daily.batchWordIds = [];
  state.daily.completedWordIds = [];
  state.daily.mixedReviewWordIds = [];
  state.daily.candidateWordIds = nextCandidateWordIds;
  state.daily.precheck = {};
  state.daily.studyIndex = 0;
  state.daily.reviewPhase = "initial";
  state.daily.groupQuestions = [];
  state.daily.groupIndex = 0;
  state.daily.audioQuestions = [];
  state.daily.audioIndex = 0;
  state.daily.mixedQuestions = [];
  state.daily.mixedIndex = 0;
  state.daily.groupFeedback = `上一轮完成，开始第 ${state.daily.roundIndex} 轮选词`;
  state.daily.completed = false;
  return true;
}

function createChoiceQuestion(wordId, type, mode) {
  const word = getWordById(wordId);
  const correct = word.cn.join("，");
  const allDistractors = uniqueIds(words
    .filter((item) => item.id !== wordId)
    .map((item) => item.cn.join("，"))
    .filter((meaning) => meaning !== correct));
  const offset = word.sourceIndex % Math.max(1, allDistractors.length - 3);
  const distractors = allDistractors.slice(offset, offset + 3);
  return { wordId, type, mode: mode || "visual", options: shuffle([correct].concat(distractors)), answered: false, selected: null, isCorrect: null };
}

function answerChoiceQuestion(state, question, selectedCn, type) {
  const word = getWordById(question.wordId);
  const isCorrect = word.cn.join("，") === selectedCn;
  const current = state.userWordStates[word.id] || defaultWordState();
  const answeredState = Object.assign({}, current, {
    familiarity: isCorrect ? Math.min(current.familiarity + 1, 5) : Math.max(current.familiarity - 1, 0),
    correctStreak: isCorrect ? current.correctStreak + 1 : 0,
    wrongCount: isCorrect ? current.wrongCount : current.wrongCount + 1,
    lastSeenAt: new Date().toISOString(),
    lastResult: isCorrect ? "correct" : "wrong"
  }, masteryPatch(current, type, question.mode, isCorrect));
  state.userWordStates[word.id] = Object.assign({}, answeredState, roundMasterySchedulePatch(answeredState));
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
  if (!isCorrect) appendRetryQuestion(state, question, type);
  return { isCorrect, word };
}

function appendRetryQuestion(state, question, type) {
  const retry = createChoiceQuestion(question.wordId, type, question.mode);
  if (type === "group-word-meaning") {
    state.daily.groupQuestions.push(retry);
    return;
  }
  if (type === "audio-meaning") {
    state.daily.audioQuestions.push(retry);
    return;
  }
  if (type === "mixed-review") {
    state.daily.mixedQuestions.push(retry);
  }
}

function masteryPatch(current, type, mode, isCorrect) {
  if (!isCorrect) {
    return {
      reviewFailedThisRound: isDueForReview(current) ? true : current.reviewFailedThisRound
    };
  }
  const flag = masteryFlagFor(type, mode);
  if (!flag) return {};
  const patch = {};
  patch[flag] = true;
  return patch;
}

function masteryFlagFor(type, mode) {
  if (type === "group-word-meaning") return "groupVisualPassed";
  if (type === "audio-meaning") return "groupAudioPassed";
  if (type === "mixed-review" && mode === "visual") return "mixedVisualPassed";
  return null;
}

function roundMasterySchedulePatch(wordState) {
  if (!isRoundMastered(wordState)) return {};
  if (wordState.nextReviewAt && !isDueForReview(wordState)) {
    return { roundMasteredAt: wordState.roundMasteredAt || new Date().toISOString() };
  }
  return nextReviewPatch(wordState);
}

function isRoundMastered(wordState) {
  return Boolean(
    wordState.groupVisualPassed &&
    wordState.groupAudioPassed &&
    wordState.mixedVisualPassed
  );
}

function resetRoundMasteryForWords(state, wordIds) {
  wordIds.forEach((wordId) => {
    const current = state.userWordStates[wordId] || defaultWordState();
    state.userWordStates[wordId] = Object.assign({}, current, {
      groupVisualPassed: false,
      groupAudioPassed: false,
      mixedVisualPassed: false,
      mixedAudioPassed: false,
      reviewFailedThisRound: false,
      roundMasteredAt: null
    });
  });
}

function applyOverdueDowngrades(state) {
  Object.keys(state.userWordStates || {}).forEach((wordId) => {
    const current = state.userWordStates[wordId];
    if (!current || !current.nextReviewAt || !current.reviewStage) return;
    const overdueDays = daysPast(current.nextReviewAt);
    if (overdueDays < 3) return;

    const patch = {
      lastResult: "wrong",
      groupVisualPassed: false,
      groupAudioPassed: false,
      mixedVisualPassed: false,
      mixedAudioPassed: false,
      reviewFailedThisRound: false,
      roundMasteredAt: null
    };

    if (overdueDays >= 15) {
      patch.reviewStage = 0;
      patch.nextReviewAt = null;
      patch.familiarity = Math.min(current.familiarity || 0, 1);
    } else if (overdueDays >= 7) {
      patch.reviewStage = 1;
    } else {
      patch.reviewStage = Math.max(1, (current.reviewStage || 1) - 1);
    }

    state.userWordStates[wordId] = Object.assign({}, current, patch);
  });
}

function currentGroupWordIds(state) {
  return state.daily.selectedWordIds;
}

function prioritiseCurriculumWords(items) {
  return CURRICULUM_STAGE_ORDER.reduce((result, stage) => result.concat(items.filter((word) => word.starLevel === stage)), []);
}

function defaultWordState() {
  return {
    familiarity: 0,
    correctStreak: 0,
    wrongCount: 0,
    lastSeenAt: null,
    favorite: false,
    reviewStage: 0,
    nextReviewAt: null,
    lastReviewAt: null,
    lastResult: null,
    groupVisualPassed: false,
    groupAudioPassed: false,
    mixedVisualPassed: false,
    mixedAudioPassed: false,
    reviewFailedThisRound: false,
    roundMasteredAt: null
  };
}

function scoreWordRisk(word, wordState, streakDays) {
  if (!wordState) {
    return 100 + Math.min(streakDays, 7) * 6 + (word.starLevel === 1 ? 8 : word.starLevel === 2 ? 4 : 0);
  }
  const now = Date.now();
  const dueAt = wordState.nextReviewAt ? Date.parse(wordState.nextReviewAt) : null;
  const isDue = dueAt && dueAt <= now;
  const overdueDays = isDue ? Math.floor((now - dueAt) / 86400000) : 0;
  const recencyDays = wordState.lastSeenAt ? Math.floor((now - Date.parse(wordState.lastSeenAt)) / 86400000) : 0;
  return [
    isDue ? 10000 : 0,
    overdueDays * 240,
    (wordState.wrongCount || 0) * 180,
    wordState.lastResult === "wrong" ? 600 : 0,
    Math.max(0, 5 - (wordState.familiarity || 0)) * 80,
    recencyDays * 12
  ].reduce((sum, item) => sum + item, 0);
}

function isReviewCandidate(wordState) {
  return Boolean(
    wordState &&
    (
      isDueForReview(wordState) ||
      wordState.reviewFailedThisRound ||
      wordState.lastResult === "wrong" ||
      (wordState.wrongCount || 0) > 0
    )
  );
}

function isFreshWordCandidate(wordState) {
  if (!wordState) return true;
  if (isReviewCandidate(wordState)) return false;
  if (wordState.nextReviewAt || wordState.reviewStage) return false;
  return !wordState.lastSeenAt;
}

function nextReviewPatch(current) {
  const stage = nextReviewStage(current);
  const intervalDays = REVIEW_INTERVAL_DAYS[stage - 1] || REVIEW_INTERVAL_DAYS[REVIEW_INTERVAL_DAYS.length - 1];
  const now = new Date();
  return {
    reviewStage: stage,
    lastReviewAt: now.toISOString(),
    nextReviewAt: new Date(now.getTime() + intervalDays * 86400000).toISOString(),
    reviewFailedThisRound: false,
    roundMasteredAt: now.toISOString(),
    lastResult: "correct"
  };
}

function nextReviewStage(current) {
  const currentStage = current.reviewStage || 0;
  if (currentStage <= 0 || !current.nextReviewAt) return 1;
  if (isDueForReview(current) && current.reviewFailedThisRound) return currentStage;
  if (isDueForReview(current)) return Math.min(currentStage + 1, REVIEW_INTERVAL_DAYS.length);
  return currentStage;
}

function isDueForReview(wordState) {
  if (!wordState || !wordState.nextReviewAt || !wordState.reviewStage) return false;
  const dueAt = Date.parse(wordState.nextReviewAt);
  return Number.isFinite(dueAt) && dueAt <= Date.now();
}

function daysPast(isoDate) {
  const dueAt = Date.parse(isoDate);
  if (!Number.isFinite(dueAt)) return 0;
  return Math.floor((Date.now() - dueAt) / 86400000);
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
  answerGroupReviewQuestion,
  answerMixedReviewQuestion,
  autoSelectPrecheckWords,
  completeMixedReview,
  confirmPrecheck,
  getCurrentAudioQuestion,
  getCurrentGroupReviewQuestion,
  getCurrentMixedReviewQuestion,
  getCurrentStudyWord,
  getCurrentTestQuestion,
  getAllWords,
  getWordById,
  markPrecheck,
  markStudyWord,
  moveToNextAudioQuestion,
  moveToNextGroupReviewQuestion,
  moveToNextMixedReviewQuestion,
  prepareGroupReviewQuestions,
  prepareAudioQuestions,
  startAssessment,
  startDailyLearning,
  togglePrecheckWord
};
