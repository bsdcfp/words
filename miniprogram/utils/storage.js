const STORAGE_KEY = "word-prototype-state-v1";

const defaultState = {
  user: {
    id: "demo_student",
    name: "体验学生",
    level: "高二",
    activeGroup: "高考课标词",
    streakDays: 0,
    longestStreak: 0,
    badges: []
  },
  assessment: {
    completed: false,
    currentIndex: 0,
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
  if (!raw) return clone(defaultState);
  try {
    return mergeState(clone(defaultState), JSON.parse(raw));
  } catch (error) {
    wx.removeStorageSync(STORAGE_KEY);
    return clone(defaultState);
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

module.exports = {
  defaultState,
  loadState,
  resetState,
  saveState
};
