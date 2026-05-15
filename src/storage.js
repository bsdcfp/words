const STORAGE_KEY = "word-prototype-state-v2";

export const defaultState = {
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
    currentGroupIndex: 0,
    roundIndex: 1,
    batchWordIds: [],
    completedWordIds: [],
    sessionCompletedWordIds: [],
    mixedReviewWordIds: [],
    candidateWordIds: [],
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
  },
  userWordStates: {},
  answerRecords: [],
  lastReport: null
};

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);
  try {
    return mergeState(structuredClone(defaultState), JSON.parse(raw));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return structuredClone(defaultState);
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return structuredClone(defaultState);
}

function mergeState(base, patch) {
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && base[key]) {
      base[key] = mergeState(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}
