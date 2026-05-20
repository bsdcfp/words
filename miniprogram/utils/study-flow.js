const { testQuestions } = require("../data/test-questions");
const { words } = require("../data/words");
const { buildAssessmentResult, buildDailyReport } = require("./report");

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

function startAssessment(state) {
  state.assessment = {
    completed: false,
    currentIndex: 0,
    questions: buildInitialAssessmentQuestions(),
    answers: [],
    result: null
  };
}

function getCurrentTestQuestion(state) {
  const questions = state.assessment.questions && state.assessment.questions.length ? state.assessment.questions : testQuestions;
  return questions[state.assessment.currentIndex];
}

function answerAssessmentQuestion(state, selected) {
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
    state.assessment.questions = state.assessment.questions.concat(buildAdaptiveAssessmentQuestions(state.assessment.answers, state.assessment.questions));
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
  const stageOrder = curriculumStageOrderFor(stateOrWordStates);
  const reviewWordIds = orderWordsByStages(words, stageOrder)
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
    .concat(buildCurrentStageNewWordIds(userWordStates, excluded, PRECHECK_WINDOW_SIZE - reviewWordIds.length, stageOrder))
    .slice(0, PRECHECK_WINDOW_SIZE);
}

function buildCurrentStageNewWordIds(userWordStates, excluded, count, stageOrder) {
  const result = [];
  const stages = stageOrder || CURRICULUM_STAGE_ORDER;
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex];
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

function curriculumStageOrderFor(stateOrWordStates) {
  const user = stateOrWordStates.user || {};
  const startLevel = user.learningStartLevel || (user.vocabularyAssessment && user.vocabularyAssessment.startLevel);
  if (startLevel === "foundation") return [0, 1, 2];
  if (startLevel === "selective") return [2, 1, 0];
  return CURRICULUM_STAGE_ORDER;
}

function orderWordsByStages(items, stageOrder) {
  return stageOrder.reduce((result, stage) => result.concat(items.filter((word) => word.starLevel === stage)), []);
}

function buildInitialAssessmentQuestions() {
  return ASSESSMENT_LAYER_ORDER.reduce((result, layer) => result.concat(buildAssessmentQuestionsForLayer(layer, ASSESSMENT_INITIAL_PER_LAYER, {})), []);
}

function buildAdaptiveAssessmentQuestions(answers, existingQuestions) {
  const usedWordIds = {};
  existingQuestions.forEach((question) => { usedWordIds[question.sourceWordId] = true; });
  const layerCorrect = ASSESSMENT_LAYER_ORDER.map((layer) => ({
    layer,
    correct: answers.filter((answer) => answer.layer === layer && answer.isCorrect).length
  }));
  const criticalLayers = layerCorrect.filter((item) => item.correct === 3 || item.correct === 4).map((item) => item.layer);
  if (criticalLayers.length === 1) {
    return buildAssessmentQuestionsForLayer(criticalLayers[0], 18, usedWordIds);
  }
  if (criticalLayers.length > 1) {
    return buildAssessmentQuestionsForLayer(criticalLayers[0], 12, usedWordIds)
      .concat(buildAssessmentQuestionsForLayer(criticalLayers[1], 6, usedWordIds));
  }

  const foundation = layerCorrect.find((item) => item.layer === "foundation");
  if ((foundation && foundation.correct ? foundation.correct : 0) <= 2) {
    return buildAssessmentQuestionsForLayer("foundation", 18, usedWordIds);
  }

  let highestPassedIndex = -1;
  for (let index = 0; index < layerCorrect.length; index += 1) {
    if (layerCorrect[index].correct >= 5) highestPassedIndex = index;
  }
  if (highestPassedIndex >= 0 && highestPassedIndex < ASSESSMENT_LAYER_ORDER.length - 1) {
    return buildAssessmentQuestionsForLayer(ASSESSMENT_LAYER_ORDER[highestPassedIndex], 12, usedWordIds)
      .concat(buildAssessmentQuestionsForLayer(ASSESSMENT_LAYER_ORDER[highestPassedIndex + 1], 6, usedWordIds));
  }

  return buildAssessmentQuestionsForLayer("selective", 18, usedWordIds);
}

function buildAssessmentQuestionsForLayer(layer, count, usedWordIds) {
  const layerConfig = ASSESSMENT_LAYERS[layer];
  const layerWords = words.filter((word) => word.starLevel === layerConfig.starLevel && !usedWordIds[word.id]);
  return layerWords.slice(0, count).map((word, index) => {
    usedWordIds[word.id] = true;
    return createAssessmentQuestion(word, layer, index);
  });
}

function createAssessmentQuestion(word, layer, index) {
  const correct = word.cn.join("，");
  const allDistractors = words
    .filter((item) => item.id !== word.id && item.cn.join("，") !== correct)
    .map((item) => item.cn.join("，"));
  const start = (word.sourceIndex + index) % Math.max(1, allDistractors.length - 2);
  const distractors = allDistractors.slice(start, start + 2);
  return {
    id: `vocab_${layer}_${word.id}`,
    word: word.word,
    sourceWordId: word.id,
    layer,
    options: shuffle([correct].concat(distractors).concat("不认识")),
    answer: correct
  };
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
