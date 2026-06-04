const STORAGE_KEY = "word-prototype-state-v1";

const defaultState = {
  user: {
    id: "demo_student",
    name: "体验学生",
    level: "",
    levelId: "",
    levelLabel: "",
    wordLevelId: "",
    wordLevelLabel: "",
    learningStartLevel: "",
    learningStartLevelLabel: "",
    activeGroup: "高考 3500 词",
    streakDays: 0,
    longestStreak: 0,
    checkins: {},
    badges: [],
    vocabularyAssessment: null,
    settings: {
      listGroupCount: 15,
      dailyTargetListCount: 1,
      pronunciationLoopCount: 3,
      learningTheme: "light",
      themeDefaultVersion: 2,
      sleepTime: "22:00",
      wakeTime: "06:00",
      wrongReminderEnabled: true,
      wrongReminderTime: "19:00"
    }
  },
  assessment: {
    completed: false,
    currentIndex: 0,
    questions: [],
    answers: [],
    result: null
  },
  daily: {
    startedAt: null,
    selectedWordIds: [],
    groupQueue: [],
    learningWordIds: [],
    skippedWordIds: [],
    dailyTargetListCount: 1,
    dailyTargetWordCount: 9,
    currentListIndex: 0,
    currentMicroListIndex: 0,
    precheckCompleted: false,
    listTargetGroupCount: 15,
    completedGroups: [],
    pendingMixedReviews: [],
    activeMixedReview: null,
    roundIndex: 1,
    batchWordIds: [],
    completedWordIds: [],
    sessionCompletedWordIds: [],
    seenWordIds: [],
    mixedReviewWordIds: [],
    candidateWordIds: [],
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
  },
  userWordStates: {},
  answerRecords: [],
  lastReport: null
};

function loadState() {
  const raw = wx.getStorageSync(STORAGE_KEY);
  if (!raw) return normaliseState(clone(defaultState));
  try {
    return normaliseState(mergeState(clone(defaultState), JSON.parse(raw)));
  } catch (error) {
    wx.removeStorageSync(STORAGE_KEY);
    return normaliseState(clone(defaultState));
  }
}

function saveState(state) {
  wx.setStorageSync(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  wx.removeStorageSync(STORAGE_KEY);
  return clone(defaultState);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeState(base, patch) {
  Object.keys(patch || {}).forEach((key) => {
    const value = patch[key];
    if (value && typeof value === "object" && !Array.isArray(value) && base[key]) {
      base[key] = mergeState(base[key], value);
    } else {
      base[key] = value;
    }
  });
  return base;
}

function normaliseState(state) {
  if (!state || typeof state !== "object") return clone(defaultState);
  if (!state.user || typeof state.user !== "object") state.user = clone(defaultState.user);
  if (!state.assessment || typeof state.assessment !== "object") state.assessment = clone(defaultState.assessment);
  if (!state.daily || typeof state.daily !== "object") state.daily = clone(defaultState.daily);
  if (!state.userWordStates || typeof state.userWordStates !== "object") state.userWordStates = {};
  if (!Array.isArray(state.answerRecords)) state.answerRecords = [];
  if (!Array.isArray(state.user.badges)) state.user.badges = [];
  if (!state.user.checkins || typeof state.user.checkins !== "object" || Array.isArray(state.user.checkins)) state.user.checkins = {};
  ensureArrayFields(state.assessment, ["answers", "questions"]);
  ensureArrayFields(state.daily, [
    "selectedWordIds",
    "groupQueue",
    "learningWordIds",
    "skippedWordIds",
    "completedGroups",
    "pendingMixedReviews",
    "batchWordIds",
    "completedWordIds",
    "sessionCompletedWordIds",
    "seenWordIds",
    "mixedReviewWordIds",
    "candidateWordIds",
    "groupQuestions",
    "audioQuestions",
    "recallQuestions",
    "mixedQuestions"
  ]);
  if (!state.daily.precheck || typeof state.daily.precheck !== "object") state.daily.precheck = {};
  if (!state.user.settings || typeof state.user.settings !== "object") state.user.settings = clone(defaultState.user.settings);
  if (state.user.settings.themeDefaultVersion !== 2) {
    state.user.settings.learningTheme = "light";
    state.user.settings.themeDefaultVersion = 2;
  }
  if (!state.user.settings.dailyTargetListCount) {
    const legacyGroups = Number(state.user.settings.listGroupCount || 0);
    state.user.settings.dailyTargetListCount = legacyGroups >= 6 ? Math.max(1, Math.round(legacyGroups / 3)) : 1;
  }
  if (!state.daily.dailyTargetListCount) state.daily.dailyTargetListCount = state.user.settings.dailyTargetListCount || 1;
  if (!state.daily.dailyTargetWordCount) state.daily.dailyTargetWordCount = state.daily.dailyTargetListCount * 9;
  if (typeof state.daily.currentListIndex !== "number") state.daily.currentListIndex = 0;
  if (typeof state.daily.currentMicroListIndex !== "number") state.daily.currentMicroListIndex = state.daily.completedGroups.length;
  if (typeof state.daily.precheckCompleted !== "boolean") state.daily.precheckCompleted = false;
  return mergeState(clone(defaultState), state);
}

function ensureArrayFields(target, fields) {
  fields.forEach((field) => {
    if (!Array.isArray(target[field])) target[field] = [];
  });
}

module.exports = {
  defaultState,
  loadState,
  resetState,
  saveState
};
