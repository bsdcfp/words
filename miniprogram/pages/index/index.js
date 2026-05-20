const { wordDatasetMeta } = require("../../data/words");
const { testQuestions } = require("../../data/test-questions");
const { buildDailyReport, getRewardStreakText } = require("../../utils/report");
const { loadState, resetState, saveState } = require("../../utils/storage");
const flow = require("../../utils/study-flow");

const VIEWS = {
  HOME: "home",
  PROFILE: "profile",
  LEVEL_SELECT: "level-select",
  TEST: "test",
  TEST_RESULT: "test-result",
  PRECHECK: "precheck",
  WORD_STUDY: "word-study",
  GROUP_REVIEW: "group-review",
  AUDIO_MEANING: "audio-meaning",
  WRONG_BOOK: "wrong-book",
  DAILY_REPORT: "daily-report"
};
const NOTICE_DURATION_MS = 1500;
const AUTO_PLAY_DELAY_MS = 0;
const AUDIO_PLAY_RETRY_MS = 80;
const LEVEL_GROUPS = [
  {
    title: "小学",
    options: [
      { id: "primary_1", label: "一年级" },
      { id: "primary_2", label: "二年级" },
      { id: "primary_3", label: "三年级" },
      { id: "primary_4", label: "四年级" },
      { id: "primary_5", label: "五年级" },
      { id: "primary_6", label: "六年级" }
    ]
  },
  {
    title: "初中",
    options: [
      { id: "junior_1", label: "初一" },
      { id: "junior_2", label: "初二" },
      { id: "junior_3", label: "初三" }
    ]
  },
  {
    title: "高中",
    options: [
      { id: "senior_1", label: "高一" },
      { id: "senior_2", label: "高二" },
      { id: "senior_3", label: "高三" }
    ]
  },
  {
    title: "大学",
    options: [
      { id: "college_1", label: "大一" },
      { id: "college_2", label: "大二" },
      { id: "college_3", label: "大三" },
      { id: "college_4", label: "大四" },
      { id: "master", label: "硕士" },
      { id: "doctor", label: "博士" }
    ]
  },
  {
    title: "成人",
    options: [
      { id: "adult_daily", label: "日常英语" },
      { id: "adult_work", label: "职场英语" },
      { id: "adult_exam", label: "考试备考" }
    ]
  }
];

Page({
  data: {
    view: VIEWS.HOME,
    state: null,
    home: {},
    profile: {},
    levelSelect: {},
    test: {},
    testResult: {},
    precheck: {},
    study: {},
    review: {},
    audio: {},
    wrongBook: {},
    report: {},
    detail: null,
    bootError: "",
    studyImageMode: false,
    studyTransition: false,
    audioCompletionNotice: "",
    audioCompletionHint: "",
    precheckNotice: ""
  },

  onLoad() {
    try {
      this.state = loadState();
      this.render(VIEWS.HOME);
    } catch (error) {
      this.state = resetState();
      this.setData({
        view: VIEWS.HOME,
        state: this.state,
        home: buildHomeData(this.state),
        bootError: error && error.message ? error.message : String(error)
      });
    }
  },

  onUnload() {
    this.clearStudyTransitionTimer();
    this.clearAudioCompletionTimer();
    this.clearPrecheckNoticeTimer();
    this.clearAutoPlayTimer();
    this.stopCurrentAudio();
  },

  startTest() {
    flow.startAssessment(this.state);
    this.saveAndRender(VIEWS.TEST);
  },

  openWordsTab() {
    this.saveAndRender(VIEWS.HOME);
  },

  openProfile() {
    this.saveAndRender(VIEWS.PROFILE);
  },

  openLevelSelect() {
    this.saveAndRender(VIEWS.LEVEL_SELECT);
  },

  selectLevel(event) {
    const { levelId, levelLabel } = event.currentTarget.dataset;
    this.state.user.levelId = levelId;
    this.state.user.levelLabel = levelLabel;
    this.state.user.level = levelLabel;
    this.saveAndRender(VIEWS.PROFILE);
  },

  skipLevelSelect() {
    this.saveAndRender(VIEWS.HOME);
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
    if (!flow.getCurrentStudyWord(this.state)) {
      saveState(this.state);
      this.setData({ studyTransition: true });
      this.clearStudyTransitionTimer();
      this.studyTransitionTimer = setTimeout(() => {
        this.studyTransitionTimer = null;
        this.setData({ studyTransition: false });
        flow.prepareGroupReviewQuestions(this.state);
        this.saveAndRender(VIEWS.GROUP_REVIEW);
      }, NOTICE_DURATION_MS);
      return;
    }
    this.saveAndRender(VIEWS.WORD_STUDY);
  },

  startReview() {
    this.clearStudyTransitionTimer();
    this.setData({ studyTransition: false });
    flow.prepareGroupReviewQuestions(this.state);
    this.saveAndRender(VIEWS.GROUP_REVIEW);
  },

  finishReview() {
    flow.prepareAudioQuestions(this.state);
    this.saveAndRender(VIEWS.AUDIO_MEANING);
  },

  answerGroupReview(event) {
    const question = flow.getCurrentGroupReviewQuestion(this.state);
    if (!question || question.answered) return;
    const result = flow.answerGroupReviewQuestion(this.state, event.currentTarget.dataset.value);
    if (result.isCorrect) {
      this.advanceGroupReview();
      return;
    }
    this.saveAndRender(VIEWS.GROUP_REVIEW);
  },

  nextGroupReview() {
    this.advanceGroupReview();
  },

  advanceGroupReview() {
    const phase = flow.moveToNextGroupReviewQuestion(this.state);
    if (phase === "audio-meaning") {
      this.finishReview();
      return;
    }
    this.saveAndRender(VIEWS.GROUP_REVIEW);
  },

  answerAudio(event) {
    const question = flow.getCurrentAudioQuestion(this.state);
    if (!question || question.answered) return;
    const result = flow.answerAudioQuestion(this.state, event.currentTarget.dataset.value);
    if (result.isCorrect) {
      const phase = flow.moveToNextAudioQuestion(this.state);
      this.advanceAfterAudioPhase(phase);
      return;
    }
    this.saveAndRender(VIEWS.AUDIO_MEANING);
  },

  nextAudio() {
    const phase = flow.moveToNextAudioQuestion(this.state);
    this.advanceAfterAudioPhase(phase);
  },

  advanceAfterAudioPhase(phase) {
    if (phase === "next-selection") {
      this.showAudioCompletionThenRender(VIEWS.PRECHECK);
      return;
    }
    if (phase === "mixed-review") {
      this.showAudioCompletionThenRender(VIEWS.GROUP_REVIEW);
      return;
    }
    this.saveAndRender(VIEWS.AUDIO_MEANING);
  },

  showAudioCompletionThenRender(nextView) {
    const mixedNotice = buildMixedTransitionData(this.state);
    const notice = nextView === VIEWS.GROUP_REVIEW && mixedNotice
      ? mixedNotice.title
      : this.state.daily.groupFeedback || "本组完成，重新选下一组";
    const hint = nextView === VIEWS.GROUP_REVIEW && mixedNotice ? mixedNotice.hint : "";
    const precheckNotice = buildPrecheckNoticeData(this.state);
    if (precheckNotice) this.lastPrecheckNoticeKey = precheckNotice.key;
    saveState(this.state);
    this.clearAutoPlayTimer();
    this.stopCurrentAudio();
    this.clearAudioCompletionTimer();
    this.setData({ audioCompletionNotice: notice, audioCompletionHint: hint });
    this.audioCompletionTimer = setTimeout(() => {
      this.audioCompletionTimer = null;
      this.setData({ audioCompletionNotice: "", audioCompletionHint: "" });
      this.saveAndRender(nextView);
    }, NOTICE_DURATION_MS);
  },

  answerMixed(event) {
    const question = flow.getCurrentMixedReviewQuestion(this.state);
    if (!question || question.answered) return;
    const result = flow.answerMixedReviewQuestion(this.state, event.currentTarget.dataset.value);
    if (result.isCorrect) {
      const phase = flow.moveToNextMixedReviewQuestion(this.state);
      if (phase === "complete") {
        const next = flow.completeMixedReview(this.state);
        this.saveAndRender(next === "daily-report" ? VIEWS.DAILY_REPORT : VIEWS.PRECHECK);
        return;
      }
      this.saveAndRender(VIEWS.GROUP_REVIEW);
      return;
    }
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
    this.clearAutoPlayTimer();
    this.playWordAudio(event.currentTarget.dataset.wordId);
  },

  toggleStudyImageMode() {
    this.setData({ studyImageMode: !this.data.studyImageMode });
  },

  openDetail(event) {
    this.openDetailById(event.currentTarget.dataset.wordId);
  },

  closeDetail() {
    this.setData({ detail: null });
  },

  noop() {},

  clearStudyTransitionTimer() {
    if (!this.studyTransitionTimer) return;
    clearTimeout(this.studyTransitionTimer);
    this.studyTransitionTimer = null;
  },

  clearAudioCompletionTimer() {
    if (!this.audioCompletionTimer) return;
    clearTimeout(this.audioCompletionTimer);
    this.audioCompletionTimer = null;
  },

  clearPrecheckNoticeTimer() {
    if (!this.precheckNoticeTimer) return;
    clearTimeout(this.precheckNoticeTimer);
    this.precheckNoticeTimer = null;
  },

  clearAutoPlayTimer() {
    if (!this.autoPlayTimer) return;
    clearTimeout(this.autoPlayTimer);
    this.autoPlayTimer = null;
  },

  stopCurrentAudio() {
    if (this.currentAudioCleanup) {
      this.currentAudioCleanup(true);
      return;
    }
    if (!this.currentAudio) return;
    this.currentAudio.stop();
    this.currentAudio.destroy();
    this.currentAudio = null;
  },

  goHome() {
    this.saveAndRender(VIEWS.HOME);
  },

  openWrongBook() {
    this.saveAndRender(VIEWS.WRONG_BOOK);
  },

  resetData() {
    this.state = resetState();
    this.setData({ bootError: "" });
    this.saveAndRender(VIEWS.HOME);
  },

  saveAndRender(view) {
    saveState(this.state);
    this.render(view);
  },

  render(view) {
    const state = this.state;
    const patch = { view, state, studyTransition: false };
    if (view === VIEWS.HOME) patch.home = buildHomeData(state);
    if (view === VIEWS.PROFILE) patch.profile = buildProfileData(state);
    if (view === VIEWS.LEVEL_SELECT) patch.levelSelect = buildLevelSelectData(state);
    if (view === VIEWS.TEST) patch.test = buildTestData(state);
    if (view === VIEWS.TEST_RESULT) patch.testResult = state.assessment.result || {};
    if (view === VIEWS.PRECHECK) {
      patch.precheck = buildPrecheckData(state);
      const precheckNotice = buildPrecheckNoticeData(state);
      if (precheckNotice && this.lastPrecheckNoticeKey !== precheckNotice.key) {
        this.lastPrecheckNoticeKey = precheckNotice.key;
        patch.precheckNotice = precheckNotice.text;
      }
    }
    if (view === VIEWS.WORD_STUDY) patch.study = buildStudyData(state);
    if (view === VIEWS.GROUP_REVIEW) {
      patch.review = buildReviewData(state);
    }
    if (view === VIEWS.AUDIO_MEANING) patch.audio = buildAudioData(state);
    if (view === VIEWS.WRONG_BOOK) patch.wrongBook = buildWrongBookData(state);
    if (view === VIEWS.DAILY_REPORT) patch.report = buildReportData(state);
    this.setData(patch, () => {
      this.scheduleAutoPlay(view, AUTO_PLAY_DELAY_MS);
    });
    if (patch.precheckNotice) {
      this.clearPrecheckNoticeTimer();
      this.precheckNoticeTimer = setTimeout(() => {
        this.precheckNoticeTimer = null;
        this.setData({ precheckNotice: "" });
      }, NOTICE_DURATION_MS);
    }
  },

  scheduleAutoPlay(view, delay) {
    this.clearAutoPlayTimer();
    const wordId = this.getAutoPlayWordId(view);
    if (!wordId) return;
    const key = `${this.state.daily.startedAt}:${view}:${wordId}:${this.state.daily.audioIndex}:${this.state.daily.mixedIndex}`;
    if (this.lastAutoPlayKey === key) return;
    this.lastAutoPlayKey = key;
    this.autoPlayTimer = setTimeout(() => {
      this.autoPlayTimer = null;
      this.playWordAudio(wordId);
    }, delay);
  },

  getAutoPlayWordId(view) {
    let question = null;
    if (view === VIEWS.WORD_STUDY) {
      const word = flow.getCurrentStudyWord(this.state);
      return word ? word.id : "";
    }
    if (view === VIEWS.GROUP_REVIEW && this.state.daily.reviewPhase !== "mixed") {
      question = flow.getCurrentGroupReviewQuestion(this.state);
    }
    if (view === VIEWS.AUDIO_MEANING) {
      question = flow.getCurrentAudioQuestion(this.state);
    }
    if (view === VIEWS.GROUP_REVIEW && this.state.daily.reviewPhase === "mixed") {
      question = flow.getCurrentMixedReviewQuestion(this.state);
    }
    if (!question || question.answered) return "";
    return question.wordId;
  },

  playWordAudio(wordId) {
    const word = flow.getWordById(wordId);
    if (!word) return;
    this.configureAudioPlayback();
    this.startInnerAudio(word);
  },

  startInnerAudio(word) {
    this.stopCurrentAudio();
    const audio = wx.createInnerAudioContext();
    this.currentAudio = audio;
    let playStarted = false;
    let cleaned = false;
    let retryTimer = null;
    const clearRetry = () => {
      if (!retryTimer) return;
      clearTimeout(retryTimer);
      retryTimer = null;
    };
    const safePlay = () => {
      if (playStarted) return;
      playStarted = true;
      audio.play();
    };
    const cleanup = (shouldStop = false) => {
      if (cleaned) return;
      cleaned = true;
      clearRetry();
      if (this.currentAudio === audio) this.currentAudio = null;
      if (this.currentAudioCleanup === cleanup) this.currentAudioCleanup = null;
      if (shouldStop) audio.stop();
      audio.destroy();
    };
    this.currentAudioCleanup = cleanup;
    audio.autoplay = true;
    audio.obeyMuteSwitch = false;
    audio.volume = 1;
    audio.onCanplay(safePlay);
    audio.onPlay(() => {
      playStarted = true;
      clearRetry();
    });
    audio.onEnded(cleanup);
    audio.onError((error) => {
      console.warn("word audio play failed", word.word, error);
      cleanup();
    });
    audio.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word.word)}&type=2`;
    retryTimer = setTimeout(safePlay, AUDIO_PLAY_RETRY_MS);
  },

  configureAudioPlayback(done) {
    const finish = typeof done === "function" ? done : null;
    const app = typeof getApp === "function" ? getApp() : null;
    if (app && typeof app.configureAudioPlayback === "function") {
      app.configureAudioPlayback(finish);
      return;
    }
    if (typeof wx !== "undefined" && typeof wx.setInnerAudioOption === "function") {
      wx.setInnerAudioOption({
        mixWithOther: true,
        obeyMuteSwitch: false,
        speakerOn: true,
        success: finish || undefined,
        fail: finish || undefined
      });
      return;
    }
    if (finish) finish();
  },

  openDetailById(wordId) {
    const word = flow.getWordById(wordId);
    if (!word) return;
    this.setData({
      detail: Object.assign({}, word, {
        meaningText: word.cn.join("，"),
        tagText: word.tags.join("、"),
        collocationText: word.collocations.length ? word.collocations.map((item) => `${item.en}：${item.cn}`).join("\n") : "例句和搭配待自建"
      })
    });
  }
});

function buildHomeData(state) {
  const result = state.assessment.result;
  const wordStates = objectValues(state.userWordStates);
  const weakCount = wordStates.filter((wordState) => wordState.wrongCount > 0).length;
  const learnedCount = wordStates.filter((wordState) => wordState.familiarity > 0).length;
  const todayDone = state.daily.sessionCompletedWordIds.length;
  const todayGroups = Math.floor(todayDone / 3);
  const planCount = 1;
  const reviewCount = state.daily.mixedReviewWordIds.length || 0;
  return {
    userName: state.user.name,
    levelLabel: state.user.levelLabel || state.user.level || "未选择",
    vocabulary: result ? result.vocabulary : "未测",
    testLabel: result ? `${result.stage} · ${result.accuracy}%` : "独立诊断入口",
    learnedCount,
    weakCount,
    todayDone,
    todayGroups,
    dailyGoalMet: todayGroups >= 1,
    planCount,
    reviewCount,
    streakDays: state.user.streakDays,
    streakText: getRewardStreakText(state),
    badges: state.user.badges.length ? state.user.badges.join("、") : "今日完成后获得起步徽章",
    groupName: wordDatasetMeta.groupName,
    total: wordDatasetMeta.total,
    miniProgramTotal: wordDatasetMeta.miniProgramTotal,
    dictionary: wordDatasetMeta.dictionary.source
  };
}

function buildProfileData(state) {
  const result = state.assessment.result;
  const wordStates = objectValues(state.userWordStates);
  const learnedCount = wordStates.filter((wordState) => wordState.familiarity > 0).length;
  const weakCount = wordStates.filter((wordState) => wordState.wrongCount > 0).length;
  const todayDone = state.daily.sessionCompletedWordIds.length;
  const todayMinutes = todayDone ? Math.max(3, todayDone * 2) : 0;
  const week = ["一", "二", "三", "四", "五", "六", "日"].map((day, index) => ({
    day,
    active: index < Math.min(state.user.streakDays, 7)
  }));
  return {
    userName: state.user.name,
    vocabulary: result ? result.vocabulary : "未测",
    levelLabel: state.user.levelLabel || state.user.level || "未选择",
    activeGroup: state.user.activeGroup || wordDatasetMeta.groupName,
    total: wordDatasetMeta.total,
    miniProgramTotal: wordDatasetMeta.miniProgramTotal,
    learnedCount,
    weakCount,
    todayDone,
    todayMinutes,
    totalMinutes: learnedCount * 2,
    streakDays: state.user.streakDays,
    longestStreak: state.user.longestStreak || 0,
    week
  };
}

function buildLevelSelectData(state) {
  return {
    currentLevel: state.user.levelLabel || state.user.level || "未选择",
    groups: LEVEL_GROUPS
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
      id: word.id,
      word: word.word,
      headword: word.headword,
      syllables: word.syllables,
      ipa: word.ipa,
      pos: word.pos,
      cn: word.cn,
      memoryImage: word.memoryImage,
      example_en: word.example_en,
      example_cn: word.example_cn,
      collocations: word.collocations,
      level: word.level,
      curriculumStage: word.curriculumStage,
      starLevel: word.starLevel,
      sourceIndex: word.sourceIndex,
      tags: word.tags,
      index: index + 1,
      selected: selectedIds.includes(word.id),
      status: state.daily.precheck[word.id] || "",
      meaningText: word.cn.join("，")
    }));
  return {
    candidates,
    selectedCount: selectedIds.length,
    canStart: selectedIds.length === 3
  };
}

function buildPrecheckNoticeData(state) {
  if (!state.daily.groupFeedback) return null;
  return {
    key: `${state.daily.startedAt}_${state.daily.completedWordIds.join("_")}_${state.daily.groupFeedback}`,
    text: state.daily.groupFeedback
  };
}

function buildStudyData(state) {
  const word = flow.getCurrentStudyWord(state);
  const total = state.daily.selectedWordIds.length || 3;
  const current = Math.min(state.daily.studyIndex + 1, total);
  return {
    word: word ? decorateWord(word) : null,
    progress: `${current}/${total}`
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
  const question = flow.getCurrentGroupReviewQuestion(state);
  const word = question ? flow.getWordById(question.wordId) : null;
  return {
    isMixed: false,
    question: decorateQuestion(question, word),
    word: word ? decorateWord(word) : null,
    count: state.daily.selectedWordIds.length,
    progress: question ? `${state.daily.groupIndex + 1}/${state.daily.groupQuestions.length}` : ""
  };
}

function buildMixedTransitionData(state) {
  if (state.daily.reviewPhase !== "mixed") return null;
  if (state.daily.mixedIndex !== 0) return null;
  if (!state.daily.mixedReviewWordIds.length) return null;
  return {
    key: `${state.daily.startedAt}_${state.daily.mixedReviewWordIds.join("_")}`,
    title: `${state.daily.mixedReviewWordIds.length} 词混组复习`,
    hint: "现在开始打乱前面学过的词"
  };
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
  const words = objectEntries(state.userWordStates)
    .filter((entry) => entry[1].wrongCount > 0)
    .map((entry) => ({ word: flow.getWordById(entry[0]), wordState: entry[1] }))
    .filter((item) => item.word)
    .sort((a, b) => b.wordState.wrongCount - a.wordState.wrongCount)
    .map((item) => Object.assign({}, decorateWord(item.word), { wrongCount: item.wordState.wrongCount }));
  return { words, count: words.length };
}

function buildReportData(state) {
  const report = state.lastReport || buildDailyReport(state, require("../../data/words").words);
  return Object.assign({}, report, {
    weakWordText: report.weakWords.length ? report.weakWords.map((word) => word.word).join("、") : "本轮没有新增错词",
    badgeText: state.user.badges.length ? state.user.badges.join("、") : "暂无"
  });
}

function decorateWord(word) {
  const memoryImage = word.memoryImage || {};
  return Object.assign({}, word, {
    meaningText: word.cn.join("，"),
    tagText: word.tags.join("、"),
    scene: memoryImage.scene || "",
    memoryMeaning: memoryImage.meaning || word.cn.join("，")
  });
}

function decorateQuestion(question, word) {
  if (!question || !word) return null;
  const answer = word.cn.join("，");
  return Object.assign({}, question, {
    mode: question.mode || "visual",
    options: question.options.map((option) => ({
      value: option,
      pos: getMeaningPos(option),
      first: option.split("，")[0],
      rest: option.split("，").slice(1).join("，"),
      isAnswer: option === answer,
      isSelected: option === question.selected,
      statusClass: !question.answered ? "" : option === answer ? "correct" : option === question.selected ? "wrong" : "muted-card"
    }))
  });
}

function getMeaningPos(meaning) {
  const matched = flow.getAllWords().find((item) => item.cn.join("，") === meaning);
  return matched ? matched.pos : "";
}

function objectValues(source) {
  return Object.keys(source || {}).map((key) => source[key]);
}

function objectEntries(source) {
  return Object.keys(source || {}).map((key) => [key, source[key]]);
}
