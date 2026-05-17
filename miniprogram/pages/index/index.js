const { wordDatasetMeta } = require("../../data/words");
const { testQuestions } = require("../../data/test-questions");
const { buildDailyReport, getRewardStreakText } = require("../../utils/report");
const { loadState, resetState, saveState } = require("../../utils/storage");
const flow = require("../../utils/study-flow");

const VIEWS = {
  HOME: "home",
  TEST: "test",
  TEST_RESULT: "test-result",
  PRECHECK: "precheck",
  WORD_STUDY: "word-study",
  GROUP_REVIEW: "group-review",
  AUDIO_MEANING: "audio-meaning",
  WRONG_BOOK: "wrong-book",
  DAILY_REPORT: "daily-report"
};

Page({
  data: {
    view: VIEWS.HOME,
    state: null,
    home: {},
    test: {},
    testResult: {},
    precheck: {},
    study: {},
    review: {},
    audio: {},
    wrongBook: {},
    report: {},
    detail: null
  },

  onLoad() {
    this.state = loadState();
    this.render(VIEWS.HOME);
  },

  startTest() {
    flow.startAssessment(this.state);
    this.saveAndRender(VIEWS.TEST);
  },

  answerTest(event) {
    flow.answerAssessmentQuestion(this.state, event.currentTarget.dataset.value);
    this.saveAndRender(this.state.assessment.completed ? VIEWS.TEST_RESULT : VIEWS.TEST);
  },

  startDailyLearning() {
    flow.startDailyLearning(this.state);
    this.saveAndRender(VIEWS.PRECHECK);
  },

  markPrecheck(event) {
    const { wordId, value } = event.currentTarget.dataset;
    flow.markPrecheck(this.state, wordId, value);
    if (value === "unfamiliar" && this.state.daily.selectedWordIds.length === 3) {
      flow.confirmPrecheck(this.state);
      this.saveAndRender(VIEWS.WORD_STUDY);
      return;
    }
    this.saveAndRender(VIEWS.PRECHECK);
  },

  togglePrecheckWord(event) {
    flow.togglePrecheckWord(this.state, event.currentTarget.dataset.wordId);
    this.saveAndRender(VIEWS.PRECHECK);
  },

  autoSelect() {
    flow.autoSelectPrecheckWords(this.state);
    this.saveAndRender(VIEWS.PRECHECK);
  },

  confirmPrecheck() {
    flow.confirmPrecheck(this.state);
    this.saveAndRender(VIEWS.WORD_STUDY);
  },

  markStudy(event) {
    flow.markStudyWord(this.state, Number(event.currentTarget.dataset.value));
    this.saveAndRender(VIEWS.WORD_STUDY);
  },

  startReview() {
    this.saveAndRender(VIEWS.GROUP_REVIEW);
  },

  finishReview() {
    flow.prepareAudioQuestions(this.state);
    this.saveAndRender(VIEWS.AUDIO_MEANING);
  },

  answerAudio(event) {
    const result = flow.answerAudioQuestion(this.state, event.currentTarget.dataset.value);
    if (!result.isCorrect) {
      this.openDetailById(result.word.id);
    }
    this.saveAndRender(VIEWS.AUDIO_MEANING);
  },

  nextAudio() {
    const phase = flow.moveToNextAudioQuestion(this.state);
    this.saveAndRender(phase === "next-selection" ? VIEWS.PRECHECK : phase === "mixed-review" ? VIEWS.GROUP_REVIEW : VIEWS.AUDIO_MEANING);
  },

  answerMixed(event) {
    flow.answerMixedReviewQuestion(this.state, event.currentTarget.dataset.value);
    this.saveAndRender(VIEWS.GROUP_REVIEW);
  },

  nextMixed() {
    const phase = flow.moveToNextMixedReviewQuestion(this.state);
    if (phase === "complete") {
      const next = flow.completeMixedReview(this.state);
      this.saveAndRender(next === "daily-report" ? VIEWS.DAILY_REPORT : VIEWS.PRECHECK);
      return;
    }
    this.saveAndRender(VIEWS.GROUP_REVIEW);
  },

  finishMixedReview() {
    const next = flow.completeMixedReview(this.state);
    this.saveAndRender(next === "daily-report" ? VIEWS.DAILY_REPORT : VIEWS.PRECHECK);
  },

  speak(event) {
    const word = flow.getWordById(event.currentTarget.dataset.wordId);
    if (!word) return;
    const audio = wx.createInnerAudioContext();
    audio.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word.word)}&type=2`;
    audio.obeyMuteSwitch = false;
    audio.play();
  },

  openDetail(event) {
    this.openDetailById(event.currentTarget.dataset.wordId);
  },

  closeDetail() {
    this.setData({ detail: null });
  },

  noop() {},

  goHome() {
    this.saveAndRender(VIEWS.HOME);
  },

  openWrongBook() {
    this.saveAndRender(VIEWS.WRONG_BOOK);
  },

  resetData() {
    this.state = resetState();
    this.saveAndRender(VIEWS.HOME);
  },

  saveAndRender(view) {
    saveState(this.state);
    this.render(view);
  },

  render(view) {
    const state = this.state;
    const patch = { view, state };
    if (view === VIEWS.HOME) patch.home = buildHomeData(state);
    if (view === VIEWS.TEST) patch.test = buildTestData(state);
    if (view === VIEWS.TEST_RESULT) patch.testResult = state.assessment.result || {};
    if (view === VIEWS.PRECHECK) patch.precheck = buildPrecheckData(state);
    if (view === VIEWS.WORD_STUDY) patch.study = buildStudyData(state);
    if (view === VIEWS.GROUP_REVIEW) patch.review = buildReviewData(state);
    if (view === VIEWS.AUDIO_MEANING) patch.audio = buildAudioData(state);
    if (view === VIEWS.WRONG_BOOK) patch.wrongBook = buildWrongBookData(state);
    if (view === VIEWS.DAILY_REPORT) patch.report = buildReportData(state);
    this.setData(patch);
  },

  openDetailById(wordId) {
    const word = flow.getWordById(wordId);
    if (!word) return;
    this.setData({
      detail: {
        ...word,
        meaningText: word.cn.join("，"),
        tagText: word.tags.join("、"),
        collocationText: word.collocations.length ? word.collocations.map((item) => `${item.en}：${item.cn}`).join("\n") : "例句和搭配待自建"
      }
    });
  }
});

function buildHomeData(state) {
  const result = state.assessment.result;
  const weakCount = Object.values(state.userWordStates).filter((wordState) => wordState.wrongCount > 0).length;
  const learnedCount = Object.values(state.userWordStates).filter((wordState) => wordState.familiarity > 0).length;
  return {
    userName: state.user.name,
    vocabulary: result ? result.vocabulary : "未测",
    testLabel: result ? `${result.stage} · ${result.accuracy}%` : "独立诊断入口",
    learnedCount,
    weakCount,
    streakDays: state.user.streakDays,
    streakText: getRewardStreakText(state),
    badges: state.user.badges.length ? state.user.badges.join("、") : "今日完成后获得起步徽章",
    groupName: wordDatasetMeta.groupName,
    total: wordDatasetMeta.total,
    miniProgramTotal: wordDatasetMeta.miniProgramTotal,
    dictionary: wordDatasetMeta.dictionary.source
  };
}

function buildTestData(state) {
  const question = flow.getCurrentTestQuestion(state);
  const answered = state.assessment.answers.length;
  const correct = state.assessment.answers.filter((answer) => answer.isCorrect).length;
  return {
    question,
    progress: `${answered + 1}/${testQuestions.length}`,
    correct,
    wrong: answered - correct,
    remain: testQuestions.length - answered,
    options: question ? question.options.filter((option) => option !== "不认识") : []
  };
}

function buildPrecheckData(state) {
  const selectedIds = state.daily.selectedWordIds;
  const candidates = state.daily.candidateWordIds
    .map(flow.getWordById)
    .filter((word) => word && !state.daily.completedWordIds.includes(word.id) && state.daily.precheck[word.id] !== "known")
    .map((word, index) => ({
      ...word,
      index: index + 1,
      selected: selectedIds.includes(word.id),
      status: state.daily.precheck[word.id] || "",
      meaningText: word.cn.join("，")
    }));
  return {
    candidates,
    selectedCount: selectedIds.length,
    groupFeedback: state.daily.groupFeedback,
    canStart: selectedIds.length === 3
  };
}

function buildStudyData(state) {
  const word = flow.getCurrentStudyWord(state);
  return {
    word: word ? decorateWord(word) : null,
    progress: `${state.daily.studyIndex + 1}/${state.daily.selectedWordIds.length || 3}`
  };
}

function buildReviewData(state) {
  const isMixed = state.daily.reviewPhase === "mixed";
  if (isMixed) {
    const question = flow.getCurrentMixedReviewQuestion(state);
    const word = question ? flow.getWordById(question.wordId) : null;
    return {
      isMixed: true,
      question: decorateQuestion(question, word),
      word: word ? decorateWord(word) : null,
      count: state.daily.mixedReviewWordIds.length,
      progress: question ? `${state.daily.mixedIndex + 1}/${state.daily.mixedQuestions.length}` : ""
    };
  }
  const words = state.daily.selectedWordIds.map(flow.getWordById).filter(Boolean).map(decorateWord);
  return { isMixed: false, words, count: words.length };
}

function buildAudioData(state) {
  const question = flow.getCurrentAudioQuestion(state);
  const word = question ? flow.getWordById(question.wordId) : null;
  return {
    question: decorateQuestion(question, word),
    word: word ? decorateWord(word) : null,
    progress: question ? `${state.daily.audioIndex + 1}/${state.daily.audioQuestions.length}` : ""
  };
}

function buildWrongBookData(state) {
  const words = Object.entries(state.userWordStates)
    .filter(([, wordState]) => wordState.wrongCount > 0)
    .map(([wordId, wordState]) => ({ word: flow.getWordById(wordId), wordState }))
    .filter((item) => item.word)
    .sort((a, b) => b.wordState.wrongCount - a.wordState.wrongCount)
    .map((item) => ({ ...decorateWord(item.word), wrongCount: item.wordState.wrongCount }));
  return { words, count: words.length };
}

function buildReportData(state) {
  const report = state.lastReport || buildDailyReport(state, require("../../data/words").words);
  return {
    ...report,
    weakWordText: report.weakWords.length ? report.weakWords.map((word) => word.word).join("、") : "本轮没有新增错词",
    badgeText: state.user.badges.length ? state.user.badges.join("、") : "暂无"
  };
}

function decorateWord(word) {
  return {
    ...word,
    meaningText: word.cn.join("，"),
    tagText: word.tags.join("、"),
    scene: word.memoryImage?.scene || "",
    memoryMeaning: word.memoryImage?.meaning || word.cn.join("，")
  };
}

function decorateQuestion(question, word) {
  if (!question || !word) return null;
  const answer = word.cn.join("，");
  return {
    ...question,
    options: question.options.map((option) => ({
      value: option,
      first: option.split("，")[0],
      rest: option.split("，").slice(1).join("，"),
      isAnswer: option === answer,
      isSelected: option === question.selected,
      statusClass: !question.answered ? "" : option === answer ? "correct" : option === question.selected ? "wrong" : "muted-card"
    }))
  };
}
