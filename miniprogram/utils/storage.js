const STORAGE_KEY = "word-prototype-state-v1";

const defaultState = {
  user: {
    id: "demo_student",
    name: "体验学生",
    level: "高二",
    levelId: "senior_2",
    levelLabel: "高二",
    learningStartLevel: "required",
    learningStartLevelLabel: "高中必修词",
    activeGroup: "高考课标词",
    streakDays: 0,
    longestStreak: 0,
    checkins: {},
    badges: [],
    vocabularyAssessment: null
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
    roundIndex: 1,
    batchWordIds: [],
    completedWordIds: [],
    sessionCompletedWordIds: [],
    mixedReviewWordIds: [],
    candidateWordIds: [],
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
    "batchWordIds",
    "completedWordIds",
    "sessionCompletedWordIds",
    "mixedReviewWordIds",
    "candidateWordIds",
    "groupQuestions",
    "audioQuestions",
    "mixedQuestions"
  ]);
  if (!state.daily.precheck || typeof state.daily.precheck !== "object") state.daily.precheck = {};
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
