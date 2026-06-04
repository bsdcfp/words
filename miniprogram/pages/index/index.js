const { wordDatasetMeta } = require("../../data/words");
const { usageByWordId } = require("../../data/usage");
const { buildDailyReport, getRewardStreakText } = require("../../utils/report");
const { loadState, resetState, saveState } = require("../../utils/storage");
const flow = require("../../utils/study-flow");

const VIEWS = {
  HOME: "home",
  PROFILE: "profile",
  MONTH_PROGRESS: "month-progress",
  LEVEL_SELECT: "level-select",
  TEST: "test",
  TEST_RESULT: "test-result",
  PRECHECK: "precheck",
  WORD_STUDY: "word-study",
  GROUP_REVIEW: "group-review",
  AUDIO_MEANING: "audio-meaning",
  MEANING_RECALL: "meaning-recall",
  WRONG_BOOK: "wrong-book",
  DAILY_REPORT: "daily-report"
};
const NOTICE_DURATION_MS = 1500;
const AUTO_PLAY_DELAY_MS = 0;
const AUDIO_PLAY_RETRY_MS = 80;
const MAX_AUDIO_PLAY_ATTEMPTS = 24;
const READ_ALONG_DURATION_MS = 1200;
const READ_ALONG_REPLAY_DELAY_MS = 0;
const READ_ALONG_VOICE_THRESHOLD = 500;
const REVEAL_DELAY_MS = 2000;
const REVIEW_CONFIRM_PAUSE_MS = 500;
const AUTO_MISS_AFTER_REVEAL_MS = 3000;
const WRONG_EDGE_FEEDBACK_MS = 300;
const PRECHECK_SWIPE_THRESHOLD = 92;
const PRECHECK_SWIPE_EXIT_MS = 180;
const MAX_DAILY_TARGET_LISTS = 100;
const WORD_LEVEL_OPTIONS = [
  { id: "primary", label: "小学", enabled: false, status: "暂未开放" },
  { id: "junior", label: "初中", enabled: false, status: "暂未开放" },
  { id: "senior", label: "高中", enabled: true, status: "已开放", startLevel: "required" },
  { id: "cet4", label: "大学四级", enabled: false, status: "暂未开放" },
  { id: "cet6", label: "大学六级", enabled: false, status: "暂未开放" },
  { id: "postgraduate", label: "考研", enabled: false, status: "暂未开放" },
  { id: "ielts", label: "雅思", enabled: false, status: "暂未开放" }
];
const NAVIGATION_TITLES = {
  [VIEWS.HOME]: "",
  [VIEWS.PROFILE]: "我的",
  [VIEWS.MONTH_PROGRESS]: "学习进展",
  [VIEWS.LEVEL_SELECT]: "选择单词水平",
  [VIEWS.TEST]: "词汇量测试",
  [VIEWS.TEST_RESULT]: "测评结果",
  [VIEWS.PRECHECK]: "训前检测",
  [VIEWS.WORD_STUDY]: "单词识记",
  [VIEWS.GROUP_REVIEW]: "回忆复习",
  [VIEWS.AUDIO_MEANING]: "听音辨义",
  [VIEWS.MEANING_RECALL]: "中文回忆英文",
  [VIEWS.WRONG_BOOK]: "错词本",
  [VIEWS.DAILY_REPORT]: "今日完成"
};

function isDevtoolsRuntime() {
  if (typeof wx === "undefined") return false;
  try {
    if (typeof wx.getDeviceInfo === "function") return wx.getDeviceInfo().platform === "devtools";
    if (typeof wx.getSystemInfoSync === "function") return wx.getSystemInfoSync().platform === "devtools";
  } catch (error) {
    // Keep the real-device audio option path if runtime detection is unavailable.
  }
  return false;
}

Page({
  data: {
    view: VIEWS.HOME,
    home: {},
    profile: {},
    themeClass: "learning-light",
    monthProgress: {},
    levelSelect: {},
    test: {},
    testResult: {},
    precheck: {},
    study: {},
    review: {},
    audio: {},
    recall: {},
    wrongBook: {},
    report: {},
    detail: null,
    bootError: "",
    studyImageMode: false,
    studyUsageOpen: false,
    studyAudioEnabled: true,
    readAlongStatus: "",
    studyTransition: false,
    reviewAnswerVisible: false,
    audioAnswerVisible: false,
    recallAnswerVisible: false,
    focusPauseVisible: false,
    focusPause: {},
    focusEdgeFeedback: false,
    wrongBookEditing: false,
    precheckSwipeClass: "",
    audioCompletionNotice: "",
    audioCompletionHint: "",
    precheckNotice: ""
  },

  onLoad(options = {}) {
    try {
      this.viewHistory = [];
      this.state = loadState();
      // Never auto-resume a standalone review session (错词/遗忘曲线) on launch.
      if (this.state && this.state.reviewSession) flow.clearReviewSession(this.state);
      if (options.visual) {
        this.showVisualRegressionPage(options.visual);
        return;
      }
      this.render(VIEWS.HOME);
    } catch (error) {
      this.state = resetState();
      this.setData({
        view: VIEWS.HOME,
        home: buildHomeData(this.state),
        bootError: error && error.message ? error.message : String(error)
      });
    }
  },

  onUnload() {
    this.clearStudyTransitionTimer();
    this.clearAudioCompletionTimer();
    this.clearPrecheckNoticeTimer();
    this.clearReviewRevealTimer();
    this.clearReviewAdvanceTimer();
    this.clearAudioRevealTimer();
    this.clearRecallRevealTimer();
    this.clearFocusMissTimer();
    this.clearEdgeFeedbackTimer();
    this.clearAutoPlayTimer();
    this.stopReadAlong({ silent: true });
    this.stopCurrentAudio();
  },

  startTest() {
    if (!hasSelectedWordLevel(this.state)) {
      this.pendingAfterLevelSelect = VIEWS.TEST;
      this.saveAndRender(VIEWS.LEVEL_SELECT);
      return;
    }
    flow.startAssessment(this.state);
    this.saveAndRender(VIEWS.TEST);
  },

  takeLevelTest() {
    // Entry from the level-select page itself: the assessment decides the level,
    // so start it directly instead of bouncing back to level selection.
    this.pendingAfterLevelSelect = "";
    flow.startAssessment(this.state);
    this.saveAndRender(VIEWS.TEST);
  },

  startStageTest() {
    if (!hasSelectedWordLevel(this.state)) {
      this.saveAndRender(VIEWS.LEVEL_SELECT);
      return;
    }
    if (!flow.getStageTestCount(this.state)) {
      if (typeof wx !== "undefined" && typeof wx.showToast === "function") {
        wx.showToast({ title: "先学一些词再来检测", icon: "none" });
      }
      return;
    }
    flow.startStageTest(this.state);
    this.saveAndRender(VIEWS.TEST);
  },

  openWordsTab() {
    this.saveAndRender(VIEWS.HOME);
  },

  openProfile() {
    this.saveAndRender(VIEWS.PROFILE);
  },

  openMonthProgress() {
    this.progressMonthCursor = new Date();
    this.saveAndRender(VIEWS.MONTH_PROGRESS);
  },

  changeProgressMonth(event) {
    const [year, month] = event.detail.value.split("-").map(Number);
    this.progressMonthCursor = new Date(year, month - 1, 1);
    this.saveAndRender(VIEWS.MONTH_PROGRESS, { track: false });
  },

  shiftProgressMonth(event) {
    const offset = Number(event.currentTarget.dataset.offset || 0);
    const cursor = this.progressMonthCursor || new Date();
    this.progressMonthCursor = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
    this.saveAndRender(VIEWS.MONTH_PROGRESS, { track: false });
  },

  openLevelSelect() {
    this.saveAndRender(VIEWS.LEVEL_SELECT);
  },

  selectLevel(event) {
    const { levelId, levelLabel, startLevel, enabled } = event.currentTarget.dataset;
    if (enabled !== true && enabled !== "true") return;
    this.state.user.wordLevelId = levelId;
    this.state.user.wordLevelLabel = levelLabel;
    this.state.user.levelId = levelId;
    this.state.user.levelLabel = levelLabel;
    this.state.user.level = levelLabel;
    this.state.user.learningStartLevel = startLevel || "required";
    this.state.user.learningStartLevelLabel = "高考 3500 词";
    this.state.user.manualStartLevel = this.state.user.learningStartLevel;

    if (this.pendingAfterLevelSelect === VIEWS.TEST) {
      this.pendingAfterLevelSelect = "";
      flow.startAssessment(this.state);
      this.saveAndRender(VIEWS.TEST, { track: false });
      return;
    }
    this.saveAndRender(VIEWS.PROFILE, { track: false });
  },

  skipLevelSelect() {
    this.saveAndRender(VIEWS.HOME);
  },

  answerTest(event) {
    flow.answerAssessmentQuestion(this.state, event.currentTarget.dataset.value);
    this.saveAndRender(this.state.assessment.completed ? VIEWS.TEST_RESULT : VIEWS.TEST);
  },

  startDailyLearning() {
    if (!hasSelectedWordLevel(this.state)) {
      this.saveAndRender(VIEWS.LEVEL_SELECT);
      return;
    }
    if (this.state.daily && this.state.daily.completed && this.state.lastReport) {
      this.saveAndRender(VIEWS.DAILY_REPORT);
      return;
    }
    const resumeView = currentDailyResumeView(this.state);
    if (resumeView) {
      this.saveAndRender(resumeView, { playImmediately: resumeView === VIEWS.WORD_STUDY });
      return;
    }
    flow.startDailyLearning(this.state);
    this.saveAndRender(VIEWS.PRECHECK);
  },

  markPrecheck(event) {
    const { wordId, value } = event.currentTarget.dataset;
    this.completePrecheckChoice(wordId, value);
  },

  completePrecheckChoice(wordId, value) {
    if (!wordId || !value) return;
    flow.markPrecheck(this.state, wordId, value);
    if (this.state.daily.precheckCompleted && this.state.daily.selectedWordIds.length === 3) {
      this.saveAndRender(VIEWS.WORD_STUDY, { playImmediately: true });
      return;
    }
    this.saveAndRender(VIEWS.PRECHECK);
  },

  handlePrecheckTouchStart(event) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    this.precheckTouch = {
      wordId: event.currentTarget.dataset.wordId,
      startY: touch.clientY,
      lastY: touch.clientY
    };
    this.setData({ precheckSwipeClass: "swiping" });
  },

  handlePrecheckTouchMove(event) {
    if (!this.precheckTouch) return;
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    const deltaY = touch.clientY - this.precheckTouch.startY;
    this.precheckTouch.lastY = touch.clientY;
    const swipeClass = deltaY < -PRECHECK_SWIPE_THRESHOLD / 2
      ? "swiping hint-known"
      : (deltaY > PRECHECK_SWIPE_THRESHOLD / 2 ? "swiping hint-unfamiliar" : "swiping");
    if (this.data.precheckSwipeClass !== swipeClass) {
      this.setData({ precheckSwipeClass: swipeClass });
    }
  },

  handlePrecheckTouchEnd(event) {
    if (!this.precheckTouch) return;
    const touch = event.changedTouches && event.changedTouches[0];
    const endY = touch ? touch.clientY : this.precheckTouch.lastY;
    const deltaY = endY - this.precheckTouch.startY;
    const wordId = this.precheckTouch.wordId;
    this.precheckTouch = null;
    if (deltaY < -PRECHECK_SWIPE_THRESHOLD) {
      this.setData({ precheckSwipeClass: "exit-known" });
      setTimeout(() => this.completePrecheckChoice(wordId, "known"), PRECHECK_SWIPE_EXIT_MS);
      return;
    }
    if (deltaY > PRECHECK_SWIPE_THRESHOLD) {
      this.setData({ precheckSwipeClass: "exit-unfamiliar" });
      setTimeout(() => this.completePrecheckChoice(wordId, "unfamiliar"), PRECHECK_SWIPE_EXIT_MS);
      return;
    }
    this.setData({ precheckSwipeClass: "" });
  },

  handlePrecheckTouchCancel() {
    this.precheckTouch = null;
    this.setData({ precheckSwipeClass: "" });
  },

  markStudy(event) {
    this.clearAutoPlayTimer();
    this.stopReadAlong({ silent: true });
    const value = Number(event.currentTarget.dataset.value);
    if (value < 3) {
      this.restartStudyPlayback();
      return;
    }
    flow.markStudyWord(this.state, value);
    this.advanceAfterStudyWord();
  },

  restartStudyPlayback() {
    if (this.data.view !== VIEWS.WORD_STUDY) return;
    const word = flow.getCurrentStudyWord(this.state);
    if (!word) return;
    this.studyPlaybackWordId = word.id;
    this.studyPlaybackCount = 0;
    this.setData({ readAlongStatus: "再听一轮" });
    this.playStudyAudio(word.id);
  },

  advanceAfterStudyWord() {
    if (!flow.getCurrentStudyWord(this.state)) {
      this.clearStudyTransitionTimer();
      flow.prepareGroupReviewQuestions(this.state);
      this.saveAndRender(VIEWS.GROUP_REVIEW, { track: false });
      return;
    }
    this.saveAndRender(VIEWS.WORD_STUDY, { playImmediately: true });
  },

  finishReview() {
    flow.prepareAudioQuestions(this.state);
    this.saveAndRender(VIEWS.AUDIO_MEANING, { track: false });
  },

  rememberGroupReview() {
    this.rememberReviewQuestion("group");
  },

  markGroupReviewUnfamiliar() {
    this.retryReviewQuestion("group");
  },

  advanceGroupReview() {
    this.advanceReviewQuestion("group");
  },

  rememberAudio() {
    this.rememberAudioQuestion();
  },

  markAudioUnfamiliar() {
    const question = flow.getCurrentAudioQuestion(this.state);
    if (!question || question.answered) return;
    this.clearFocusMissTimer();
    this.setData({ audioAnswerVisible: false });
    this.playAudioMeaningAndReveal(question.wordId, this.playbackKeyFor(VIEWS.AUDIO_MEANING, question.wordId));
  },

  advanceAfterAudioPhase(phase) {
    if (phase === "meaning-recall") {
      this.saveAndRender(VIEWS.MEANING_RECALL, { track: false });
      return;
    }
    if (phase === "daily-report") {
      this.showAudioCompletionThenRender(VIEWS.DAILY_REPORT);
      return;
    }
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

  rememberAudioQuestion() {
    const question = flow.getCurrentAudioQuestion(this.state);
    if (!question || question.answered) return;
    this.cancelPagePlayback();
    this.clearFocusMissTimer();
    flow.answerAudioQuestion(this.state, question.options[0]);
    const phase = flow.moveToNextAudioQuestion(this.state);
    this.advanceAfterAudioPhase(phase);
  },

  rememberMeaningRecall() {
    this.rememberRecallQuestion();
  },

  retryMeaningRecall() {
    this.clearFocusMissTimer();
    this.setData({ recallAnswerVisible: false });
    this.scheduleMeaningRecallReveal(VIEWS.MEANING_RECALL);
  },

  rememberRecallQuestion() {
    const question = flow.getCurrentMeaningRecallQuestion(this.state);
    if (!question || question.answered) return;
    this.clearRecallRevealTimer();
    this.clearFocusMissTimer();
    flow.answerMeaningRecallQuestion(this.state);
    const phase = flow.moveToNextMeaningRecallQuestion(this.state);
    this.advanceAfterMeaningRecallPhase(phase);
  },

  advanceAfterMeaningRecallPhase(phase) {
    if (phase === "daily-report") {
      this.showAudioCompletionThenRender(VIEWS.DAILY_REPORT);
      return;
    }
    if (phase === "word-study") {
      this.showAudioCompletionThenRender(VIEWS.WORD_STUDY);
      return;
    }
    if (phase === "next-selection") {
      this.showAudioCompletionThenRender(VIEWS.PRECHECK);
      return;
    }
    if (phase === "mixed-review") {
      this.showAudioCompletionThenRender(VIEWS.GROUP_REVIEW);
      return;
    }
    this.saveAndRender(VIEWS.MEANING_RECALL);
  },

  showAudioCompletionThenRender(nextView) {
    const transition = this.buildCompletionTransition(nextView);
    const precheckNotice = buildPrecheckNoticeData(this.state);
    if (precheckNotice) this.lastPrecheckNoticeKey = precheckNotice.key;
    saveState(this.state);
    this.clearAutoPlayTimer();
    this.clearReviewRevealTimer();
    this.clearAudioRevealTimer();
    this.clearRecallRevealTimer();
    this.clearFocusMissTimer();
    this.stopCurrentAudio();
    if (!transition.notice) {
      this.saveAndRender(nextView, { track: false });
      return;
    }
    this.clearAudioCompletionTimer();
    this.setData({ audioCompletionNotice: transition.notice, audioCompletionHint: transition.hint });
    this.audioCompletionTimer = setTimeout(() => {
      this.audioCompletionTimer = null;
      this.setData({ audioCompletionNotice: "", audioCompletionHint: "" });
      this.saveAndRender(nextView, { track: false });
    }, NOTICE_DURATION_MS);
  },

  buildCompletionTransition(nextView) {
    const mixedNotice = buildMixedTransitionData(this.state);
    if (nextView === VIEWS.GROUP_REVIEW && mixedNotice) {
      return { notice: mixedNotice.title, hint: mixedNotice.hint || "" };
    }
    const feedback = this.state.daily && this.state.daily.groupFeedback;
    if (feedback) return { notice: feedback, hint: "" };
    if (nextView === VIEWS.DAILY_REPORT) return { notice: "今日 List 已完成", hint: "" };
    return { notice: "", hint: "" };
  },

  currentReviewKind() {
    return this.state.daily && this.state.daily.reviewPhase === "mixed" ? "mixed" : "group";
  },

  getReviewQuestion(kind = this.currentReviewKind()) {
    return kind === "mixed"
      ? flow.getCurrentMixedReviewQuestion(this.state)
      : flow.getCurrentGroupReviewQuestion(this.state);
  },

  answerReviewQuestion(kind, value) {
    return kind === "mixed"
      ? flow.answerMixedReviewQuestion(this.state, value)
      : flow.answerGroupReviewQuestion(this.state, value);
  },

  moveToNextReviewQuestion(kind) {
    return kind === "mixed"
      ? flow.moveToNextMixedReviewQuestion(this.state)
      : flow.moveToNextGroupReviewQuestion(this.state);
  },

  answerReviewChoice(kind, value) {
    const question = this.getReviewQuestion(kind);
    if (!question || question.answered) return;
    this.cancelPagePlayback();
    this.clearFocusMissTimer();
    const result = this.answerReviewQuestion(kind, value);
    if (result.isCorrect) {
      this.clearReviewRevealTimer();
      this.advanceReviewQuestion(kind);
      return;
    }
    this.saveAndRender(VIEWS.GROUP_REVIEW);
  },

  rememberReviewQuestion(kind) {
    const question = this.getReviewQuestion(kind);
    if (!question || question.answered) return;
    this.cancelPagePlayback();
    this.clearReviewRevealTimer();
    this.clearFocusMissTimer();
    this.answerReviewQuestion(kind, question.options[0]);
    // Show the meaning so the user can verify they remembered correctly,
    // hold briefly, then move on.
    this.setData({ reviewAnswerVisible: true });
    this.clearReviewAdvanceTimer();
    this.reviewAdvanceTimer = setTimeout(() => {
      this.reviewAdvanceTimer = null;
      if (this.data.view !== VIEWS.GROUP_REVIEW) return;
      this.advanceReviewQuestion(kind);
    }, REVIEW_CONFIRM_PAUSE_MS);
  },

  clearReviewAdvanceTimer() {
    if (!this.reviewAdvanceTimer) return;
    clearTimeout(this.reviewAdvanceTimer);
    this.reviewAdvanceTimer = null;
  },

  retryReviewQuestion(kind = this.currentReviewKind()) {
    const question = this.getReviewQuestion(kind);
    if (!question || question.answered) return;
    this.clearReviewRevealTimer();
    this.clearFocusMissTimer();
    this.setData({ reviewAnswerVisible: false });
    this.playReviewAudioAndReveal(question.wordId);
  },

  advanceReviewQuestion(kind) {
    const phase = this.moveToNextReviewQuestion(kind);
    if (kind === "mixed") {
      this.advanceAfterMixedPhase(phase);
      return;
    }
    this.advanceAfterGroupReviewPhase(phase);
  },

  advanceAfterGroupReviewPhase(phase) {
    if (phase === "audio-meaning") {
      this.finishReview();
      return;
    }
    this.saveAndRender(VIEWS.GROUP_REVIEW);
  },

  advanceAfterMixedPhase(phase) {
    if (phase === "complete") {
      if (this.reviewSessionKind) {
        // Standalone review session (错词/遗忘曲线): clear it and return to the
        // entry, never advancing the daily new-word flow or the celebration page.
        const kind = this.reviewSessionKind;
        this.reviewSessionKind = "";
        flow.clearReviewSession(this.state);
        if (typeof wx !== "undefined" && typeof wx.showToast === "function") {
          wx.showToast({ title: "复习完成", icon: "success" });
        }
        this.saveAndRender(kind === "wrong" ? VIEWS.WRONG_BOOK : VIEWS.HOME, { track: false });
        return;
      }
      const next = flow.completeMixedReview(this.state);
      this.renderAfterMixedReview(next);
      return;
    }
    this.saveAndRender(VIEWS.GROUP_REVIEW);
  },

  rememberMixedReview() {
    this.rememberReviewQuestion("mixed");
  },

  markMixedUnfamiliar() {
    this.retryReviewQuestion("mixed");
  },

  renderAfterMixedReview(next) {
    if (next === "mixed-review") {
      this.saveAndRender(VIEWS.GROUP_REVIEW, { track: false });
      return;
    }
    if (next === "word-study") {
      this.saveAndRender(VIEWS.WORD_STUDY, { track: false, playImmediately: true });
      return;
    }
    if (next === "daily-report") {
      this.saveAndRender(VIEWS.DAILY_REPORT, { track: false });
      return;
    }
    this.saveAndRender(VIEWS.PRECHECK, { track: false });
  },

  speak(event) {
    this.clearAutoPlayTimer();
    const view = this.data.view;
    if (view === VIEWS.WORD_STUDY) {
      this.restartStudyPlayback();
      return;
    }
    if (view === VIEWS.GROUP_REVIEW) {
      this.retryReviewQuestion();
      return;
    }
    if (view === VIEWS.AUDIO_MEANING) {
      this.markAudioUnfamiliar();
      return;
    }
    this.playWordAudio(event.currentTarget.dataset.wordId);
  },

  handleLearningSurfaceTap() {
    const view = this.data.view;
    if (view === VIEWS.WORD_STUDY) {
      this.restartStudyPlayback();
      return;
    }
    if (view === VIEWS.GROUP_REVIEW) {
      this.retryReviewQuestion();
      return;
    }
    if (view === VIEWS.AUDIO_MEANING) {
      const question = flow.getCurrentAudioQuestion(this.state);
      if (!question || question.answered) return;
      this.markAudioUnfamiliar();
      return;
    }
    if (view === VIEWS.MEANING_RECALL) {
      this.retryMeaningRecall();
    }
  },

  openPausePanel() {
    this.clearAutoPlayTimer();
    this.stopReadAlong({ silent: true });
    this.stopCurrentAudio();
    this.setData({
      focusPauseVisible: true,
      focusPause: buildFocusPauseData(this.state)
    });
  },

  closePausePanel() {
    this.setData({ focusPauseVisible: false });
    this.scheduleAutoPlay(this.data.view, AUTO_PLAY_DELAY_MS);
  },

  pauseToHome() {
    this.setData({ focusPauseVisible: false });
    this.goHome();
  },

  pauseToProfile() {
    this.setData({ focusPauseVisible: false });
    this.saveAndRender(VIEWS.PROFILE);
  },

  toggleStudyImageMode() {
    this.setData({ studyImageMode: !this.data.studyImageMode });
  },

  toggleStudyUsage() {
    this.setData({ studyUsageOpen: !this.data.studyUsageOpen });
  },

  toggleStudyAudio() {
    const enabled = !this.data.studyAudioEnabled;
    this.setData({ studyAudioEnabled: enabled });
    if (!enabled) {
      this.clearAutoPlayTimer();
      this.stopReadAlong({ silent: true });
      this.stopCurrentAudio();
      this.setData({ readAlongStatus: "" });
      return;
    }
    const word = flow.getCurrentStudyWord(this.state);
    if (word) this.playWordAudio(word.id);
  },

  openDetail(event) {
    this.openDetailById(event.currentTarget.dataset.wordId);
  },

  closeDetail() {
    this.setData({ detail: null });
  },

  noop() {},

  clearTimer(name) {
    if (!this[name]) return;
    clearTimeout(this[name]);
    this[name] = null;
  },

  clearStudyTransitionTimer() { this.clearTimer("studyTransitionTimer"); },
  clearAudioCompletionTimer() { this.clearTimer("audioCompletionTimer"); },
  clearPrecheckNoticeTimer() { this.clearTimer("precheckNoticeTimer"); },
  clearReviewRevealTimer() { this.clearTimer("reviewRevealTimer"); },
  clearAudioRevealTimer() { this.clearTimer("audioRevealTimer"); },
  clearRecallRevealTimer() { this.clearTimer("recallRevealTimer"); },
  clearFocusMissTimer() { this.clearTimer("focusMissTimer"); },
  clearEdgeFeedbackTimer() { this.clearTimer("edgeFeedbackTimer"); },
  clearAutoPlayTimer() { this.clearTimer("autoPlayTimer"); },

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

  cancelPagePlayback() {
    this.activePlaybackKey = "";
    this.clearAutoPlayTimer();
    this.stopCurrentAudio();
  },

  flashWrongEdge() {
    this.clearEdgeFeedbackTimer();
    this.setData({ focusEdgeFeedback: true });
    this.edgeFeedbackTimer = setTimeout(() => {
      this.edgeFeedbackTimer = null;
      this.setData({ focusEdgeFeedback: false });
    }, WRONG_EDGE_FEEDBACK_MS);
  },

  playbackKeyFor(view, wordId) {
    const daily = this.state && this.state.daily ? this.state.daily : {};
    return [
      daily.startedAt || "",
      view,
      wordId || "",
      daily.studyIndex || 0,
      daily.groupIndex || 0,
      daily.audioIndex || 0,
      daily.recallIndex || 0,
      daily.mixedIndex || 0,
      daily.reviewPhase || ""
    ].join(":");
  },

  scheduleReviewRevealAfterPlayback(wordId, playbackKey) {
    this.scheduleFocusReveal(VIEWS.GROUP_REVIEW, wordId, playbackKey);
  },

  playReviewAudioAndReveal(wordId, playbackKey) {
    const key = playbackKey || this.playbackKeyFor(VIEWS.GROUP_REVIEW, wordId);
    this.activePlaybackKey = key;
    this.playWordAudio(wordId, {
      playbackKey: key,
      onComplete: () => this.scheduleReviewRevealAfterPlayback(wordId, key)
    });
  },

  scheduleReviewAnswerReveal(view) {
    if (view !== VIEWS.GROUP_REVIEW) return;
    const question = this.getFocusQuestion(view);
    if (!question || question.answered) return;
    this.playReviewAudioAndReveal(question.wordId);
  },

  scheduleAudioAnswerReveal(view) {
    if (view !== VIEWS.AUDIO_MEANING) return;
    const question = this.getFocusQuestion(view);
    if (!question || question.answered) return;
    this.scheduleFocusReveal(view, question.wordId);
  },

  playAudioMeaningAndReveal(wordId, playbackKey) {
    const key = playbackKey || this.playbackKeyFor(VIEWS.AUDIO_MEANING, wordId);
    this.activePlaybackKey = key;
    this.clearAudioRevealTimer();
    this.playWordAudio(wordId, {
      playbackKey: key,
      onComplete: () => this.scheduleAudioAnswerReveal(VIEWS.AUDIO_MEANING)
    });
  },

  scheduleMeaningRecallReveal(view) {
    if (view !== VIEWS.MEANING_RECALL) return;
    const question = this.getFocusQuestion(view);
    if (!question || question.answered) return;
    this.scheduleFocusReveal(view, question.wordId);
  },

  getFocusQuestion(view) {
    if (view === VIEWS.GROUP_REVIEW) return this.getReviewQuestion();
    if (view === VIEWS.AUDIO_MEANING) return flow.getCurrentAudioQuestion(this.state);
    if (view === VIEWS.MEANING_RECALL) return flow.getCurrentMeaningRecallQuestion(this.state);
    return null;
  },

  clearRevealTimerFor(view) {
    if (view === VIEWS.GROUP_REVIEW) this.clearReviewRevealTimer();
    if (view === VIEWS.AUDIO_MEANING) this.clearAudioRevealTimer();
    if (view === VIEWS.MEANING_RECALL) this.clearRecallRevealTimer();
  },

  setRevealTimerFor(view, callback) {
    const timer = setTimeout(callback, REVEAL_DELAY_MS);
    if (view === VIEWS.GROUP_REVIEW) this.reviewRevealTimer = timer;
    if (view === VIEWS.AUDIO_MEANING) this.audioRevealTimer = timer;
    if (view === VIEWS.MEANING_RECALL) this.recallRevealTimer = timer;
  },

  clearRevealTimerSlot(view) {
    if (view === VIEWS.GROUP_REVIEW) this.reviewRevealTimer = null;
    if (view === VIEWS.AUDIO_MEANING) this.audioRevealTimer = null;
    if (view === VIEWS.MEANING_RECALL) this.recallRevealTimer = null;
  },

  setAnswerVisibleFor(view, visible) {
    if (view === VIEWS.GROUP_REVIEW) this.setData({ reviewAnswerVisible: visible });
    if (view === VIEWS.AUDIO_MEANING) this.setData({ audioAnswerVisible: visible });
    if (view === VIEWS.MEANING_RECALL) this.setData({ recallAnswerVisible: visible });
  },

  revealFocusAnswer(view, wordId, playbackKey) {
    if (playbackKey && this.activePlaybackKey !== playbackKey) return;
    const question = this.getFocusQuestion(view);
    if (!question || question.answered || question.wordId !== wordId) return;
    this.setAnswerVisibleFor(view, true);
    this.scheduleFocusMiss(view, wordId);
  },

  scheduleFocusReveal(view, wordId, playbackKey) {
    this.clearRevealTimerFor(view);
    this.setRevealTimerFor(view, () => {
      this.clearRevealTimerSlot(view);
      this.revealFocusAnswer(view, wordId, playbackKey);
    });
  },

  scheduleFocusMiss(view, wordId) {
    this.clearFocusMissTimer();
    this.focusMissTimer = setTimeout(() => {
      this.focusMissTimer = null;
      this.handleFocusMiss(view, wordId);
    }, AUTO_MISS_AFTER_REVEAL_MS);
  },

  handleFocusMiss(view, wordId) {
    if (this.data.view !== view) return;
    const question = this.getFocusQuestion(view);
    if (!question || question.answered || question.wordId !== wordId) return;
    this.flashWrongEdge();
    if (view === VIEWS.GROUP_REVIEW) {
      const kind = this.currentReviewKind();
      this.answerReviewQuestion(kind, "__missed__");
      if (kind === "mixed") {
        this.advanceAfterMixedMiss();
        return;
      }
      this.advanceAfterGroupMiss();
      return;
    }
    if (view === VIEWS.AUDIO_MEANING) {
      flow.answerAudioQuestion(this.state, "__missed__");
      this.advanceAfterAudioMiss();
      return;
    }
    if (view === VIEWS.MEANING_RECALL) {
      flow.missMeaningRecallQuestion(this.state);
      const phase = flow.moveToNextMeaningRecallQuestion(this.state);
      this.advanceAfterMeaningRecallPhase(phase);
    }
  },

  advanceAfterGroupMiss() {
    setTimeout(() => this.advanceGroupReview(), 1000);
  },

  advanceAfterMixedMiss() {
    setTimeout(() => {
      const phase = flow.moveToNextMixedReviewQuestion(this.state);
      this.advanceAfterMixedPhase(phase);
    }, 1000);
  },

  advanceAfterAudioMiss() {
    setTimeout(() => {
      const phase = flow.moveToNextAudioQuestion(this.state);
      this.advanceAfterAudioPhase(phase);
    }, 1000);
  },

  goHome() {
    this.viewHistory = [];
    this.saveAndRender(VIEWS.HOME, { track: false });
  },

  goBack() {
    const target = this.popBackTarget();
    this.saveAndRender(target || VIEWS.HOME, { track: false });
  },

  openWrongBook() {
    this.setData({ wrongBookEditing: false });
    this.saveAndRender(VIEWS.WRONG_BOOK);
  },

  toggleWrongBookEdit() {
    this.setData({ wrongBookEditing: !this.data.wrongBookEditing });
  },

  // Flow 2 of 3: 错词复习 — mix ALL wrong words into one review session.
  startWrongReview() {
    this.beginReviewSession("wrong");
  },

  // Flow 3 of 3: 遗忘曲线复习 — review words that are due by the SRS schedule.
  startForgettingReview() {
    this.beginReviewSession("forgetting");
  },

  beginReviewSession(kind) {
    if (!hasSelectedWordLevel(this.state)) {
      this.saveAndRender(VIEWS.LEVEL_SELECT);
      return;
    }
    const wordIds = kind === "wrong"
      ? flow.getWrongReviewWordIds(this.state, 9)
      : flow.getDueReviewWordIds(this.state, 9);
    if (!wordIds.length) {
      if (typeof wx !== "undefined" && typeof wx.showToast === "function") {
        wx.showToast({ title: kind === "wrong" ? "暂无错词" : "暂无到期复习", icon: "none" });
      }
      return;
    }
    const daily = this.state.daily || {};
    if (daily.startedAt && !daily.completed && !this.reviewSessionKind) {
      // A daily new-word session is mid-flight; don't corrupt it — continue it.
      this.startDailyLearning();
      return;
    }
    this.reviewSessionKind = kind;
    flow.startReviewSession(this.state, kind, wordIds, kind === "wrong" ? "错词复习" : "遗忘曲线复习");
    this.saveAndRender(VIEWS.GROUP_REVIEW);
  },

  removeWrongWord(event) {
    const wordId = event.currentTarget.dataset.wordId;
    const wordState = this.state.userWordStates[wordId];
    if (wordState) wordState.wrongCount = 0;
    this.saveAndRender(VIEWS.WRONG_BOOK, { track: false });
  },

  resetData() {
    this.state = resetState();
    this.viewHistory = [];
    this.setData({ bootError: "" });
    this.saveAndRender(VIEWS.HOME, { track: false });
  },

  showVisualRegressionPage(pageId) {
    const fixture = buildVisualRegressionFixture(pageId);
    this.state = fixture.state;
    this.viewHistory = [];
    this.setData({
      detail: null,
      focusPauseVisible: false,
      precheckNotice: "",
      audioCompletionNotice: "",
      audioCompletionHint: ""
    });
    this.render(fixture.view, {
      track: false,
      disableAutoPlay: true,
      visualPatch: fixture.patch || {}
    });
  },

  setListGroupCount(event) {
    const index = Number(event.detail.value || 0);
    const count = Math.min(Math.max(index + 1, 1), MAX_DAILY_TARGET_LISTS);
    if (!this.state.user.settings) this.state.user.settings = {};
    this.state.user.settings.dailyTargetListCount = count;
    this.state.user.settings.listGroupCount = count * 3;
    // Raising the goal after today's plan finished reopens the day so the
    // user can keep learning (stats are kept; more words get screened in).
    const daily = this.state.daily || {};
    if (daily.completed && daily.startedAt && isSameLocalDay(daily.startedAt)) {
      flow.reopenDailyForTarget(this.state);
    }
    this.saveAndRender(VIEWS.PROFILE, { track: false });
  },

  setPronunciationLoopCount(event) {
    const values = [3, 6, 9, 0];
    const index = Number(event.detail.value || 0);
    const count = values[index] !== undefined ? values[index] : 3;
    if (!this.state.user.settings) this.state.user.settings = {};
    this.state.user.settings.pronunciationLoopCount = count;
    this.saveAndRender(VIEWS.PROFILE, { track: false });
  },

  changeSleepTime(event) {
    if (!this.state.user.settings) this.state.user.settings = {};
    this.state.user.settings.sleepTime = event.detail.value;
    this.saveAndRender(VIEWS.PROFILE, { track: false });
  },

  changeWakeTime(event) {
    if (!this.state.user.settings) this.state.user.settings = {};
    this.state.user.settings.wakeTime = event.detail.value;
    this.saveAndRender(VIEWS.PROFILE, { track: false });
  },

  changeWrongReminderTime(event) {
    if (!this.state.user.settings) this.state.user.settings = {};
    this.state.user.settings.wrongReminderTime = event.detail.value;
    this.state.user.settings.wrongReminderEnabled = true;
    this.saveAndRender(VIEWS.PROFILE, { track: false });
  },

  confirmReset() {
    if (typeof wx !== "undefined" && typeof wx.showModal === "function") {
      wx.showModal({
        title: "数据重置",
        content: "将清空全部学习记录与设置，确定继续吗？",
        confirmText: "重置",
        confirmColor: "#c0563f",
        success: (res) => {
          if (res.confirm) this.resetData();
        }
      });
      return;
    }
    this.resetData();
  },

  setLearningTheme(event) {
    const theme = event.currentTarget.dataset.theme === "light" ? "light" : "dark";
    if (!this.state.user.settings) this.state.user.settings = {};
    this.state.user.settings.learningTheme = theme;
    this.state.user.settings.themeDefaultVersion = 2;
    this.saveAndRender(VIEWS.PROFILE, { track: false });
  },

  saveAndRender(view, options = {}) {
    saveState(this.state);
    this.render(view, options);
  },

  render(view, options = {}) {
    const state = this.state;
    this.rememberCurrentView(view, options);
    // Note: the full app state object stays on `this.state` only — putting it
    // into setData shipped ~1MB (3500 word states) to the view layer per render.
    const patch = { view, themeClass: learningThemeClassFor(state), studyTransition: false };
    this.updateNavigationBar(view);
    patch.focusPauseVisible = false;
    if (view === VIEWS.HOME) patch.home = buildHomeData(state);
    if (view === VIEWS.PROFILE) patch.profile = buildProfileData(state);
    if (view === VIEWS.MONTH_PROGRESS) patch.monthProgress = buildMonthProgressData(state, this.progressMonthCursor);
    if (view === VIEWS.LEVEL_SELECT) patch.levelSelect = buildLevelSelectData(state);
    if (view === VIEWS.TEST) patch.test = buildTestData(state);
    if (view === VIEWS.TEST_RESULT) patch.testResult = buildTestResultData(state);
    if (view === VIEWS.PRECHECK) {
      patch.precheck = buildPrecheckData(state);
      patch.precheckSwipeClass = "";
      const precheckNotice = buildPrecheckNoticeData(state);
      if (precheckNotice && this.lastPrecheckNoticeKey !== precheckNotice.key) {
        this.lastPrecheckNoticeKey = precheckNotice.key;
        patch.precheckNotice = precheckNotice.text;
      }
    }
    if (view === VIEWS.WORD_STUDY) {
      patch.study = buildStudyData(state);
      patch.readAlongStatus = "";
    }
    if (view === VIEWS.GROUP_REVIEW) {
      patch.review = buildReviewData(state);
      patch.reviewAnswerVisible = false;
    }
    if (view === VIEWS.AUDIO_MEANING) {
      patch.audio = buildAudioData(state);
      patch.audioAnswerVisible = false;
    }
    if (view === VIEWS.MEANING_RECALL) {
      patch.recall = buildMeaningRecallData(state);
      patch.recallAnswerVisible = false;
    }
    if (view === VIEWS.WRONG_BOOK) patch.wrongBook = buildWrongBookData(state);
    if (view === VIEWS.DAILY_REPORT) patch.report = buildReportData(state);
    if (options.visualPatch) Object.assign(patch, options.visualPatch);
    this.setData(patch, () => {
      this.scrollPageToTop();
      if (options.disableAutoPlay) return;
      if (options.playImmediately && view === VIEWS.WORD_STUDY) {
        this.startStudyPlaybackNow();
        return;
      }
      this.scheduleMeaningRecallReveal(view);
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

  updateNavigationBar(view) {
    if (isDevtoolsRuntime()) return;
    if (typeof wx.setNavigationBarColor === "function") {
      wx.setNavigationBarColor({
        frontColor: "#000000",
        backgroundColor: "#fcf9f3"
      });
    }
    if (typeof wx.setNavigationBarTitle === "function") {
      // Use the explicit per-view title (including an intentional empty string)
      // and only fall back for views that have no entry at all.
      const title = view in NAVIGATION_TITLES ? NAVIGATION_TITLES[view] : "AI 飞轮单词";
      wx.setNavigationBarTitle({ title });
    }
  },

  scrollPageToTop() {
    if (isDevtoolsRuntime()) return;
    if (typeof wx.pageScrollTo !== "function") return;
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  rememberCurrentView(nextView, options = {}) {
    const shouldTrack = options.track !== false;
    const currentView = this.data && this.data.view;
    if (!shouldTrack || !currentView || currentView === nextView) return;
    if (!this.viewHistory) this.viewHistory = [];
    if (this.viewHistory[this.viewHistory.length - 1] !== currentView) {
      this.viewHistory.push(currentView);
    }
  },

  popBackTarget() {
    if (!this.viewHistory) this.viewHistory = [];
    while (this.viewHistory.length) {
      const target = this.viewHistory.pop();
      if (this.canRenderBackTarget(target)) return target;
    }
    return VIEWS.HOME;
  },

  canRenderBackTarget(view) {
    if (!view) return false;
    if (this.data && this.data.view === view) return false;
    if ([VIEWS.HOME, VIEWS.PROFILE, VIEWS.MONTH_PROGRESS, VIEWS.LEVEL_SELECT, VIEWS.WRONG_BOOK, VIEWS.DAILY_REPORT].includes(view)) return true;
    if (view === VIEWS.TEST) return Boolean(this.state.assessment && !this.state.assessment.completed && flow.getCurrentTestQuestion(this.state));
    if (view === VIEWS.TEST_RESULT) return Boolean(this.state.assessment && this.state.assessment.completed && this.state.assessment.result);
    if (view === VIEWS.PRECHECK) return this.canReturnToPrecheck();
    if (view === VIEWS.WORD_STUDY) return Boolean(flow.getCurrentStudyWord(this.state));
    if (view === VIEWS.AUDIO_MEANING) return Boolean(flow.getCurrentAudioQuestion(this.state));
    if (view === VIEWS.MEANING_RECALL) return Boolean(flow.getCurrentMeaningRecallQuestion(this.state));
    if (view === VIEWS.GROUP_REVIEW) {
      return this.state.daily && this.state.daily.reviewPhase === "mixed"
        ? Boolean(flow.getCurrentMixedReviewQuestion(this.state))
        : Boolean(flow.getCurrentGroupReviewQuestion(this.state));
    }
    return false;
  },

  canReturnToPrecheck() {
    const daily = this.state && this.state.daily;
    if (!daily || !daily.candidateWordIds || !daily.candidateWordIds.length) return false;
    if (daily.reviewPhase === "mixed") return false;
    if (daily.groupQuestions && daily.groupQuestions.length) return false;
    if (daily.audioQuestions && daily.audioQuestions.length) return false;
    if (daily.recallQuestions && daily.recallQuestions.length) return false;
    if (daily.mixedQuestions && daily.mixedQuestions.length) return false;
    return true;
  },

  scheduleAutoPlay(view, delay) {
    this.clearAutoPlayTimer();
    this.stopReadAlong({ silent: true });
    if (view === VIEWS.WORD_STUDY && !this.data.studyAudioEnabled) return;
    const wordId = this.getAutoPlayWordId(view);
    if (!wordId) return;
    const key = this.playbackKeyFor(view, wordId);
    if (this.lastAutoPlayKey === key) return;
    this.lastAutoPlayKey = key;
    this.activePlaybackKey = key;
    if (view === VIEWS.WORD_STUDY) {
      this.studyPlaybackWordId = wordId;
      this.studyPlaybackCount = 0;
    }
    this.autoPlayTimer = setTimeout(() => {
      this.autoPlayTimer = null;
      if (view === VIEWS.WORD_STUDY) {
        this.playStudyAudio(wordId);
        return;
      }
      if (view === VIEWS.GROUP_REVIEW) {
        this.playReviewAudioAndReveal(wordId, key);
        return;
      }
      if (view === VIEWS.AUDIO_MEANING) {
        this.playAudioMeaningAndReveal(wordId, key);
        return;
      }
      this.playWordAudio(wordId, { playbackKey: key });
    }, delay);
  },

  startStudyPlaybackNow() {
    this.clearAutoPlayTimer();
    this.stopReadAlong({ silent: true });
    this.stopCurrentAudio();
    if (!this.data.studyAudioEnabled) return;
    const word = flow.getCurrentStudyWord(this.state);
    if (!word) return;
    const key = this.playbackKeyFor(VIEWS.WORD_STUDY, word.id);
    this.lastAutoPlayKey = key;
    this.activePlaybackKey = key;
    this.studyPlaybackWordId = word.id;
    this.studyPlaybackCount = 0;
    this.setData({ readAlongStatus: "" });
    this.playStudyAudio(word.id);
  },

  ensureRecordPermission(done) {
    if (typeof wx === "undefined" || typeof wx.authorize !== "function") {
      if (typeof done === "function") done();
      return;
    }
    wx.authorize({
      scope: "scope.record",
      success: typeof done === "function" ? done : undefined,
      fail: () => {
        if (typeof wx.showToast === "function") {
          wx.showToast({ title: "可在设置中开启麦克风", icon: "none" });
        }
        if (typeof done === "function") done();
      }
    });
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

  playStudyAudio(wordId) {
    const word = flow.getWordById(wordId);
    if (!word) return;
    if (this.studyPlaybackWordId !== word.id) {
      this.studyPlaybackWordId = word.id;
      this.studyPlaybackCount = 0;
    }
    this.studyPlaybackCount = (this.studyPlaybackCount || 0) + 1;
    const key = this.playbackKeyFor(VIEWS.WORD_STUDY, wordId);
    this.activePlaybackKey = key;
    this.playWordAudio(wordId, { mode: "study", playbackKey: key });
  },

  playWordAudio(wordId, options = {}) {
    const word = flow.getWordById(wordId);
    if (!word) return;
    this.configureAudioPlayback(() => this.startInnerAudio(word, options));
  },

  startInnerAudio(word, options = {}) {
    this.stopCurrentAudio();
    const audio = wx.createInnerAudioContext();
    this.currentAudio = audio;
    let playStarted = false;
    let cleaned = false;
    let retryTimer = null;
    let playAttempts = 0;
    const clearRetry = () => {
      if (!retryTimer) return;
      clearTimeout(retryTimer);
      retryTimer = null;
    };
    const scheduleRetry = () => {
      if (cleaned || playStarted || retryTimer || playAttempts >= MAX_AUDIO_PLAY_ATTEMPTS) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        safePlay();
      }, AUDIO_PLAY_RETRY_MS);
    };
    const safePlay = () => {
      if (cleaned || playStarted) return;
      playAttempts += 1;
      try {
        audio.play();
      } catch (error) {
        // The first play can race resource preparation; retry until onPlay confirms.
      }
      scheduleRetry();
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
    audio.onEnded(() => {
      cleanup();
      if (options.playbackKey && this.activePlaybackKey !== options.playbackKey) return;
      if (typeof options.onComplete === "function") options.onComplete();
      if (options.mode === "study" && this.data.view === VIEWS.WORD_STUDY && this.data.studyAudioEnabled) {
        this.startReadAlongWindow(word.id);
      }
    });
    audio.onError((error) => {
      console.warn("word audio play failed", word.word, error);
      cleanup();
      if (options.playbackKey && this.activePlaybackKey !== options.playbackKey) return;
      if (typeof options.onComplete === "function") options.onComplete();
    });
    audio.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word.word)}&type=1`;
    safePlay();
  },

  prepareRecorder() {
    if (this.recorder || typeof wx === "undefined" || typeof wx.getRecorderManager !== "function") return this.recorder;
    const recorder = wx.getRecorderManager();
    this.recorder = recorder;
    recorder.onStart(() => {
      this.readAlongActive = true;
      this.readAlongHasVoice = false;
      this.setData({ readAlongStatus: "跟读中" });
    });
    if (typeof recorder.onFrameRecorded === "function") {
      recorder.onFrameRecorded((event) => {
        if (this.hasVoiceInFrame(event.frameBuffer)) this.readAlongHasVoice = true;
      });
    }
    recorder.onStop((event) => {
      const shouldIgnoreStop = this.ignoreNextReadAlongStop;
      this.ignoreNextReadAlongStop = false;
      this.readAlongActive = false;
      this.readAlongTimer = null;
      if (shouldIgnoreStop) return;
      const hasVoice = this.readAlongHasVoice || Boolean(event && event.tempFilePath && !this.readAlongFrameSupported);
      this.setData({ readAlongStatus: hasVoice ? "已跟读" : "没听到声音" });
      this.continueAfterReadAlongWindow();
    });
    recorder.onError(() => {
      this.readAlongActive = false;
      this.readAlongTimer = null;
      this.setData({ readAlongStatus: "可手动跟读" });
      this.continueAfterReadAlongWindow();
    });
    return recorder;
  },

  startReadAlongWindow(wordId) {
    if (!wordId) return;
    if (isDevtoolsRuntime()) {
      // DevTools recordings use a different file format (debug-only) and emit a
      // console notice; skip the microphone window there but keep the loop pace.
      this.currentReadAlongWordId = wordId;
      this.readAlongTimer = setTimeout(() => {
        this.readAlongTimer = null;
        this.continueAfterReadAlongWindow();
      }, READ_ALONG_DURATION_MS);
      return;
    }
    const recorder = this.prepareRecorder();
    if (!recorder) {
      this.continueAfterReadAlongWindow();
      return;
    }
    this.currentReadAlongWordId = wordId;
    this.ensureRecordPermission(() => {
      if (this.readAlongActive || this.readAlongTimer) this.stopReadAlong({ silent: true });
      this.currentReadAlongWordId = wordId;
      this.readAlongFrameSupported = false;
      this.readAlongHasVoice = false;
      try {
        recorder.start({
          duration: READ_ALONG_DURATION_MS,
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 48000,
          format: "PCM",
          frameSize: 1
        });
        this.readAlongTimer = setTimeout(() => this.stopReadAlong(), READ_ALONG_DURATION_MS + 120);
      } catch (error) {
        this.setData({ readAlongStatus: "可手动跟读" });
        this.continueAfterReadAlongWindow();
      }
    });
  },

  stopReadAlong(options = {}) {
    if (this.readAlongTimer) {
      clearTimeout(this.readAlongTimer);
      this.readAlongTimer = null;
    }
    if (!this.recorder || !this.readAlongActive) return;
    if (options.silent) this.ignoreNextReadAlongStop = true;
    try {
      this.recorder.stop();
    } catch (error) {
      // Recorder may already be stopped; keep the learning flow uninterrupted.
    }
  },

  hasVoiceInFrame(frameBuffer) {
    if (!frameBuffer || frameBuffer.byteLength < 2) return false;
    this.readAlongFrameSupported = true;
    const view = new DataView(frameBuffer);
    for (let offset = 0; offset + 1 < frameBuffer.byteLength; offset += 2) {
      if (Math.abs(view.getInt16(offset, true)) >= READ_ALONG_VOICE_THRESHOLD) return true;
    }
    return false;
  },

  continueAfterReadAlongWindow() {
    if (this.data.view !== VIEWS.WORD_STUDY || !this.data.studyAudioEnabled) return;
    const word = flow.getCurrentStudyWord(this.state);
    if (!word || this.studyPlaybackWordId !== word.id) return;
    if (this.currentReadAlongWordId !== word.id) return;
    const targetCount = pronunciationLoopCountFor(this.state);
    const shouldContinue = targetCount === Infinity || (this.studyPlaybackCount || 0) < targetCount;
    if (shouldContinue) {
      this.autoPlayTimer = setTimeout(() => {
        this.autoPlayTimer = null;
        this.playStudyAudio(word.id);
      }, READ_ALONG_REPLAY_DELAY_MS);
      return;
    }
    this.setData({ readAlongStatus: `已完成 ${targetCount} 遍，点击记住了继续` });
  },

  configureAudioPlayback(done) {
    const finish = typeof done === "function" ? done : null;
    if (this.audioPlaybackConfigured) {
      if (finish) finish();
      return;
    }
    const markReady = () => {
      this.audioPlaybackConfigured = true;
      if (finish) finish();
    };
    const app = typeof getApp === "function" ? getApp() : null;
    if (app && typeof app.configureAudioPlayback === "function") {
      app.configureAudioPlayback(markReady);
      return;
    }
    if (typeof wx !== "undefined" && typeof wx.setInnerAudioOption === "function") {
      if (isDevtoolsRuntime()) {
        markReady();
        return;
      }
      let fallbackTimer = null;
      const complete = () => {
        if (this.audioPlaybackConfigured) return;
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        markReady();
      };
      fallbackTimer = setTimeout(complete, 120);
      wx.setInnerAudioOption({
        mixWithOther: true,
        obeyMuteSwitch: false,
        speakerOn: true,
        success: complete,
        fail: complete
      });
      return;
    }
    markReady();
  },

  openDetailById(wordId) {
    const word = flow.getWordById(wordId);
    if (!word) return;
    this.setData({
      detail: Object.assign({}, word, {
        meaningText: word.cn.join("，"),
        tagText: (word.tags || []).join("、"),
        syllables: word.syllables || word.word,
        memoryImage: word.memoryImage || {
          meaning: word.cn.join("，"),
          pos: displayPosFor(word),
          scene: "用一个具体画面帮助记住这个释义"
        },
        curriculumStage: word.curriculumStage || stageLabel(word.starLevel),
        usage: buildUsageContent(word, this.state)
      })
    });
  }
});

function buildHomeData(state) {
  const result = state.assessment.result;
  const wordStates = objectValues(state.userWordStates);
  const wrongBook = buildWrongBookData(state);
  const weakCount = wrongBook.count;
  const learnedCount = wordStates.filter((wordState) => wordState.familiarity > 0).length;
  const todayDone = (state.daily.sessionCompletedWordIds || []).length;
  const todayLists = Math.floor(todayDone / 9);
  const planCount = getDailyTargetListCount(state);
  const displayTotal = Math.max(wordDatasetMeta.total || 3500, 3500);
  const progressPercent = Math.min(100, Math.round((learnedCount / Math.max(displayTotal, 1)) * 100));
  const reviewCount = (state.daily.mixedReviewWordIds || []).length;
  const nextTask = buildNextTaskText(state, todayLists, weakCount);
  const primaryActionText = buildPrimaryActionText(state, nextTask);
  return {
    userName: state.user.name,
    hasSelectedLevel: hasSelectedWordLevel(state),
    heroClass: hasSelectedWordLevel(state) ? "normal" : "new-user",
    levelLabel: state.user.wordLevelLabel || "未选择水平",
    startLevelLabel: state.user.wordLevelLabel || "未选择",
    vocabulary: result ? result.vocabulary : "未测",
    testLabel: result ? `${result.stage} · ${result.accuracy}%` : "独立诊断入口",
    learnedCount,
    progressPercent,
    progressText: `${learnedCount} / ${wordDatasetMeta.total}`,
    weakCount,
    todayDone,
    todayGroups: todayLists,
    todayLists,
    dailyGoalMet: todayLists >= planCount,
    planCount,
    planFlags: Array.from({ length: Math.min(planCount, 6) }, (_, index) => index < todayLists ? "done" : "todo"),
    planWordCount: planCount * 9,
    screenedCount: (state.daily.learningWordIds || []).length,
    screenTargetCount: state.daily.dailyTargetWordCount || planCount * 9,
    reviewCount,
    nextTask,
    primaryActionText,
    streakDays: state.user.streakDays,
    streakText: getRewardStreakText(state),
    badges: (state.user.badges || []).length ? state.user.badges.join("、") : "今日完成后获得起步徽章",
    groupName: wordDatasetMeta.groupName,
    bookTitle: "高考课标 3500",
    total: wordDatasetMeta.total,
    displayTotal,
    miniProgramTotal: wordDatasetMeta.miniProgramTotal,
    dictionary: wordDatasetMeta.dictionary.source
  };
}

function buildProfileData(state) {
  const result = state.assessment.result;
  const wordStates = objectValues(state.userWordStates);
  const learnedCount = wordStates.filter((wordState) => wordState.familiarity > 0).length;
  const wrongBook = buildWrongBookData(state);
  const weakCount = wrongBook.count;
  const todayDone = (state.daily.sessionCompletedWordIds || []).length;
  const todayMinutes = todayDone ? Math.max(3, todayDone * 2) : 0;
  const dailyTargetListCount = getDailyTargetListCount(state);
  const checkins = state.user.checkins || {};
  const week = buildCalendarWeek(checkins);
  const checkinDays = Object.keys(checkins).filter((dateKey) => checkins[dateKey] && checkins[dateKey].completed).length;
  const displayTotal = Math.max(wordDatasetMeta.total || 3500, 3500);
  const progressPercent = Math.min(100, Math.round((learnedCount / Math.max(displayTotal, 1)) * 100));
  const settings = state.user.settings || {};
  const sleepTime = settings.sleepTime || "22:00";
  const wakeTime = settings.wakeTime || "06:00";
  const wrongReminderEnabled = settings.wrongReminderEnabled !== false;
  const wrongReminderTime = settings.wrongReminderTime || "19:00";
  const loopValues = [3, 6, 9, 0];
  const currentLoop = Number(settings.pronunciationLoopCount ?? 3);
  const loopIndex = Math.max(0, loopValues.indexOf(currentLoop));
  return {
    userName: state.user.name,
    vocabulary: result ? result.vocabulary : "未测",
    vocabularyRange: result?.vocabularyRange || null,
    levelLabel: state.user.wordLevelLabel || "未选择",
    startLevelLabel: state.user.wordLevelLabel || "未选择",
    activeGroup: state.user.activeGroup || wordDatasetMeta.groupName,
    bookTitle: "高考课标 3500",
    total: wordDatasetMeta.total,
    miniProgramTotal: wordDatasetMeta.miniProgramTotal,
    learnedCount,
    displayTotal,
    progressPercent,
    progressText: `${learnedCount} / ${displayTotal}`,
    weakCount,
    todayDone,
    stageTestCount: flow.getStageTestCount(state),
    listGroupCount: dailyTargetListCount,
    dailyTargetListCount,
    listWordCount: dailyTargetListCount * 9,
    dailyTargetLabel: `${dailyTargetListCount} 个 List`,
    dailyTargetRange: Array.from({ length: MAX_DAILY_TARGET_LISTS }, (_, index) => `${index + 1} 个 List`),
    dailyTargetIndex: Math.min(Math.max(dailyTargetListCount - 1, 0), MAX_DAILY_TARGET_LISTS - 1),
    pronunciationLoopLabel: pronunciationLoopLabelFor(state),
    pronunciationLoopOptions: pronunciationLoopOptionsFor(state),
    loopRange: ["3 遍", "6 遍", "9 遍", "无限循环"],
    loopIndex,
    learningThemeLabel: learningThemeLabelFor(state),
    learningThemeOptions: learningThemeOptionsFor(state),
    sleepTime,
    wakeTime,
    wrongReminderEnabled,
    wrongReminderTime,
    wrongReminderLabel: wrongReminderEnabled ? `每日 ${wrongReminderTime}` : "已关闭",
    todayMinutes,
    totalMinutes: learnedCount * 2,
    streakDays: state.user.streakDays,
    longestStreak: state.user.longestStreak || 0,
    checkinDays,
    week
  };
}

function getListGroupCount(state) {
  return getDailyTargetListCount(state) * 3;
}

function getDailyTargetListCount(state) {
  const count = Number(state.user?.settings?.dailyTargetListCount || state.daily?.dailyTargetListCount || 1);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
}

function pronunciationLoopCountFor(state) {
  const count = Number(state.user?.settings?.pronunciationLoopCount ?? 3);
  if (count === 0) return Infinity;
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 3;
}

function pronunciationLoopLabelFor(state) {
  const count = pronunciationLoopCountFor(state);
  return count === Infinity ? "无限循环" : `${count} 遍`;
}

function pronunciationLoopOptionsFor(state) {
  const current = Number(state.user?.settings?.pronunciationLoopCount ?? 3);
  return [
    { value: 3, label: "3 遍" },
    { value: 6, label: "6 遍" },
    { value: 9, label: "9 遍" },
    { value: 0, label: "无限" }
  ].map((option) => Object.assign({}, option, { selected: option.value === current }));
}

function learningThemeLabelFor(state) {
  return state.user?.settings?.learningTheme === "light" ? "浅色" : "深色";
}

function learningThemeOptionsFor(state) {
  const current = state.user?.settings?.learningTheme === "light" ? "light" : "dark";
  return [
    { value: "dark", label: "深色" },
    { value: "light", label: "浅色" }
  ].map((option) => Object.assign({}, option, { selected: option.value === current }));
}

function buildNextTaskText(state, todayLists, weakCount) {
  if (!hasSelectedWordLevel(state)) return "先选择单词水平";
  if (state.daily && state.daily.startedAt && !state.daily.completed && flow.getCurrentStudyWord(state)) {
    return "继续当前 list";
  }
  if (state.daily && state.daily.startedAt && !state.daily.completed && !state.daily.precheckCompleted) {
    return "继续筛词";
  }
  if (weakCount > 0 && state.user?.settings?.wrongReminderEnabled !== false) {
    return "复习错词本";
  }
  return todayLists > 0 ? "继续下一个 list" : "开始今天的 list";
}

function buildPrimaryActionText(state, nextTask) {
  if (!hasSelectedWordLevel(state)) return "选择学习水平";
  if (state.daily && state.daily.completed) return "查看今日成果";
  if (state.daily && state.daily.sessionCompletedWordIds && state.daily.sessionCompletedWordIds.length > 0) return "继续";
  if (nextTask && nextTask.includes("筛词")) return "继续筛词";
  if (nextTask && nextTask.includes("继续")) return "继续学习";
  return "开始今日学习";
}

function currentDailyResumeView(state) {
  if (!state || !state.daily || !state.daily.startedAt || state.daily.completed) return "";
  if (!isSameLocalDay(state.daily.startedAt)) return "";
  if (!state.daily.precheckCompleted) return VIEWS.PRECHECK;
  if (state.daily.reviewPhase === "mixed" && flow.getCurrentMixedReviewQuestion(state)) return VIEWS.GROUP_REVIEW;
  if (flow.getCurrentGroupReviewQuestion(state)) return VIEWS.GROUP_REVIEW;
  if (flow.getCurrentAudioQuestion(state)) return VIEWS.AUDIO_MEANING;
  if (flow.getCurrentMeaningRecallQuestion(state)) return VIEWS.MEANING_RECALL;
  if (flow.getCurrentStudyWord(state)) return VIEWS.WORD_STUDY;
  return "";
}

function isSameLocalDay(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;
  return localDateKey(date) === localDateKey(new Date());
}

function buildCalendarWeek(checkins, now) {
  const today = now || new Date();
  const weekStart = startOfWeek(today);
  const labels = ["一", "二", "三", "四", "五", "六", "日"];
  return labels.map((day, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dateKey = localDateKey(date);
    const checkin = checkins[dateKey] || {};
    return {
      key: dateKey,
      day,
      date: String(date.getDate()),
      isToday: dateKey === localDateKey(today),
      active: Boolean(checkin.completed),
      completedGroups: checkin.completedGroups || 0,
      learnedWords: checkin.learnedWords || 0
    };
  });
}

function buildMonthProgressData(state, cursor) {
  const checkins = state.user.checkins || {};
  const current = cursor || new Date();
  const year = current.getFullYear();
  const month = current.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const leadingCount = new Date(year, month, 1).getDay(); // Sunday-first: 0..6
  const todayKey = localDateKey(new Date());
  const cells = [];
  // Previous-month tail days fill the first week (shown muted).
  for (let i = 0; i < leadingCount; i += 1) {
    const day = prevMonthDays - leadingCount + 1 + i;
    cells.push({ key: `lead-${day}`, day, otherMonth: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = localDateKey(new Date(year, month, day));
    const checkin = checkins[dateKey] || {};
    cells.push({
      key: dateKey,
      day,
      active: Boolean(checkin.completed),
      isToday: dateKey === todayKey,
      completedGroups: checkin.completedGroups || 0,
      learnedWords: checkin.learnedWords || 0
    });
  }
  // Next-month head days pad the final week to a full row of seven.
  for (let day = 1; cells.length % 7 !== 0; day += 1) {
    cells.push({ key: `trail-${day}`, day, otherMonth: true });
  }
  const monthCells = cells.filter((cell) => !cell.otherMonth);
  const activeCells = monthCells.filter((cell) => cell.active);
  return {
    title: `${year}年 ${month + 1}月`,
    pickerValue: `${year}-${String(month + 1).padStart(2, "0")}`,
    weekdays: ["日", "一", "二", "三", "四", "五", "六"],
    cells,
    checkinDays: activeCells.length,
    learnedWords: activeCells.reduce((sum, cell) => sum + cell.learnedWords, 0),
    completedGroups: activeCells.reduce((sum, cell) => sum + cell.completedGroups, 0),
    trend: buildMonthTrend(year, month, checkins, todayKey),
    stageTestCount: flow.getStageTestCount(state)
  };
}

// Weeks run Monday..Sunday (per the chart caption). Each week's value is the
// learned-word total for that week's days inside the displayed month.
function buildMonthTrend(year, month, checkins, todayKey) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstMondayOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const weekCount = Math.floor((firstMondayOffset + daysInMonth - 1) / 7) + 1;
  const values = new Array(weekCount).fill(0);
  let todayWeek = -1;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const weekIndex = Math.floor((firstMondayOffset + day - 1) / 7);
    const dateKey = localDateKey(new Date(year, month, day));
    values[weekIndex] += (checkins[dateKey] || {}).learnedWords || 0;
    if (dateKey === todayKey) todayWeek = weekIndex;
  }
  const labels = values.map((_, index) => (index === todayWeek ? "本周" : `第${index + 1}周`));
  return buildLineChart(values, labels);
}

const CHART_PAD_X = 30;
const CHART_PLOT_W = 520;
const CHART_TOP = 44;
const CHART_PLOT_H = 150;
const CHART_LINE_HALF = 2;

function buildLineChart(values, labels) {
  const count = values.length;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = CHART_PAD_X + (count > 1 ? index / (count - 1) : 0.5) * CHART_PLOT_W;
    const y = CHART_TOP + (1 - value / max) * CHART_PLOT_H;
    return { key: `pt-${index}`, x: Math.round(x), y: Math.round(y), value, label: labels[index] };
  });
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    segments.push({
      key: `seg-${index}`,
      x: from.x,
      y: from.y - CHART_LINE_HALF,
      width: Math.round(Math.sqrt(dx * dx + dy * dy)),
      angle: Math.round((Math.atan2(dy, dx) * 180 / Math.PI) * 100) / 100
    });
  }
  return {
    width: CHART_PAD_X * 2 + CHART_PLOT_W,
    height: CHART_TOP + CHART_PLOT_H + 10,
    padX: CHART_PAD_X,
    points,
    segments
  };
}

function startOfWeek(date) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildLevelSelectData(state) {
  const currentId = state.user.wordLevelId || "";
  return {
    currentLevel: state.user.wordLevelLabel || "未选择",
    options: WORD_LEVEL_OPTIONS.map((option) => Object.assign({}, option, {
      selected: option.id === currentId,
      iconClass: `icon-level-${option.id}`,
      iconSrc: `../../assets/icons/levels/${option.id}.svg`
    }))
  };
}

function hasSelectedWordLevel(state) {
  return Boolean(state && state.user && state.user.wordLevelId === "senior");
}

function buildTestData(state) {
  const question = flow.getCurrentTestQuestion(state);
  const answered = state.assessment.answers.length;
  const correct = state.assessment.answers.filter((answer) => answer.isCorrect).length;
  const isStage = state.assessment.mode === "stage";
  const total = isStage ? (state.assessment.questions.length || 1) : 36;
  const current = Math.min(answered + 1, total);
  return {
    question,
    isStage,
    kindLabel: isStage ? "阶段测" : "入学测",
    current,
    total,
    percent: Math.round((current / total) * 100),
    progress: `${current}/${total}`,
    correct,
    wrong: answered - correct,
    remain: total - answered,
    options: question
      ? question.options
          .filter((option) => option !== "不认识")
          .map((option, index) => ({ value: option, label: "ABCD"[index] || "", text: option }))
      : []
  };
}

function buildTestResultData(state) {
  const result = state.assessment.result || {};
  if (result.mode === "stage") {
    const accuracy = typeof result.accuracy === "number" ? result.accuracy : 0;
    const encouragement = accuracy >= 80
      ? "掌握得很扎实，保持节奏"
      : (accuracy >= 50 ? "已学词大体记住了，错的明天复习一下" : "趁热打铁复习一遍，很快就稳了");
    return {
      isStage: true,
      total: result.total,
      correct: result.correct,
      wrong: result.wrong,
      accuracy,
      encouragement
    };
  }
  const range = result.vocabularyRange || {};
  const lower = range.lower;
  const upper = range.upper;
  let vocabulary = result.vocabulary || "未测";
  if (typeof lower === "number" && typeof upper === "number") {
    vocabulary = lower >= upper ? `${lower}+` : `${lower}–${upper}`;
  }
  const accuracy = typeof result.accuracy === "number" ? result.accuracy : 0;
  const encouragement = accuracy >= 80
    ? "信心不错，持续学习会更准"
    : (accuracy >= 50 ? "基础不错，按计划学就好" : "从基础稳稳开始，会越来越好");
  return Object.assign({}, result, {
    vocabulary,
    startLevelLabel: result.startLevelLabel || "高中必修词",
    encouragement
  });
}

function buildPrecheckData(state) {
  const selectedIds = state.daily.learningWordIds || [];
  const targetCount = state.daily.dailyTargetWordCount || getDailyTargetListCount(state) * 9;
  const candidates = state.daily.candidateWordIds
    .map(flow.getWordById)
    .filter((word) => word && !state.daily.completedWordIds.includes(word.id) && !state.daily.precheck[word.id])
    .slice(0, 1)
    .map((word, index) => ({
      id: word.id,
      word: word.word,
      headword: word.headword || word.lemma || word.word,
      syllables: word.syllables || word.word,
      ipa: word.ipa,
      pos: displayPosFor(word),
      rawPos: word.pos,
      cn: word.cn,
      memoryImage: word.memoryImage || { meaning: word.cn.join("，"), pos: displayPosFor(word) },
      example_en: word.example_en || "",
      example_cn: word.example_cn || "",
      collocations: word.collocations || [],
      level: word.level || (word.starLevel === 0 ? "foundation" : "high_school"),
      curriculumStage: word.curriculumStage || stageLabel(word.starLevel),
      starLevel: word.starLevel,
      sourceIndex: word.sourceIndex,
      tags: word.tags || [],
      index: index + 1,
      selected: selectedIds.includes(word.id),
      status: state.daily.precheck[word.id] || "",
      meaningText: word.cn.join("，")
    }));
  return {
    candidates,
    selectedCount: selectedIds.length,
    targetCount,
    progressText: `已筛出 ${selectedIds.length}/${targetCount}`,
    canStart: selectedIds.length >= targetCount
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
    word: word ? decorateWord(word, state) : null,
    progress: `${current}/${total}`,
    progressDots: buildProgressDots(current, total, "study"),
    groupContext: buildGroupContext(state),
    themeClass: learningThemeClassFor(state)
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
      word: word ? decorateWord(word, state) : null,
      count: state.daily.mixedReviewWordIds.length,
      progress: question ? `${state.daily.mixedIndex + 1}/${state.daily.mixedQuestions.length}` : "",
      progressDots: question ? buildProgressDots(state.daily.mixedIndex + 1, state.daily.mixedQuestions.length, "mixed") : [],
      groupContext: buildGroupContext(state),
      themeClass: learningThemeClassFor(state)
    };
  }
  const question = flow.getCurrentGroupReviewQuestion(state);
  const word = question ? flow.getWordById(question.wordId) : null;
  return {
    isMixed: false,
    question: decorateQuestion(question, word),
    word: word ? decorateWord(word, state) : null,
    count: state.daily.selectedWordIds.length,
    progress: question ? `${state.daily.groupIndex + 1}/${state.daily.groupQuestions.length}` : "",
    progressDots: question ? buildProgressDots(state.daily.groupIndex + 1, state.daily.groupQuestions.length, "review") : [],
    groupContext: buildGroupContext(state),
    themeClass: learningThemeClassFor(state)
  };
}

function buildMixedTransitionData(state) {
  if (state.daily.reviewPhase !== "mixed") return null;
  if (state.daily.mixedIndex !== 0) return null;
  if (!state.daily.mixedReviewWordIds.length) return null;
  const activeMixedReview = state.daily.activeMixedReview || {};
  return {
    key: `${state.daily.startedAt}_${state.daily.mixedReviewWordIds.join("_")}`,
    title: activeMixedReview.label || `${state.daily.mixedReviewWordIds.length} 词混组复习`,
    hint: `共 ${state.daily.mixedReviewWordIds.length} 个词`
  };
}

function buildAudioData(state) {
  const question = flow.getCurrentAudioQuestion(state);
  const word = question ? flow.getWordById(question.wordId) : null;
  return {
    question: decorateQuestion(question, word),
    word: word ? decorateWord(word, state) : null,
    progress: question ? `${state.daily.audioIndex + 1}/${state.daily.audioQuestions.length}` : "",
    progressDots: question ? buildProgressDots(state.daily.audioIndex + 1, state.daily.audioQuestions.length, "audio") : [],
    groupContext: buildGroupContext(state),
    themeClass: learningThemeClassFor(state)
  };
}

function buildMeaningRecallData(state) {
  const question = flow.getCurrentMeaningRecallQuestion(state);
  const word = question ? flow.getWordById(question.wordId) : null;
  return {
    question,
    word: word ? decorateWord(word, state) : null,
    progress: question ? `${state.daily.recallIndex + 1}/${state.daily.recallQuestions.length}` : "",
    progressDots: question ? buildProgressDots(state.daily.recallIndex + 1, state.daily.recallQuestions.length, "recall") : [],
    groupContext: buildGroupContext(state),
    themeClass: learningThemeClassFor(state)
  };
}

const MAX_PROGRESS_DOTS = 9;

function buildProgressDots(current, total, phase) {
  const count = Math.max(0, Number(total || 0));
  const active = Math.max(1, Number(current || 1));
  // Cap the row at MAX_PROGRESS_DOTS as a sliding window centred on the current
  // dot; as you progress, the left-most dots drop off. The row stays centred.
  let start = 0;
  let end = count;
  if (count > MAX_PROGRESS_DOTS) {
    const half = Math.floor(MAX_PROGRESS_DOTS / 2);
    start = Math.min(Math.max(active - 1 - half, 0), count - MAX_PROGRESS_DOTS);
    end = start + MAX_PROGRESS_DOTS;
  }
  const dots = [];
  for (let index = start; index < end; index += 1) {
    dots.push({
      key: `${phase}-${index}`,
      className: index + 1 < active ? "done" : (index + 1 === active ? "current" : "todo")
    });
  }
  return dots;
}

function buildFocusPauseData(state) {
  const targetWords = getDailyTargetListCount(state) * 9;
  const completedWords = (state.daily.completedGroups || []).length * 3;
  const currentGroupWords = state.daily.selectedWordIds ? Math.min(state.daily.studyIndex || 0, state.daily.selectedWordIds.length) : 0;
  return {
    learnedText: `已学 ${Math.min(targetWords, completedWords + currentGroupWords)} / ${targetWords} 词`
  };
}

function learningThemeClassFor() {
  return "learning-light";
}

function buildGroupContext(state) {
  const completedCount = (state.daily.completedGroups || []).length;
  const targetCount = state.daily.listTargetGroupCount || getListGroupCount(state);
  const activeMixedReview = state.daily.activeMixedReview || {};
  const isMixed = state.daily.reviewPhase === "mixed" && state.daily.mixedQuestions && state.daily.mixedQuestions.length;
  const currentGroupNumber = isMixed
    ? completedCount
    : Math.min(completedCount + 1, targetCount || completedCount + 1);
  return {
    currentLabel: `当前第 ${currentGroupNumber}/${targetCount} 组`,
    mixedLabel: isMixed ? `本次混组：${activeMixedReview.groupLabel || activeMixedReview.label || "前面已学组"}` : ""
  };
}

function buildWrongBookData(state) {
  const words = objectEntries(state.userWordStates)
    .filter((entry) => entry[1].wrongCount > 0)
    .map((entry) => ({ word: flow.getWordById(entry[0]), wordState: entry[1] }))
    .filter((item) => item.word)
    .sort((a, b) => b.wordState.wrongCount - a.wordState.wrongCount)
    .map((item) => Object.assign({}, decorateWord(item.word, state), {
      wrongCount: item.wordState.wrongCount,
      memorized: item.wordState.lastResult === "correct"
    }));
  const daily = state.daily || {};
  const emptyActionText = daily.completed
    ? "查看今日成果"
    : (daily.startedAt ? "继续今日学习" : "开始今日学习");
  return { words, count: words.length, emptyActionText };
}

function buildReportData(state) {
  const report = state.lastReport || buildDailyReport(state, require("../../data/words").words);
  const wordStates = objectValues(state.userWordStates);
  const totalLearned = wordStates.filter((wordState) => wordState.familiarity > 0).length;
  const displayTotal = Math.max(wordDatasetMeta.total || 3500, 3500);
  return Object.assign({}, report, {
    weakWordText: report.weakWords.length ? report.weakWords.map((word) => word.word).join("、") : "本轮没有新增错词",
    badgeText: (state.user.badges || []).length ? state.user.badges.join("、") : "暂无",
    todayLists: Math.max(1, Math.floor((state.daily.sessionCompletedWordIds || []).length / 9)),
    doneWords: (state.daily.sessionCompletedWordIds || []).length,
    doneHours: Math.max(0.1, Math.round((Math.max(3, (state.daily.sessionCompletedWordIds || []).length * 2) / 60) * 10) / 10),
    streakDays: state.user.streakDays || 1,
    totalLearned,
    displayTotal,
    progressPercent: Math.min(100, Math.round((totalLearned / Math.max(displayTotal, 1)) * 100)),
    bookTitle: "高考课标 3500",
    badgeName: "专注之星",
    badgePoints: 120
  });
}

function decorateWord(word, state) {
  const memoryImage = word.memoryImage || {};
  return Object.assign({}, word, {
    rawPos: word.pos,
    pos: displayPosFor(word),
    syllables: word.syllables || word.word,
    curriculumStage: word.curriculumStage || stageLabel(word.starLevel),
    meaningText: word.cn.join("，"),
    tagText: (word.tags || []).join("、"),
    scene: memoryImage.scene || "用一个具体画面帮助记住这个释义",
    memoryMeaning: memoryImage.meaning || word.cn.join("，"),
    usage: buildUsageContent(word, state)
  });
}

function buildUsageContent(word, state) {
  const usage = usageByWordId[word.id] || word.usage || {};
  let collocations = normaliseCollocations(usage.collocations || word.collocations || []);
  let example = normaliseExample(usage.example || buildLegacyExample(word));
  let aiGenerated = hasAiGeneratedContent(collocations) || isAiGenerated(example);
  const hasDictionaryContent = collocations.length > 0 || Boolean(example);
  const canShowAiFallback = isBetaUser(state) || isApproved(usage.aiFallback);

  if (!hasDictionaryContent && canShowAiFallback && usage.aiFallback) {
    collocations = normaliseCollocations(usage.aiFallback.collocations || []);
    example = normaliseExample(usage.aiFallback);
    aiGenerated = true;
  }

  const visible = collocations.length > 0 || Boolean(example);
  return {
    visible,
    hasUsageContent: visible,
    collocations: collocations.slice(0, 3),
    example,
    aiGenerated,
    aiLabel: aiGenerated ? "由 AI 生成" : ""
  };
}

function buildVisualRegressionFixture(pageId) {
  const id = String(pageId || "05-home-normal");
  const state = createVisualBaseState();
  const fixture = { state, view: VIEWS.HOME, patch: {} };

  if (id === "01-new-user-home") {
    state.user.wordLevelId = "";
    state.user.wordLevelLabel = "";
    state.user.levelId = "";
    state.user.levelLabel = "";
    state.user.learningStartLevel = "";
    state.user.learningStartLevelLabel = "";
    return fixture;
  }

  if (id === "02-level-select") {
    fixture.view = VIEWS.LEVEL_SELECT;
    return fixture;
  }

  if (id === "03-entry-assessment") {
    flow.startAssessment(state, "visual-assessment");
    fixture.view = VIEWS.TEST;
    return fixture;
  }

  if (id === "04-assessment-result") {
    flow.startAssessment(state, "visual-assessment-result");
    completeVisualAssessment(state);
    state.assessment.result = Object.assign({}, state.assessment.result, {
      vocabulary: "1500-2100",
      vocabularyRange: { lower: 1500, upper: 2100 },
      stage: "建议从高中必修词开始",
      startLevelLabel: "高中必修词",
      advice: "后续会结合真实学习表现校准"
    });
    fixture.view = VIEWS.TEST_RESULT;
    return fixture;
  }

  if (id === "05-home-normal") {
    seedVisualProgress(state);
    return fixture;
  }

  if (id === "06-pre-learning-scan") {
    prepareVisualDaily(state);
    fixture.view = VIEWS.PRECHECK;
    return fixture;
  }

  if (id === "07-memorize") {
    prepareVisualStudy(state);
    fixture.view = VIEWS.WORD_STUDY;
    return fixture;
  }

  if (id === "08-word-detail-modal") {
    const word = prepareVisualStudy(state);
    fixture.view = VIEWS.WORD_STUDY;
    fixture.patch = {
      detail: Object.assign({}, decorateWord(word, state), {
        memoryImage: word.memoryImage || {
          meaning: word.cn.join("，"),
          pos: displayPosFor(word),
          scene: "用一个具体画面帮助记住这个释义"
        },
        usage: buildUsageContent(word, state)
      })
    };
    return fixture;
  }

  if (id === "09-recall-before-reveal") {
    prepareVisualGroupReview(state);
    fixture.view = VIEWS.GROUP_REVIEW;
    fixture.patch = { reviewAnswerVisible: false };
    return fixture;
  }

  if (id === "10-recall-after-reveal") {
    prepareVisualGroupReview(state);
    fixture.view = VIEWS.GROUP_REVIEW;
    fixture.patch = { reviewAnswerVisible: true };
    return fixture;
  }

  if (id === "11-listening") {
    prepareVisualAudio(state);
    fixture.view = VIEWS.AUDIO_MEANING;
    fixture.patch = { audioAnswerVisible: true };
    return fixture;
  }

  if (id === "12-list-complete-animation") {
    prepareVisualDaily(state);
    state.daily.groupFeedback = "本组识记已完成，自动进入下一组";
    fixture.view = VIEWS.PRECHECK;
    fixture.patch = { precheckNotice: state.daily.groupFeedback };
    return fixture;
  }

  if (id === "13-wrong-words") {
    seedVisualWrongWords(state);
    fixture.view = VIEWS.WRONG_BOOK;
    return fixture;
  }

  if (id === "14-celebration") {
    seedVisualProgress(state);
    state.lastReport = buildVisualReport();
    fixture.view = VIEWS.DAILY_REPORT;
    return fixture;
  }

  if (id === "15-profile-settings") {
    seedVisualProgress(state);
    fixture.view = VIEWS.PROFILE;
    return fixture;
  }

  if (id === "16-monthly-stage-test") {
    seedVisualProgress(state);
    fixture.view = VIEWS.MONTH_PROGRESS;
    return fixture;
  }

  seedVisualProgress(state);
  return fixture;
}

function createVisualBaseState() {
  const state = resetState();
  state.user.wordLevelId = "senior";
  state.user.wordLevelLabel = "高中";
  state.user.levelId = "senior";
  state.user.levelLabel = "高中";
  state.user.level = "高中";
  state.user.learningStartLevel = "required";
  state.user.learningStartLevelLabel = "高考 3500 词";
  state.user.manualStartLevel = "required";
  state.user.settings.learningTheme = "light";
  state.user.settings.themeDefaultVersion = 2;
  state.user.settings.dailyTargetListCount = 4;
  state.user.settings.listGroupCount = 12;
  state.user.settings.pronunciationLoopCount = 3;
  state.user.streakDays = 3;
  state.user.longestStreak = 9;
  state.user.checkins = buildVisualCheckins();
  return state;
}

function buildVisualCheckins() {
  const checkins = {};
  const today = new Date();
  [0, 1, 2, 4, 7, 9, 13, 17, 22].forEach((offset, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    checkins[localDateKey(date)] = {
      completed: true,
      completedGroups: index % 3 + 1,
      learnedWords: (index % 3 + 1) * 9
    };
  });
  return checkins;
}

function seedVisualProgress(state) {
  visualReferenceWords(120).forEach((word, index) => {
    state.userWordStates[word.id] = Object.assign(defaultVisualWordState(), {
      familiarity: index % 5 + 1,
      wrongCount: index < 8 ? index % 3 + 1 : 0
    });
  });
  state.daily.sessionCompletedWordIds = visualReferenceWords(27).map((word) => word.id);
}

function seedVisualWrongWords(state) {
  visualReferenceWords(12).slice(3, 12).forEach((word, index) => {
    state.userWordStates[word.id] = Object.assign(defaultVisualWordState(), {
      familiarity: 2,
      wrongCount: index % 3 + 1,
      lastResult: "wrong"
    });
  });
}

function prepareVisualDaily(state) {
  flow.startDailyLearning(state);
  state.daily.candidateWordIds = visualReferenceWords(12).map((word) => word.id);
  return visualReferenceWords(1)[0];
}

function prepareVisualStudy(state) {
  prepareVisualDaily(state);
  state.daily.learningWordIds = visualReferenceWords(36).map((word) => word.id);
  flow.confirmPrecheck(state);
  return flow.getCurrentStudyWord(state);
}

function prepareVisualGroupReview(state) {
  prepareVisualStudy(state);
  while (flow.getCurrentStudyWord(state)) {
    flow.markStudyWord(state, 3);
  }
  flow.prepareGroupReviewQuestions(state);
}

function prepareVisualAudio(state) {
  prepareVisualGroupReview(state);
  flow.prepareAudioQuestions(state);
}

function completeVisualAssessment(state) {
  while (!state.assessment.completed) {
    const question = flow.getCurrentTestQuestion(state);
    if (!question) break;
    const shouldCorrect = state.assessment.answers.length % 4 !== 0;
    flow.answerAssessmentQuestion(state, shouldCorrect ? question.answer : "不认识");
  }
}

function buildVisualReport() {
  return {
    accuracy: 92,
    learnedCount: 80,
    mixedReviewCount: 4,
    audioCount: 12,
    nextReview: "今晚睡前",
    weakWords: visualReferenceWords(2),
    summary: "太棒了，今天的 List 都完成了。",
    completedAt: new Date().toISOString()
  };
}

function visualReferenceWords(count) {
  const allWords = flow.getAllWords();
  const preferred = [
    "abandon",
    "harvest",
    "ability",
    "abroad",
    "absence",
    "accept",
    "accident",
    "account",
    "achieve",
    "actual",
    "adapt",
    "addict"
  ];
  const picked = preferred
    .map((word) => allWords.find((item) => item.word === word))
    .filter(Boolean);
  const seen = {};
  const result = picked.concat(allWords).filter((word) => {
    if (!word || seen[word.id]) return false;
    seen[word.id] = true;
    return true;
  });
  return result.slice(0, count);
}

function defaultVisualWordState() {
  const now = new Date().toISOString();
  return {
    familiarity: 1,
    reviewStage: 1,
    lastSeenAt: now,
    lastReviewAt: now,
    nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
    lastResult: "correct",
    wrongCount: 0,
    reviewFailedThisRound: false
  };
}

function normaliseCollocations(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === "string") return { text: item, cn: "", contentType: "dictionary" };
      if (!item || typeof item !== "object") return null;
      const text = item.text || item.en || item.phrase || "";
      if (!text) return null;
      return {
        text,
        cn: item.cn || "",
        contentType: item.contentType || "dictionary",
        reviewStatus: item.reviewStatus || ""
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function normaliseExample(item) {
  if (!item || typeof item !== "object") return null;
  if (!item.en) return null;
  return {
    en: item.en,
    cn: item.cn || "",
    contentType: item.contentType || "dictionary",
    reviewStatus: item.reviewStatus || "",
    translationSource: item.translationSource || ""
  };
}

function buildLegacyExample(word) {
  if (!word.example_en) return null;
  return {
    en: word.example_en,
    cn: word.example_cn || "",
    contentType: "dictionary",
    translationSource: word.example_cn ? "dictionary" : ""
  };
}

function hasAiGeneratedContent(items) {
  return items.some((item) => isAiGenerated(item));
}

function isAiGenerated(item) {
  return Boolean(item && item.contentType === "ai_fallback");
}

function isApproved(item) {
  return Boolean(item && item.reviewStatus === "approved");
}

function isBetaUser(state) {
  return !state || !state.user || state.user.userType !== "official";
}

function stageLabel(starLevel) {
  if (starLevel === 1) return "高考核心词";
  if (starLevel === 2) return "高考提升词";
  return "高考基础补充词";
}

function decorateQuestion(question, word) {
  if (!question || !word) return null;
  const answer = word.cn.join("，");
  return Object.assign({}, question, {
    mode: question.mode || "visual",
    options: question.options.map((option) => ({
      value: option,
      pos: getMeaningPos(option),
      meaningText: option,
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
  return matched ? displayPosFor(matched) : "";
}

function displayPosFor(word) {
  return word?.displayPos || word?.pos || "";
}

function objectValues(source) {
  return Object.keys(source || {}).map((key) => source[key]);
}

function objectEntries(source) {
  return Object.keys(source || {}).map((key) => [key, source[key]]);
}
