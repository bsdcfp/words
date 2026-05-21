import { testQuestions } from "../data/test-questions.js";
import { words } from "../data/words.js";
import { buildAssessmentResult, buildDailyReport } from "./report.js";

const REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 15];
const PRECHECK_WINDOW_SIZE = 9;
const MAX_REVIEW_CANDIDATES = 3;
const CURRICULUM_STAGE_ORDER = [1, 2, 0];
const ASSESSMENT_LAYER_ORDER = ["foundation", "required", "selective"];
const ASSESSMENT_LAYERS = {
  foundation: { starLevel: 0, label: "义务教育基础词" },
  required: { starLevel: 1, label: "高中必修词" },
  selective: { starLevel: 2, label: "选择性必修词" }
};
const ASSESSMENT_TOTAL_QUESTIONS = 36;
const ASSESSMENT_INITIAL_PER_LAYER = 6;

export function startAssessment(state, seed = createAssessmentSeed()) {
  state.assessment = {
    completed: false,
    currentIndex: 0,
    seed,
    questions: buildInitialAssessmentQuestions(seed),
    answers: [],
    result: null
  };
}

export function getCurrentTestQuestion(state) {
  const questions = state.assessment.questions?.length ? state.assessment.questions : testQuestions;
  return questions[state.assessment.currentIndex];
}

export function answerAssessmentQuestion(state, selected) {
  const question = getCurrentTestQuestion(state);
  const isCorrect = selected === question.answer;
  state.assessment.answers.push({
    questionId: question.id,
    word: question.word,
    sourceWordId: question.sourceWordId,
    layer: question.layer,
    selected,
    answer: question.answer,
    isCorrect,
    durationMs: 0
  });
  state.assessment.currentIndex += 1;

  if (state.assessment.answers.length === 18 && state.assessment.questions.length < ASSESSMENT_TOTAL_QUESTIONS) {
    state.assessment.questions = [
      ...state.assessment.questions,
      ...buildAdaptiveAssessmentQuestions(state.assessment.answers, state.assessment.questions, state.assessment.seed)
    ];
  }

  if (state.assessment.currentIndex >= ASSESSMENT_TOTAL_QUESTIONS) {
    state.assessment.completed = true;
    state.assessment.result = buildAssessmentResult(state.assessment);
    state.user.vocabularyAssessment = {
      completedAt: new Date().toISOString(),
      startLevel: state.assessment.result.startLevel,
      vocabularyRange: state.assessment.result.vocabularyRange,
      layerStats: state.assessment.result.layerStats
    };
    state.user.learningStartLevel = state.assessment.result.startLevel;
    state.user.learningStartLevelLabel = state.assessment.result.startLevelLabel;
  }
}

export function startDailyLearning(state) {
  applyOverdueDowngrades(state);
  const candidateWordIds = buildCandidateWordIds(state);
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
    groupQuestions: [],
    groupIndex: 0,
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
    refillPrecheckCandidateWordIds(state);
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
  resetRoundMasteryForWords(state, firstGroup);
  state.daily.batchWordIds = uniqueIds([
    ...state.daily.batchWordIds,
    ...firstGroup
  ]);
  state.daily.selectedWordIds = firstGroup;
  state.daily.reviewPhase = "initial";
  state.daily.reviewed = false;
  state.daily.groupQuestions = [];
  state.daily.groupIndex = 0;
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

export function prepareGroupReviewQuestions(state) {
  state.daily.groupQuestions = currentGroupWordIds(state).map((wordId) => createChoiceQuestion(wordId, "group-word-meaning", "visual"));
  state.daily.groupIndex = 0;
  state.daily.reviewed = false;
}

export function getCurrentGroupReviewQuestion(state) {
  return state.daily.groupQuestions[state.daily.groupIndex];
}

export function answerGroupReviewQuestion(state, selectedCn) {
  const question = getCurrentGroupReviewQuestion(state);
  return answerChoiceQuestion(state, question, selectedCn, "group-word-meaning");
}

export function moveToNextGroupReviewQuestion(state) {
  state.daily.groupIndex += 1;
  if (state.daily.groupIndex >= state.daily.groupQuestions.length) {
    state.daily.reviewed = true;
    state.daily.groupQuestions = [];
    state.daily.groupIndex = 0;
    return "audio-meaning";
  }
  return "group-review";
}

export function prepareAudioQuestions(state) {
  state.daily.audioQuestions = currentGroupWordIds(state).map((wordId) => createAudioQuestion(wordId));
  state.daily.audioIndex = 0;
  state.daily.audioCompleted = false;
}

export function getCurrentAudioQuestion(state) {
  return state.daily.audioQuestions[state.daily.audioIndex];
}

export function answerAudioQuestion(state, selectedCn) {
  const question = getCurrentAudioQuestion(state);
  return answerChoiceQuestion(state, question, selectedCn, "audio-meaning");
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
      refillPrecheckCandidateWordIds(state);
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
    refillPrecheckCandidateWordIds(state);
    return "next-selection";
  }

  state.daily.completed = true;
  markDailyCheckin(state);
  if (state.user.streakDays >= 1 && !state.user.badges.includes("起步徽章")) {
    state.user.badges.push("起步徽章");
  }
  if (state.user.streakDays >= 3 && !state.user.badges.includes("三日连学")) {
    state.user.badges.push("三日连学");
  }
  state.lastReport = buildDailyReport(state, words);
  return startNextRound(state) ? "next-round" : "daily-report";
}

function markDailyCheckin(state) {
  const today = localDateKey();
  if (!state.user.checkins || typeof state.user.checkins !== "object" || Array.isArray(state.user.checkins)) {
    state.user.checkins = {};
  }
  const existing = state.user.checkins[today] || {};
  const learnedWords = (state.daily.sessionCompletedWordIds || []).length;
  const completedGroups = Math.floor(learnedWords / 3);
  state.user.checkins[today] = {
    date: today,
    completed: true,
    learnedWords: Math.max(existing.learnedWords || 0, learnedWords),
    completedGroups: Math.max(existing.completedGroups || 0, completedGroups),
    completedAt: new Date().toISOString()
  };
  state.user.streakDays = calculateCurrentStreak(state.user.checkins);
  state.user.longestStreak = Math.max(state.user.longestStreak || 0, calculateLongestStreak(state.user.checkins));
}

function calculateCurrentStreak(checkins, fromDate = new Date()) {
  let cursor = startOfLocalDay(fromDate);
  let streak = 0;
  while (checkins[localDateKey(cursor)]?.completed) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function calculateLongestStreak(checkins) {
  const days = Object.keys(checkins || {})
    .filter((dateKey) => checkins[dateKey]?.completed)
    .sort();
  let longest = 0;
  let current = 0;
  let previous = null;
  days.forEach((dateKey) => {
    const currentDate = parseLocalDateKey(dateKey);
    current = previous && daysBetween(previous, currentDate) === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = currentDate;
  });
  return longest;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(left, right) {
  return Math.round((startOfLocalDay(right).getTime() - startOfLocalDay(left).getTime()) / 86400000);
}

function createAudioQuestion(wordId) {
  return createChoiceQuestion(wordId, "audio-meaning", "audio");
}

function createChoiceQuestion(wordId, type, mode = "visual") {
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
    mode,
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
  const answeredState = {
    ...current,
    familiarity: isCorrect ? Math.min(current.familiarity + 1, 5) : Math.max(current.familiarity - 1, 0),
    correctStreak: isCorrect ? current.correctStreak + 1 : 0,
    wrongCount: isCorrect ? current.wrongCount : current.wrongCount + 1,
    lastSeenAt: new Date().toISOString(),
    lastResult: isCorrect ? "correct" : "wrong",
    ...masteryPatch(current, type, question.mode, isCorrect)
  };
  state.userWordStates[word.id] = {
    ...answeredState,
    ...roundMasterySchedulePatch(answeredState)
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
  if (!isCorrect) {
    appendRetryQuestion(state, question, type);
  }
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
  return flag ? { [flag]: true } : {};
}

function masteryFlagFor(type, mode) {
  if (type === "group-word-meaning") return "groupVisualPassed";
  if (type === "audio-meaning") return "groupAudioPassed";
  if (type === "mixed-review" && mode === "visual") return "mixedVisualPassed";
  return null;
}

function roundMasterySchedulePatch(wordState) {
  if (!isRoundMastered(wordState)) return {};
  if (wordState.nextReviewAt && !isDueForReview(wordState)) return {
    roundMasteredAt: wordState.roundMasteredAt || new Date().toISOString()
  };
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
    state.userWordStates[wordId] = {
      ...current,
      groupVisualPassed: false,
      groupAudioPassed: false,
      mixedVisualPassed: false,
      mixedAudioPassed: false,
      reviewFailedThisRound: false,
      roundMasteredAt: null
    };
  });
}

function applyOverdueDowngrades(state) {
  const entries = Object.entries(state.userWordStates || {});
  entries.forEach(([wordId, current]) => {
    if (!current?.nextReviewAt || !current.reviewStage) return;
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

    state.userWordStates[wordId] = {
      ...current,
      ...patch
    };
  });
}

function prioritiseCurriculumWords(items) {
  return CURRICULUM_STAGE_ORDER.flatMap((stage) => items.filter((word) => word.starLevel === stage));
}

function curriculumStageOrderFor(stateOrWordStates) {
  const startLevel = stateOrWordStates.user?.learningStartLevel || stateOrWordStates.user?.vocabularyAssessment?.startLevel;
  if (startLevel === "foundation") return [0, 1, 2];
  if (startLevel === "selective") return [2, 1, 0];
  return CURRICULUM_STAGE_ORDER;
}

function orderWordsByStages(items, stageOrder) {
  return stageOrder.flatMap((stage) => orderLearnableWordsForStage(items, stage));
}

function createAssessmentSeed() {
  return `${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function buildInitialAssessmentQuestions(seed) {
  const usedWordIds = new Set();
  return ASSESSMENT_LAYER_ORDER.flatMap((layer) => buildAssessmentQuestionsForLayer(layer, ASSESSMENT_INITIAL_PER_LAYER, usedWordIds, seed));
}

function buildAdaptiveAssessmentQuestions(answers, existingQuestions, seed) {
  const usedWordIds = new Set(existingQuestions.map((question) => question.sourceWordId));
  const layerCorrect = ASSESSMENT_LAYER_ORDER.map((layer) => ({
    layer,
    correct: answers.filter((answer) => answer.layer === layer && answer.isCorrect).length
  }));
  const criticalLayers = layerCorrect.filter((item) => item.correct === 3 || item.correct === 4).map((item) => item.layer);
  if (criticalLayers.length === 1) {
    return buildAssessmentQuestionsForLayer(criticalLayers[0], 18, usedWordIds, seed);
  }
  if (criticalLayers.length > 1) {
    return [
      ...buildAssessmentQuestionsForLayer(criticalLayers[0], 12, usedWordIds, seed),
      ...buildAssessmentQuestionsForLayer(criticalLayers[1], 6, usedWordIds, seed)
    ];
  }

  const foundation = layerCorrect.find((item) => item.layer === "foundation");
  if ((foundation?.correct || 0) <= 2) {
    return buildAssessmentQuestionsForLayer("foundation", 18, usedWordIds, seed);
  }

  let highestPassedIndex = -1;
  for (let index = 0; index < layerCorrect.length; index += 1) {
    if (layerCorrect[index].correct >= 5) highestPassedIndex = index;
  }
  if (highestPassedIndex >= 0 && highestPassedIndex < ASSESSMENT_LAYER_ORDER.length - 1) {
    return [
      ...buildAssessmentQuestionsForLayer(ASSESSMENT_LAYER_ORDER[highestPassedIndex], 12, usedWordIds, seed),
      ...buildAssessmentQuestionsForLayer(ASSESSMENT_LAYER_ORDER[highestPassedIndex + 1], 6, usedWordIds, seed)
    ];
  }

  return buildAssessmentQuestionsForLayer("selective", 18, usedWordIds, seed);
}

function buildAssessmentQuestionsForLayer(layer, count, usedWordIds, seed) {
  const layerConfig = ASSESSMENT_LAYERS[layer];
  const layerWords = orderAssessmentWordsForStage(words, layerConfig.starLevel, `${seed}:${layer}`)
    .filter((word) => !usedWordIds.has(word.id));
  return layerWords.slice(0, count).map((word, index) => {
    usedWordIds.add(word.id);
    return createAssessmentQuestion(word, layer, index);
  });
}

function createAssessmentQuestion(word, layer, index) {
  const correct = word.cn.join("，");
  const allDistractors = words
    .filter((item) => item.id !== word.id && item.cn.join("，") !== correct)
    .map((item) => item.cn.join("，"));
  const start = (word.sourceIndex + index) % Math.max(1, allDistractors.length - 3);
  const distractors = allDistractors.slice(start, start + 3);
  return {
    id: `vocab_${layer}_${word.id}`,
    word: word.word,
    sourceWordId: word.id,
    layer,
    options: shuffle([correct, ...distractors, "不认识"]),
    answer: correct
  };
}

function buildCandidateWordIds(stateOrWordStates, excludedWordIds = []) {
  const userWordStates = stateOrWordStates.userWordStates || stateOrWordStates || {};
  const streakDays = stateOrWordStates.user?.streakDays || 0;
  const excluded = new Set(excludedWordIds);
  const stageOrder = curriculumStageOrderFor(stateOrWordStates);
  const orderedWords = orderWordsByStages(words, stageOrder);
  const reviewWordIds = orderedWords
    .filter((word) => !excluded.has(word.id) && isReviewCandidate(userWordStates[word.id]))
    .map((word, index) => ({
      id: word.id,
      index,
      score: scoreWordRisk(word, userWordStates[word.id], streakDays)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.id)
    .slice(0, MAX_REVIEW_CANDIDATES);

  reviewWordIds.forEach((wordId) => excluded.add(wordId));

  return [
    ...reviewWordIds,
    ...buildCurrentStageNewWordIds(userWordStates, excluded, PRECHECK_WINDOW_SIZE - reviewWordIds.length, stageOrder)
  ].slice(0, PRECHECK_WINDOW_SIZE);
}

function buildCurrentStageNewWordIds(userWordStates, excluded, count, stageOrder = CURRICULUM_STAGE_ORDER) {
  const result = [];
  for (const stage of stageOrder) {
    const stageWords = orderLearnableWordsForStage(words, stage);
    for (const word of stageWords) {
      if (result.length >= count) return result;
      if (excluded.has(word.id) || !isFreshWordCandidate(userWordStates[word.id])) continue;
      result.push(word.id);
      excluded.add(word.id);
    }
    if (result.length > 0 && result.length >= count) return result;
  }
  return result;
}

function orderLearnableWordsForStage(items, stage) {
  return items
    .filter((word) => word.starLevel === stage && isLearnableNewWord(word))
    .map((word) => ({ word, rank: hashText(`${stage}:${word.id}:${word.sourceIndex}`) }))
    .sort((a, b) => a.rank - b.rank || a.word.sourceIndex - b.word.sourceIndex)
    .map((item) => item.word);
}

function orderAssessmentWordsForStage(items, stage, seed) {
  return items
    .filter((word) => word.starLevel === stage && isLearnableNewWord(word))
    .map((word) => ({ word, rank: hashText(`${seed}:${word.id}:${word.sourceIndex}`) }))
    .sort((a, b) => a.rank - b.rank || a.word.sourceIndex - b.word.sourceIndex)
    .map((item) => item.word);
}

function isLearnableNewWord(word) {
  if (!word?.word || word.word.length <= 1) return false;
  if (/^(art\.|conj\.|prep\.|pron\.)/.test(word.pos || "")) return false;
  return true;
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function refillPrecheckCandidateWordIds(state) {
  const visibleWordIds = state.daily.candidateWordIds.filter((wordId) => isVisiblePrecheckCandidate(state, wordId));
  const excluded = uniqueIds([
    ...(state.daily.completedWordIds || []),
    ...(state.daily.sessionCompletedWordIds || []),
    ...visibleWordIds,
    ...Object.keys(state.daily.precheck || {}).filter((wordId) => state.daily.precheck[wordId] === "known")
  ]);

  state.daily.candidateWordIds = uniqueIds([
    ...visibleWordIds,
    ...buildCandidateWordIds(state, excluded)
  ]).slice(0, PRECHECK_WINDOW_SIZE);
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
  state.daily.mixedReviewWordIds = buildSecondLevelReviewWordIds(state);
  state.daily.mixedQuestions = state.daily.mixedReviewWordIds.map((wordId) => createChoiceQuestion(wordId, "mixed-review", "visual"));
  state.daily.mixedIndex = 0;
}

function startNextRound(state) {
  let nextCandidateWordIds = buildCandidateWordIds(
    state,
    state.daily.sessionCompletedWordIds || []
  );
  if (!nextCandidateWordIds.length) {
    state.daily.sessionCompletedWordIds = [];
    nextCandidateWordIds = buildCandidateWordIds(state);
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
  const now = new Date();
  const currentStage = current.reviewStage || 0;
  const stage = nextReviewStage(current);
  const intervalDays = REVIEW_INTERVAL_DAYS[stage - 1] || REVIEW_INTERVAL_DAYS.at(-1);
  const nextReviewAt = new Date(now.getTime() + intervalDays * 86400000).toISOString();
  return {
    reviewStage: stage,
    lastReviewAt: now.toISOString(),
    nextReviewAt,
    reviewFailedThisRound: false,
    roundMasteredAt: now.toISOString(),
    lastResult: "correct",
    correctStreak: current.reviewFailedThisRound && currentStage > 0
      ? Math.max(1, current.correctStreak || 0)
      : current.correctStreak
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
  if (!wordState?.nextReviewAt || !wordState.reviewStage) return false;
  const dueAt = Date.parse(wordState.nextReviewAt);
  return Number.isFinite(dueAt) && dueAt <= Date.now();
}

function daysPast(isoDate) {
  const dueAt = Date.parse(isoDate);
  if (!Number.isFinite(dueAt)) return 0;
  return Math.floor((Date.now() - dueAt) / 86400000);
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
