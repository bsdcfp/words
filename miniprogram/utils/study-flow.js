const { testQuestions } = require("../data/test-questions");
const { words } = require("../data/words");
const { buildAssessmentResult, buildDailyReport } = require("./report");

const REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 15];
const PRECHECK_WINDOW_SIZE = 9;
const MAX_REVIEW_CANDIDATES = 3;
const MICRO_LIST_WORD_COUNT = 3;
const MICRO_LISTS_PER_LIST = 3;
const WORDS_PER_LIST = MICRO_LIST_WORD_COUNT * MICRO_LISTS_PER_LIST;
const LISTS_PER_GROUP = 2;
const CURRICULUM_STAGE_ORDER = [1, 2, 0];
const ASSESSMENT_LAYER_ORDER = ["foundation", "required", "selective"];
const ASSESSMENT_LAYERS = {
  foundation: { starLevel: 0, label: "义务教育基础词" },
  required: { starLevel: 1, label: "高中必修词" },
  selective: { starLevel: 2, label: "选择性必修词" }
};
const ASSESSMENT_TOTAL_QUESTIONS = 36;
const ASSESSMENT_INITIAL_PER_LAYER = 6;

function startAssessment(state, seed = createAssessmentSeed()) {
  state.assessment = {
    completed: false,
    currentIndex: 0,
    seed,
    questions: buildInitialAssessmentQuestions(seed),
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
    state.assessment.questions = state.assessment.questions.concat(buildAdaptiveAssessmentQuestions(state.assessment.answers, state.assessment.questions, state.assessment.seed));
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
  const todaySeenWordIds = todaySeenWordIdsFor(state);
  state.daily.seenWordIds = todaySeenWordIds;
  const candidateWordIds = buildCandidateWordIds(state);
  const dailyTargetListCount = dailyTargetListCountFor(state);
  const dailyTargetWordCount = dailyTargetListCount * WORDS_PER_LIST;
  state.daily = {
    startedAt: new Date().toISOString(),
    selectedWordIds: [],
    groupQueue: [],
    learningWordIds: [],
    skippedWordIds: [],
    dailyTargetListCount,
    dailyTargetWordCount,
    currentListIndex: 0,
    currentMicroListIndex: 0,
    precheckCompleted: false,
    listTargetGroupCount: dailyTargetListCount * MICRO_LISTS_PER_LIST,
    completedGroups: [],
    pendingMixedReviews: [],
    activeMixedReview: null,
    roundIndex: 1,
    batchWordIds: [],
    completedWordIds: [],
    sessionCompletedWordIds: [],
    seenWordIds: todaySeenWordIds,
    mixedReviewWordIds: [],
    candidateWordIds,
    precheck: {},
    studyIndex: 0,
    reviewPhase: "initial",
    groupQuestions: [],
    groupIndex: 0,
    audioQuestions: [],
    audioIndex: 0,
    recallQuestions: [],
    recallIndex: 0,
    mixedQuestions: [],
    mixedIndex: 0,
    groupFeedback: "",
    completed: false
  };
}

function todaySeenWordIdsFor(state) {
  const daily = state && state.daily;
  if (!daily || !daily.startedAt) return [];
  const startedAt = new Date(daily.startedAt);
  if (Number.isNaN(startedAt.getTime())) return [];
  return localDateKey(startedAt) === localDateKey()
    ? uniqueIds(daily.seenWordIds || [])
    : [];
}

function markPrecheck(state, wordId, status) {
  if (!wordId || state.daily.precheckCompleted) return;
  if (status === "known") {
    state.daily.precheck[wordId] = "known";
    state.daily.skippedWordIds = uniqueIds((state.daily.skippedWordIds || []).concat(wordId));
    state.daily.seenWordIds = uniqueIds((state.daily.seenWordIds || []).concat(wordId));
    state.daily.selectedWordIds = state.daily.selectedWordIds.filter((id) => id !== wordId);
    refillPrecheckCandidateWordIds(state);
    return;
  }
  state.daily.precheck[wordId] = "unfamiliar";
  if (!state.daily.learningWordIds.includes(wordId) && state.daily.learningWordIds.length < dailyTargetWordCountFor(state)) {
    state.daily.learningWordIds = state.daily.learningWordIds.concat(wordId);
    state.daily.seenWordIds = uniqueIds((state.daily.seenWordIds || []).concat(wordId));
  }
  if (state.daily.learningWordIds.length >= dailyTargetWordCountFor(state)) {
    state.daily.precheckCompleted = true;
    confirmPrecheck(state);
    return;
  }
  refillPrecheckCandidateWordIds(state);
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
  while (state.daily.learningWordIds.length < dailyTargetWordCountFor(state)) {
    const next = (state.daily.candidateWordIds || []).find((wordId) => state.daily.precheck[wordId] !== "known");
    if (!next) break;
    state.daily.precheck[next] = "unfamiliar";
    state.daily.learningWordIds = uniqueIds(state.daily.learningWordIds.concat(next));
    state.daily.seenWordIds = uniqueIds((state.daily.seenWordIds || []).concat(next));
    refillPrecheckCandidateWordIds(state);
  }
  if (state.daily.learningWordIds.length >= dailyTargetWordCountFor(state)) {
    state.daily.precheckCompleted = true;
  }
}

function confirmPrecheck(state) {
  if (state.daily.learningWordIds.length < dailyTargetWordCountFor(state)) autoSelectPrecheckWords(state);
  state.daily.seenWordIds = uniqueIds((state.daily.seenWordIds || []).concat(state.daily.learningWordIds || []));
  state.daily.precheckCompleted = true;
  prepareCurrentMicroList(state);
}

function prepareCurrentMicroList(state) {
  const microIndex = state.daily.currentMicroListIndex || 0;
  const start = microIndex * MICRO_LIST_WORD_COUNT;
  const firstGroup = (state.daily.learningWordIds || []).slice(start, start + MICRO_LIST_WORD_COUNT);
  if (firstGroup.length < MICRO_LIST_WORD_COUNT) return false;
  state.daily.studyIndex = 0;
  state.daily.groupQueue = [firstGroup];
  state.daily.currentGroupIndex = state.daily.completedGroups ? state.daily.completedGroups.length : 0;
  state.daily.currentListIndex = Math.floor(microIndex / MICRO_LISTS_PER_LIST);
  resetRoundMasteryForWords(state, firstGroup);
  state.daily.batchWordIds = uniqueIds(state.daily.batchWordIds.concat(firstGroup));
  state.daily.seenWordIds = uniqueIds((state.daily.seenWordIds || []).concat(firstGroup));
  state.daily.selectedWordIds = firstGroup;
  state.daily.reviewPhase = "initial";
  state.daily.mixedReviewWordIds = [];
  state.daily.groupQuestions = [];
  state.daily.groupIndex = 0;
  state.daily.audioQuestions = [];
  state.daily.audioIndex = 0;
  state.daily.recallQuestions = [];
  state.daily.recallIndex = 0;
  state.daily.mixedQuestions = [];
  state.daily.mixedIndex = 0;
  state.daily.groupFeedback = "";
  return true;
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
  prepareMeaningRecallQuestions(state);
  state.daily.audioQuestions = [];
  state.daily.audioIndex = 0;
  return "meaning-recall";
}

function prepareMeaningRecallQuestions(state) {
  state.daily.recallQuestions = currentGroupWordIds(state).map((wordId) => createRecallQuestion(wordId, "meaning-word-recall"));
  state.daily.recallIndex = 0;
}

function getCurrentMeaningRecallQuestion(state) {
  return state.daily.recallQuestions[state.daily.recallIndex];
}

function answerMeaningRecallQuestion(state) {
  return answerRecallQuestion(state, getCurrentMeaningRecallQuestion(state), "meaning-word-recall");
}

function missMeaningRecallQuestion(state) {
  return missRecallQuestion(state, getCurrentMeaningRecallQuestion(state), "meaning-word-recall");
}

function moveToNextMeaningRecallQuestion(state) {
  state.daily.recallIndex += 1;
  if (state.daily.recallIndex < state.daily.recallQuestions.length) return "meaning-recall";
  const currentGroup = state.daily.selectedWordIds;
  recordCompletedGroup(state, currentGroup);
  state.daily.selectedWordIds = [];
  state.daily.studyIndex = 0;
  state.daily.recallQuestions = [];
  state.daily.recallIndex = 0;
  state.daily.groupQueue = [];
  if (prepareNextMixedReview(state)) {
    return "mixed-review";
  }
  if (isListNewWordsComplete(state)) {
    state.daily.groupFeedback = "今日目标完成";
    completeCurrentList(state);
    return "daily-report";
  }
  const completedMicroLists = state.daily.completedGroups.length;
  if (completedMicroLists > 0 && completedMicroLists % MICRO_LISTS_PER_LIST === 0) {
    state.daily.groupFeedback = "List 完成，自动进入下一个 List";
  } else {
    state.daily.groupFeedback = "继续下一个 List 片段";
  }
  prepareCurrentMicroList(state);
  return "word-study";
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
  state.daily.activeMixedReview = null;
  state.daily.mixedReviewWordIds = [];
  state.daily.mixedQuestions = [];
  state.daily.mixedIndex = 0;
  if (prepareNextMixedReview(state)) {
    return "mixed-review";
  }
  if (isListNewWordsComplete(state)) {
    completeCurrentList(state);
    return "daily-report";
  }
  state.daily.reviewPhase = "initial";
  const completedMicroLists = state.daily.completedGroups.length;
  state.daily.groupFeedback = completedMicroLists % MICRO_LISTS_PER_LIST === 0
    ? "List 完成，自动进入下一个 List"
    : "混组复习完成，继续学习";
  prepareCurrentMicroList(state);
  return "word-study";
}

function completeCurrentList(state) {
  state.daily.completed = true;
  markDailyCheckin(state);
  if (!state.user.badges.includes("起步徽章")) state.user.badges.push("起步徽章");
  if (state.user.streakDays >= 3 && !state.user.badges.includes("三日连学")) {
    state.user.badges.push("三日连学");
  }
  state.lastReport = buildDailyReport(state, words);
  return true;
}

function recordCompletedGroup(state, wordIds) {
  const group = uniqueIds(wordIds || []);
  if (!group.length) return;
  state.daily.completedGroups = Array.isArray(state.daily.completedGroups) ? state.daily.completedGroups : [];
  state.daily.completedGroups.push(group);
  state.daily.currentMicroListIndex = state.daily.completedGroups.length;
  state.daily.currentListIndex = Math.floor(state.daily.currentMicroListIndex / MICRO_LISTS_PER_LIST);
  state.daily.completedWordIds = uniqueIds(state.daily.completedWordIds.concat(group));
  state.daily.sessionCompletedWordIds = uniqueIds((state.daily.sessionCompletedWordIds || []).concat(group));
  state.daily.batchWordIds = uniqueIds((state.daily.batchWordIds || []).concat(group));
  enqueueMixedReviewsAfterGroup(state);
}

function enqueueMixedReviewsAfterGroup(state) {
  const groups = state.daily.completedGroups || [];
  const groupNumber = groups.length;
  const positionInList = ((groupNumber - 1) % MICRO_LISTS_PER_LIST) + 1;
  const queue = Array.isArray(state.daily.pendingMixedReviews) ? state.daily.pendingMixedReviews : [];
  if (positionInList === 2) {
    queue.push(createMixedReviewTask([
      createGroupReviewEntry(groups, groupNumber - 1),
      createGroupReviewEntry(groups, groupNumber)
    ]));
  }
  if (positionInList === 3) {
    queue.push(createMixedReviewTask([
      createGroupReviewEntry(groups, groupNumber - 2),
      createGroupReviewEntry(groups, groupNumber - 1),
      createGroupReviewEntry(groups, groupNumber)
    ]));
    const listNumber = Math.floor(groupNumber / MICRO_LISTS_PER_LIST);
    if (listNumber % LISTS_PER_GROUP === 0) {
      queue.push(createMixedReviewTask([
        createGroupReviewEntry(groups, groupNumber - 5),
        createGroupReviewEntry(groups, groupNumber - 4),
        createGroupReviewEntry(groups, groupNumber - 3),
        createGroupReviewEntry(groups, groupNumber - 2),
        createGroupReviewEntry(groups, groupNumber - 1),
        createGroupReviewEntry(groups, groupNumber)
      ]));
    }
  }
  state.daily.pendingMixedReviews = queue;
}

function createGroupReviewEntry(groups, groupNumber) {
  return {
    groupNumber,
    wordIds: groups[groupNumber - 1] || []
  };
}

function createMixedReviewTask(groupList) {
  const groupNumbers = groupList.map((group) => group.groupNumber).filter(Boolean);
  const groupLabel = formatGroupNumbers(groupNumbers);
  return {
    label: `${groupLabel} 混组复习`,
    groupLabel,
    groupNumbers,
    wordIds: uniqueIds([].concat.apply([], groupList.map((group) => group.wordIds || [])))
  };
}

function formatGroupNumbers(groupNumbers) {
  if (groupNumbers.length === 6) {
    return `List ${Math.ceil(groupNumbers[0] / MICRO_LISTS_PER_LIST)} + List ${Math.ceil(groupNumbers[5] / MICRO_LISTS_PER_LIST)}`;
  }
  if (groupNumbers.length === 3) {
    return `List ${Math.ceil(groupNumbers[0] / MICRO_LISTS_PER_LIST)} 内复习`;
  }
  return groupNumbers.map((number) => `片段 ${number}`).join(" + ");
}

function prepareNextMixedReview(state) {
  const queue = Array.isArray(state.daily.pendingMixedReviews) ? state.daily.pendingMixedReviews : [];
  const nextTask = queue.shift();
  if (!nextTask) return false;
  state.daily.pendingMixedReviews = queue;
  state.daily.activeMixedReview = nextTask;
  state.daily.reviewPhase = "mixed";
  state.daily.mixedReviewWordIds = uniqueIds(nextTask.wordIds || []);
  state.daily.mixedQuestions = state.daily.mixedReviewWordIds.map((wordId) => createChoiceQuestion(wordId, "mixed-review", "visual"));
  state.daily.mixedIndex = 0;
  state.daily.groupFeedback = nextTask.label;
  return true;
}

function isListNewWordsComplete(state) {
  return (state.daily.completedGroups || []).length >= dailyTargetMicroListCountFor(state);
}

function listTargetGroupCountFor(state) {
  return dailyTargetMicroListCountFor(state);
}

function dailyTargetListCountFor(state) {
  const configured = Number(state.user?.settings?.dailyTargetListCount || state.daily?.dailyTargetListCount || 1);
  if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);
  const legacyGroups = Number(state.user?.settings?.listGroupCount || 0);
  return legacyGroups > 0 ? Math.max(1, Math.round(legacyGroups / MICRO_LISTS_PER_LIST)) : 1;
}

function dailyTargetMicroListCountFor(state) {
  return dailyTargetListCountFor(state) * MICRO_LISTS_PER_LIST;
}

function dailyTargetWordCountFor(state) {
  return dailyTargetListCountFor(state) * WORDS_PER_LIST;
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

function calculateCurrentStreak(checkins, fromDate) {
  let cursor = startOfLocalDay(fromDate || new Date());
  let streak = 0;
  while (checkins[localDateKey(cursor)] && checkins[localDateKey(cursor)].completed) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function calculateLongestStreak(checkins) {
  const days = Object.keys(checkins || {})
    .filter((dateKey) => checkins[dateKey] && checkins[dateKey].completed)
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

function localDateKey(date) {
  const value = date || new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(dateKey) {
  const parts = dateKey.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(left, right) {
  return Math.round((startOfLocalDay(right).getTime() - startOfLocalDay(left).getTime()) / 86400000);
}

function getWordById(id) {
  return words.find((word) => word.id === id);
}

function getAllWords() {
  return words;
}

function buildCandidateWordIds(stateOrWordStates, excludedWordIds = []) {
  const userWordStates = stateOrWordStates.userWordStates || stateOrWordStates || {};
  const excluded = {};
  (stateOrWordStates.daily?.seenWordIds || []).forEach((id) => { excluded[id] = true; });
  (stateOrWordStates.daily?.learningWordIds || []).forEach((id) => { excluded[id] = true; });
  (stateOrWordStates.daily?.skippedWordIds || []).forEach((id) => { excluded[id] = true; });
  excludedWordIds.forEach((id) => { excluded[id] = true; });
  const stageOrder = curriculumStageOrderFor(stateOrWordStates);
  return buildCurrentStageNewWordIds(userWordStates, excluded, PRECHECK_WINDOW_SIZE, stageOrder)
    .slice(0, PRECHECK_WINDOW_SIZE);
}

function buildCurrentStageNewWordIds(userWordStates, excluded, count, stageOrder) {
  const result = [];
  const stages = stageOrder || CURRICULUM_STAGE_ORDER;
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex];
    const stageWords = orderLearnableWordsForStage(words, stage);
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
    .concat(state.daily.learningWordIds || [])
    .concat(state.daily.skippedWordIds || [])
    .concat(state.daily.seenWordIds || [])
    .concat(visibleWordIds)
    .concat(Object.keys(state.daily.precheck || {}).filter((wordId) => state.daily.precheck[wordId] === "known")));

  state.daily.candidateWordIds = uniqueIds(visibleWordIds.concat(buildCandidateWordIds(state, excluded))).slice(0, PRECHECK_WINDOW_SIZE);
}

function isVisiblePrecheckCandidate(state, wordId) {
  return Boolean(
    wordId &&
    !state.daily.completedWordIds.includes(wordId) &&
    !(state.daily.seenWordIds || []).includes(wordId) &&
    !state.daily.precheck[wordId]
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
  state.daily.seenWordIds = [];
  state.daily.mixedReviewWordIds = [];
  state.daily.candidateWordIds = nextCandidateWordIds;
  state.daily.precheck = {};
  state.daily.studyIndex = 0;
  state.daily.reviewPhase = "initial";
  state.daily.groupQuestions = [];
  state.daily.groupIndex = 0;
  state.daily.audioQuestions = [];
  state.daily.audioIndex = 0;
  state.daily.recallQuestions = [];
  state.daily.recallIndex = 0;
  state.daily.mixedQuestions = [];
  state.daily.mixedIndex = 0;
  state.daily.groupFeedback = `上一轮完成，开始第 ${state.daily.roundIndex} 轮选词`;
  state.daily.completed = false;
  return true;
}

function createChoiceQuestion(wordId, type, mode) {
  const word = getWordById(wordId);
  const correct = word.cn.join("，");
  return { wordId, type, mode: mode || "visual", options: [correct], answered: false, selected: null, isCorrect: null };
}

function createRecallQuestion(wordId, type) {
  return { wordId, type, mode: "meaning-to-word", answered: false, selected: null, isCorrect: null };
}

function answerRecallQuestion(state, question, type) {
  const word = getWordById(question.wordId);
  const current = state.userWordStates[word.id] || defaultWordState();
  const answeredState = Object.assign({}, current, {
    familiarity: Math.min(current.familiarity + 1, 5),
    correctStreak: current.correctStreak + 1,
    lastSeenAt: new Date().toISOString(),
    lastResult: "correct"
  }, masteryPatch(current, type, question.mode, true));
  state.userWordStates[word.id] = Object.assign({}, answeredState, roundMasterySchedulePatch(answeredState));
  state.answerRecords.push({
    id: `answer_${Date.now()}_${state.answerRecords.length}`,
    sessionId: state.daily.startedAt,
    type,
    wordId: word.id,
    selected: word.word,
    answer: word.word,
    isCorrect: true,
    createdAt: new Date().toISOString()
  });
  question.answered = true;
  question.selected = word.word;
  question.isCorrect = true;
  return { isCorrect: true, word };
}

function missRecallQuestion(state, question, type) {
  const word = getWordById(question.wordId);
  const current = state.userWordStates[word.id] || defaultWordState();
  state.userWordStates[word.id] = Object.assign({}, current, {
    familiarity: Math.max(current.familiarity - 1, 0),
    correctStreak: 0,
    wrongCount: current.wrongCount + 1,
    lastSeenAt: new Date().toISOString(),
    lastResult: "wrong"
  }, masteryPatch(current, type, question.mode, false));
  state.answerRecords.push({
    id: `answer_${Date.now()}_${state.answerRecords.length}`,
    sessionId: state.daily.startedAt,
    type,
    wordId: word.id,
    selected: "__missed__",
    answer: word.word,
    isCorrect: false,
    createdAt: new Date().toISOString()
  });
  question.answered = true;
  question.selected = "__missed__";
  question.isCorrect = false;
  return { isCorrect: false, word };
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
  return { roundMasteredAt: wordState.roundMasteredAt || new Date().toISOString() };
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
  return stageOrder.reduce((result, stage) => result.concat(orderLearnableWordsForStage(items, stage)), []);
}

function createAssessmentSeed() {
  return `${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function buildInitialAssessmentQuestions(seed) {
  const usedWordIds = {};
  return ASSESSMENT_LAYER_ORDER.reduce((result, layer) => result.concat(buildAssessmentQuestionsForLayer(layer, ASSESSMENT_INITIAL_PER_LAYER, usedWordIds, seed)), []);
}

function buildAdaptiveAssessmentQuestions(answers, existingQuestions, seed) {
  const usedWordIds = {};
  existingQuestions.forEach((question) => { usedWordIds[question.sourceWordId] = true; });
  const layerCorrect = ASSESSMENT_LAYER_ORDER.map((layer) => ({
    layer,
    correct: answers.filter((answer) => answer.layer === layer && answer.isCorrect).length
  }));
  const criticalLayers = layerCorrect.filter((item) => item.correct === 3 || item.correct === 4).map((item) => item.layer);
  if (criticalLayers.length === 1) {
    return buildAssessmentQuestionsForLayer(criticalLayers[0], 18, usedWordIds, seed);
  }
  if (criticalLayers.length > 1) {
    return buildAssessmentQuestionsForLayer(criticalLayers[0], 12, usedWordIds, seed)
      .concat(buildAssessmentQuestionsForLayer(criticalLayers[1], 6, usedWordIds, seed));
  }

  const foundation = layerCorrect.find((item) => item.layer === "foundation");
  if ((foundation && foundation.correct ? foundation.correct : 0) <= 2) {
    return buildAssessmentQuestionsForLayer("foundation", 18, usedWordIds, seed);
  }

  let highestPassedIndex = -1;
  for (let index = 0; index < layerCorrect.length; index += 1) {
    if (layerCorrect[index].correct >= 5) highestPassedIndex = index;
  }
  if (highestPassedIndex >= 0 && highestPassedIndex < ASSESSMENT_LAYER_ORDER.length - 1) {
    return buildAssessmentQuestionsForLayer(ASSESSMENT_LAYER_ORDER[highestPassedIndex], 12, usedWordIds, seed)
      .concat(buildAssessmentQuestionsForLayer(ASSESSMENT_LAYER_ORDER[highestPassedIndex + 1], 6, usedWordIds, seed));
  }

  return buildAssessmentQuestionsForLayer("selective", 18, usedWordIds, seed);
}

function buildAssessmentQuestionsForLayer(layer, count, usedWordIds, seed) {
  const layerConfig = ASSESSMENT_LAYERS[layer];
  const layerWords = orderAssessmentWordsForStage(words, layerConfig.starLevel, `${seed}:${layer}`)
    .filter((word) => !usedWordIds[word.id]);
  return layerWords.slice(0, count).map((word, index) => {
    usedWordIds[word.id] = true;
    return createAssessmentQuestion(word, layer, index);
  });
}

function createAssessmentQuestion(word, layer, index) {
  const correct = word.cn.join("，");
  return {
    id: `vocab_${layer}_${word.id}`,
    word: word.word,
    sourceWordId: word.id,
    layer,
    options: [correct, "不认识"],
    answer: correct
  };
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
  if (!word || !word.word || word.word.length <= 1) return false;
  if (/^(art\.|conj\.|prep\.|pron\.)/.test(word.pos || "")) return false;
  return true;
}

function isSameLemma(left, right) {
  const leftLemma = left && (left.lemma || left.headword || left.word);
  const rightLemma = right && (right.lemma || right.headword || right.word);
  return Boolean(leftLemma && rightLemma && leftLemma === rightLemma);
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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
  answerMeaningRecallQuestion,
  missMeaningRecallQuestion,
  answerMixedReviewQuestion,
  autoSelectPrecheckWords,
  completeMixedReview,
  confirmPrecheck,
  getCurrentAudioQuestion,
  getCurrentGroupReviewQuestion,
  getCurrentMeaningRecallQuestion,
  getCurrentMixedReviewQuestion,
  getCurrentStudyWord,
  getCurrentTestQuestion,
  getAllWords,
  getWordById,
  markPrecheck,
  markStudyWord,
  moveToNextAudioQuestion,
  moveToNextGroupReviewQuestion,
  moveToNextMeaningRecallQuestion,
  moveToNextMixedReviewQuestion,
  prepareGroupReviewQuestions,
  prepareAudioQuestions,
  prepareMeaningRecallQuestions,
  refillPrecheckCandidateWordIds,
  startAssessment,
  startDailyLearning,
  togglePrecheckWord
};
