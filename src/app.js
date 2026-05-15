import { words, getWordById, wordDatasetMeta } from "../data/words.js";
import { testQuestions } from "../data/test-questions.js";
import { speakWord } from "./audio.js";
import { VIEWS, showView, getCurrentView } from "./router.js";
import { buildDailyReport, getRewardStreakText } from "./report.js";
import { loadState, resetState, saveState } from "./storage.js";
import {
  answerAssessmentQuestion,
  answerAudioQuestion,
  answerMixedReviewQuestion,
  autoSelectPrecheckWords,
  completeMixedReview,
  confirmPrecheck,
  getCurrentAudioQuestion,
  getCurrentMixedReviewQuestion,
  getCurrentStudyWord,
  getCurrentTestQuestion,
  markPrecheck,
  markStudyWord,
  moveToNextMixedReviewQuestion,
  moveToNextAudioQuestion,
  prepareAudioQuestions,
  startAssessment,
  startDailyLearning,
  togglePrecheckWord
} from "./study-flow.js";

let state = loadState();
let detailReturnAction = null;
let detailWordId = null;
let detailTab = "collocations";
let testTimeoutId = null;
let slowTestQuestionId = null;
let lastAutoSpeakKey = null;

document.addEventListener("DOMContentLoaded", () => {
  bindGlobalActions();
  renderView(VIEWS.HOME);
  showView(VIEWS.HOME);
});

window.addEventListener("viewchange", (event) => renderView(event.detail.viewName));

function bindGlobalActions() {
  document.body.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const value = target.dataset.value;
    const wordId = target.dataset.wordId;

    if (action === "go-home") showView(VIEWS.HOME);
    if (action === "start-test") handleStartTest();
    if (action === "answer-test") handleAnswerTest(value);
    if (action === "start-daily") handleStartDaily();
    if (action === "toggle-precheck-word") handleTogglePrecheckWord(wordId);
    if (action === "mark-precheck") handleMarkPrecheck(wordId, value);
    if (action === "auto-select") handleAutoSelect();
    if (action === "confirm-precheck") handleConfirmPrecheck();
    if (action === "speak") handleSpeak(wordId);
    if (action === "mark-study") handleMarkStudy(Number(value));
    if (action === "start-review") showView(VIEWS.GROUP_REVIEW);
    if (action === "finish-review") handleFinishReview();
    if (action === "finish-mixed-review") handleFinishMixedReview();
    if (action === "answer-audio") handleAnswerAudio(value);
    if (action === "next-audio") handleNextAudio();
    if (action === "answer-mixed") handleAnswerMixed(value);
    if (action === "next-mixed") handleNextMixed();
    if (action === "open-wrong-book") saveAndRender(VIEWS.WRONG_BOOK);
    if (action === "open-detail") openDetail(wordId);
    if (action === "switch-detail-tab") switchDetailTab(value);
    if (action === "close-detail") closeDetail();
    if (action === "reset-data") handleReset();
  });
}

function renderView(viewName = getCurrentView()) {
  if (viewName !== VIEWS.TEST) clearTestTimer();
  const renderers = {
    [VIEWS.HOME]: renderHome,
    [VIEWS.TEST]: renderTest,
    [VIEWS.TEST_RESULT]: renderTestResult,
    [VIEWS.PRECHECK]: renderPrecheck,
    [VIEWS.WORD_STUDY]: renderWordStudy,
    [VIEWS.GROUP_REVIEW]: renderGroupReview,
    [VIEWS.AUDIO_MEANING]: renderAudioMeaning,
    [VIEWS.WRONG_BOOK]: renderWrongBook,
    [VIEWS.DAILY_REPORT]: renderDailyReport
  };
  renderers[viewName]?.();
}

function renderHome() {
  const result = state.assessment.result;
  const weakCount = Object.values(state.userWordStates).filter((wordState) => wordState.wrongCount > 0).length;
  const learnedCount = Object.values(state.userWordStates).filter((wordState) => wordState.familiarity > 0).length;
  const badges = state.user.badges.length ? state.user.badges.join("、") : "今日完成后获得起步徽章";
  const streakText = getRewardStreakText(state);
  const view = document.querySelector("#view-home");
  view.innerHTML = `
    <header class="topbar">
      <div>
        <p class="eyebrow">${state.user.name}</p>
        <h1>今日单词</h1>
      </div>
      <button class="icon-button" type="button" aria-label="重置体验数据" data-action="reset-data">↺</button>
    </header>
    <section class="hero-panel">
      <p class="section-label">今日任务</p>
      <h2>老师带着学生先选 3 个不熟词</h2>
      <button class="primary-button" type="button" data-action="start-daily">开始今日学习</button>
    </section>
    <section class="coach-strip" aria-label="人物合作流程">
      <article>
        <span>老师带学</span>
        <small>选词、讲图、纠错</small>
      </article>
      <article>
        <span>学生跟读</span>
        <small>识记、复述、辨义</small>
      </article>
    </section>
    <section class="stats-grid" aria-label="学习概览">
      <article class="metric">
        <span>${result ? result.vocabulary : "未测"}</span>
        <small>现实词汇量</small>
      </article>
      <article class="metric">
        <span>${learnedCount}</span>
        <small>已练单词</small>
      </article>
      <article class="metric">
        <span>${state.user.streakDays}</span>
        <small>连续打卡</small>
      </article>
    </section>
    <section class="info-strip" aria-label="学习规则">
      <article>
        <span>当前分组</span>
        <strong>${wordDatasetMeta.groupName}</strong>
        <small>教育部课标附录 2 · ${wordDatasetMeta.total} 词</small>
      </article>
      <article>
        <span>释义来源</span>
        <strong>${wordDatasetMeta.dictionary.source}</strong>
        <small>开源预填，学习型释义待二次编辑</small>
      </article>
      <article>
        <span>复习节奏</span>
        <strong>D+1 / D+3 / D+7</strong>
        <small>错词优先提前复习</small>
      </article>
    </section>
    <section class="info-strip single" aria-label="打卡奖励">
      <article>
        <span>打卡奖励</span>
        <strong>${streakText}</strong>
        <small>${state.user.streakDays > 0 ? badges : `历史最长 ${state.user.longestStreak} 天`}</small>
      </article>
    </section>
    <section class="action-list">
      <button class="list-button" type="button" data-action="start-test">
        <span>词汇量测试</span>
        <small>${result ? `${result.stage} · ${result.accuracy}%` : "独立诊断入口"}</small>
      </button>
      <button class="list-button" type="button" data-action="start-daily">
        <span>继续今日任务</span>
        <small>3 词识记、2 组 6 词混、3 组 9 词混</small>
      </button>
      <button class="list-button" type="button" data-action="open-wrong-book">
        <span>错词本</span>
        <small>${weakCount} 个待复习</small>
      </button>
    </section>
  `;
}

function renderTest() {
  const view = document.querySelector("#view-test");
  const question = getCurrentTestQuestion(state);
  if (!question) {
    view.innerHTML = "";
    return;
  }
  const answered = state.assessment.answers.length;
  const correct = state.assessment.answers.filter((answer) => answer.isCorrect).length;
  const wrong = answered - correct;
  view.innerHTML = `
    <header class="topbar compact">
      <button class="icon-button" type="button" aria-label="返回首页" data-action="go-home">‹</button>
      <div class="progress-label">${answered + 1}/${testQuestions.length}</div>
    </header>
    <section class="question-panel">
      <p class="section-label">词汇量测试</p>
      <h1 class="test-word">${question.word}</h1>
      <p class="muted">下面只选释义，不确定时点“不认识”</p>
      ${slowTestQuestionId === question.id ? `<p class="timeout-tip">停留太久可以选不认识</p>` : ""}
      <div class="option-stack">
        ${question.options.filter((option) => option !== "不认识").map((option) => `
          <button class="option-card" type="button" data-action="answer-test" data-value="${escapeAttr(option)}">${option}</button>
        `).join("")}
      </div>
      <div class="unknown-choice">
        <button class="secondary-button unknown-button" type="button" data-action="answer-test" data-value="不认识">我不认识</button>
      </div>
    </section>
    <footer class="counter-bar">
      <span class="pill green">${correct}</span>
      <span class="pill red">${wrong}</span>
      <span class="pill blue">${testQuestions.length - answered}</span>
    </footer>
  `;
  scheduleTestPrompt(question.id);
}

function renderTestResult() {
  const view = document.querySelector("#view-test-result");
  const result = state.assessment.result;
  if (!result) {
    view.innerHTML = "";
    return;
  }
  view.innerHTML = `
    <header class="topbar compact">
      <button class="icon-button" type="button" aria-label="返回首页" data-action="go-home">‹</button>
      <h1>测评结果</h1>
    </header>
    <section class="result-panel">
      <p class="section-label">现实掌握词汇</p>
      <strong class="vocab-number">${result.vocabulary}</strong>
      <div class="bar-chart" aria-label="词汇量对比图">
        <div class="bar target"><span>高中目标</span></div>
        <div class="bar current" style="height:${Math.min(92, Math.max(18, result.vocabulary / 40))}%"><span>当前</span></div>
      </div>
      <article class="copy-card">
        <h2>${result.stage}</h2>
        <p>正确率 ${result.accuracy}%，不认识 ${result.unknown} 个。${result.advice}</p>
      </article>
      <button class="primary-button" type="button" data-action="go-home">返回首页</button>
    </section>
  `;
}

function renderPrecheck() {
  const view = document.querySelector("#view-precheck");
  const candidates = state.daily.candidateWordIds
    .map(getWordById)
    .filter((word) => word
      && !state.daily.completedWordIds.includes(word.id)
      && state.daily.precheck[word.id] !== "known");
  const selectedCount = state.daily.selectedWordIds.length || 0;
  view.innerHTML = `
    <header class="topbar compact">
      <button class="icon-button" type="button" aria-label="返回首页" data-action="go-home">‹</button>
      <h1>训前检测</h1>
    </header>
    ${state.daily.groupFeedback ? `<section class="completion-burst">${state.daily.groupFeedback}</section>` : ""}
    <section class="word-list">
      ${candidates.map((word, index) => {
        const status = state.daily.precheck[word.id];
        return `
          <article class="precheck-row ${state.daily.selectedWordIds.includes(word.id) ? "picked" : ""}">
            <span class="index">${index + 1}</span>
            <button class="select-toggle ${state.daily.selectedWordIds.includes(word.id) ? "on" : ""}" type="button" data-action="toggle-precheck-word" data-word-id="${word.id}" aria-label="${state.daily.selectedWordIds.includes(word.id) ? `取消选择 ${word.word}` : `选择 ${word.word}`}">${state.daily.selectedWordIds.includes(word.id) ? "✓" : "+"}</button>
            <button class="word-link" type="button" data-action="open-detail" data-word-id="${word.id}">${word.word}</button>
            <div class="segmented">
              <button class="${status === "known" ? "selected" : ""}" type="button" data-action="mark-precheck" data-word-id="${word.id}" data-value="known">认识</button>
              <button class="${status === "unfamiliar" ? "selected danger" : ""}" type="button" data-action="mark-precheck" data-word-id="${word.id}" data-value="unfamiliar">不熟</button>
            </div>
          </article>
        `;
      }).join("")}
    </section>
    <footer class="bottom-actions">
      <span>已选 ${selectedCount}/3</span>
      <button class="secondary-button" type="button" data-action="auto-select">自动选词</button>
      <button class="primary-button small" type="button" ${selectedCount === 3 ? "" : "disabled"} data-action="confirm-precheck">开始识记</button>
    </footer>
  `;
}

function renderWordStudy() {
  const view = document.querySelector("#view-word-study");
  const word = getCurrentStudyWord(state);
  const total = state.daily.selectedWordIds.length || 3;
  if (!word) {
    view.innerHTML = `
      <header class="topbar compact">
        <button class="icon-button" type="button" aria-label="返回首页" data-action="go-home">‹</button>
        <h1>单词识记</h1>
      </header>
      <section class="empty-state">
        <p>本组识记已完成</p>
        <button class="primary-button" type="button" data-action="start-review">进入本组复习</button>
      </section>
    `;
    return;
  }
  scheduleAutoSpeak(word, `study:${state.daily.startedAt}:${state.daily.studyIndex}:${word.id}`);
  view.innerHTML = `
    <header class="topbar compact">
      <button class="icon-button" type="button" aria-label="返回首页" data-action="go-home">‹</button>
      <div class="progress-label">${state.daily.studyIndex + 1}/${total}</div>
    </header>
    <section class="study-card">
      <p class="section-label">单词识记</p>
      ${renderMemoryImage(word)}
      <h1>${word.syllables}</h1>
      <button class="sound-button" type="button" data-action="speak" data-word-id="${word.id}" aria-label="播放 ${word.word} 发音">播放</button>
      <p class="ipa">${word.ipa}</p>
      <p class="meaning"><span>${word.pos}</span>${word.cn.join("，")}</p>
      <button class="text-link" type="button" data-action="open-detail" data-word-id="${word.id}">查看例句和搭配</button>
    </section>
    <footer class="bottom-actions two">
      <button class="secondary-button" type="button" data-action="mark-study" data-value="1">还不熟</button>
      <button class="primary-button small" type="button" data-action="mark-study" data-value="3">已记住</button>
    </footer>
  `;
}

function renderGroupReview() {
  const view = document.querySelector("#view-group-review");
  const isMixed = state.daily.reviewPhase === "mixed";
  if (isMixed) {
    renderMixedReview(view);
    return;
  }
  const reviewIds = isMixed ? state.daily.mixedReviewWordIds : state.daily.selectedWordIds;
  const selected = reviewIds.map(getWordById).filter(Boolean);
  view.innerHTML = `
    <header class="topbar compact">
      <button class="icon-button" type="button" aria-label="返回识记" data-action="go-home">‹</button>
      <div>
        <p class="eyebrow">${isMixed ? `${selected.length} 个混组记忆` : "3 个一组即时复习"}</p>
        <h1>${isMixed ? "混组复习" : "本组复习"}</h1>
      </div>
    </header>
    <section class="review-summary">
      <strong>${selected.length} 个词</strong>
      <span>${isMixed ? `本轮已完成词混合为 ${selected.length} 个词` : "先把刚选出的 3 个词过一遍"}</span>
    </section>
    <section class="review-stack">
      ${selected.map((word) => `
        <article class="review-card">
          <button class="sound-mini" type="button" data-action="speak" data-word-id="${word.id}" aria-label="播放 ${word.word}">播放</button>
          <div>
            <h2>${word.word}</h2>
            <p>${word.ipa}</p>
            <small>${word.cn.join("，")}</small>
          </div>
        </article>
      `).join("")}
    </section>
    <footer class="bottom-actions">
      <span>${isMixed ? "完成后继续下一段学习" : "复习后进入听音辨义"}</span>
      <button class="primary-button small" type="button" data-action="${isMixed ? "finish-mixed-review" : "finish-review"}">${isMixed ? "完成复习" : "进入发音辨义"}</button>
    </footer>
  `;
}

function renderMixedReview(view) {
  const question = getCurrentMixedReviewQuestion(state);
  if (!question) {
    view.innerHTML = `
      <header class="topbar compact">
        <button class="icon-button" type="button" aria-label="返回首页" data-action="go-home">‹</button>
        <h1>混组复习</h1>
      </header>
      <section class="empty-state">
        <p>混组复习已完成</p>
        <button class="primary-button" type="button" data-action="finish-mixed-review">生成学习报告</button>
      </section>
    `;
    return;
  }
  const word = getWordById(question.wordId);
  scheduleAutoSpeak(word, `mixed:${state.daily.startedAt}:${state.daily.mixedIndex}:${word.id}`);
  view.innerHTML = `
    <header class="topbar compact">
      <button class="icon-button" type="button" aria-label="返回首页" data-action="go-home">‹</button>
      <div>
        <p class="eyebrow">${state.daily.mixedReviewWordIds.length} 个混组记忆</p>
        <h1>混组复习</h1>
      </div>
      <div class="progress-label">${state.daily.mixedIndex + 1}/${state.daily.mixedQuestions.length}</div>
    </header>
    <section class="review-summary">
      <strong>${state.daily.mixedReviewWordIds.length} 个词</strong>
      <span>逐词听音、辨义，完成后继续下一段学习</span>
    </section>
    <section class="audio-panel">
      <button class="speaker-tile" type="button" data-action="speak" data-word-id="${word.id}" aria-label="播放 ${word.word} 发音">播放</button>
      <p class="ipa"><span>英</span>${word.ipa}</p>
      <p class="hint">混组抽查：先听，再选中文释义</p>
      <div class="option-stack">
        ${question.options.map((option) => {
          const isAnswer = option === word.cn.join("，");
          const isSelected = question.selected === option;
          const className = question.answered
            ? isAnswer ? "option-card correct" : isSelected ? "option-card wrong" : "option-card muted-card"
            : "option-card";
          return `<button class="${className}" type="button" ${question.answered ? "disabled" : ""} data-action="answer-mixed" data-value="${escapeAttr(option)}">${formatMeaning(option)}</button>`;
        }).join("")}
      </div>
      <button class="text-link centered" type="button" data-action="open-detail" data-word-id="${word.id}">看词卡</button>
    </section>
    <footer class="bottom-actions">
      <span>${question.answered ? (question.isCorrect ? "混组回答正确" : "混组已加入错词") : "混组听音辨义"}</span>
      <button class="primary-button small" type="button" ${question.answered ? "" : "disabled"} data-action="next-mixed">${state.daily.mixedIndex + 1 >= state.daily.mixedQuestions.length ? "完成复习" : "继续"}</button>
    </footer>
  `;
}

function renderAudioMeaning() {
  const view = document.querySelector("#view-audio-meaning");
  const question = getCurrentAudioQuestion(state);
  if (!question) {
    view.innerHTML = "";
    return;
  }
  const word = getWordById(question.wordId);
  scheduleAutoSpeak(word, `audio:${state.daily.startedAt}:${state.daily.audioIndex}:${word.id}`);
  view.innerHTML = `
    <header class="topbar compact">
      <button class="icon-button" type="button" aria-label="返回首页" data-action="go-home">‹</button>
      <div class="progress-label">${state.daily.audioIndex + 1}/${state.daily.audioQuestions.length}</div>
      <button class="icon-button" type="button" aria-label="收藏">☆</button>
    </header>
    <section class="audio-panel">
      <button class="speaker-tile" type="button" data-action="speak" data-word-id="${word.id}" aria-label="播放发音">播放</button>
      <p class="ipa"><span>英</span>${word.ipa}</p>
      <p class="hint">先回想词义再选择，想不起来看答案</p>
      <div class="option-stack">
        ${question.options.map((option) => {
          const isAnswer = option === word.cn.join("，");
          const isSelected = question.selected === option;
          const className = question.answered
            ? isAnswer ? "option-card correct" : isSelected ? "option-card wrong" : "option-card muted-card"
            : "option-card";
          return `<button class="${className}" type="button" ${question.answered ? "disabled" : ""} data-action="answer-audio" data-value="${escapeAttr(option)}">${formatMeaning(option)}</button>`;
        }).join("")}
      </div>
      <button class="text-link centered" type="button" data-action="open-detail" data-word-id="${word.id}">看答案</button>
    </section>
    <footer class="bottom-actions">
      <span>${question.answered ? (question.isCorrect ? "回答正确" : "已加入错词") : "听音辨义"}</span>
      <button class="primary-button small" type="button" ${question.answered ? "" : "disabled"} data-action="next-audio">继续</button>
    </footer>
  `;
}

function renderWrongBook() {
  const view = document.querySelector("#view-wrong-book");
  const wrongWords = Object.entries(state.userWordStates)
    .filter(([, wordState]) => wordState.wrongCount > 0)
    .map(([wordId, wordState]) => ({ word: getWordById(wordId), wordState }))
    .filter((item) => item.word)
    .sort((a, b) => b.wordState.wrongCount - a.wordState.wrongCount);
  view.innerHTML = `
    <header class="topbar compact">
      <button class="icon-button" type="button" aria-label="返回首页" data-action="go-home">‹</button>
      <div>
        <p class="eyebrow">错词复习</p>
        <h1>错词本</h1>
      </div>
    </header>
    <section class="review-summary">
      <strong>${wrongWords.length} 个词</strong>
      <span>优先复盘听音辨义和混组复习里的错词</span>
    </section>
    <section class="review-stack">
      ${wrongWords.length ? wrongWords.map(({ word, wordState }) => `
        <article class="review-card">
          <button class="sound-mini" type="button" data-action="speak" data-word-id="${word.id}" aria-label="播放 ${word.word}">播放</button>
          <div>
            <h2>${word.word}</h2>
            <p>${word.ipa}</p>
            <small>${word.cn.join("，")} · 错 ${wordState.wrongCount} 次</small>
            <button class="text-link" type="button" data-action="open-detail" data-word-id="${word.id}">查看词卡</button>
          </div>
        </article>
      `).join("") : `
        <article class="empty-state">
          <p>当前没有错词。</p>
          <button class="primary-button" type="button" data-action="start-daily">开始今日学习</button>
        </article>
      `}
    </section>
  `;
}

function renderDailyReport() {
  const view = document.querySelector("#view-daily-report");
  const report = state.lastReport || buildDailyReport(state, words);
  view.innerHTML = `
    <header class="topbar compact">
      <button class="icon-button" type="button" aria-label="返回首页" data-action="go-home">‹</button>
      <h1>学习报告</h1>
    </header>
    <section class="report-panel">
      <div class="report-ring" style="--accuracy:${report.accuracy}%">${report.accuracy}%</div>
      <p class="section-label">发音辨义正确率</p>
      <div class="stats-grid">
        <article class="metric">
          <span>${report.learnedCount}</span>
          <small>本组学习</small>
        </article>
        <article class="metric">
          <span>${report.mixedReviewCount}</span>
          <small>混组复习</small>
        </article>
        <article class="metric">
          <span>${report.audioCount}</span>
          <small>听音题</small>
        </article>
      </div>
      <article class="copy-card">
        <h2>下次复习</h2>
        <p>${report.nextReview} 优先复盘错词和即将遗忘词。</p>
      </article>
      <article class="copy-card">
        <h2>打卡奖励</h2>
        <p>${report.streakRewardText}。已获得：${state.user.badges.length ? state.user.badges.join("、") : "暂无"}。</p>
      </article>
      <article class="copy-card">
        <h2>薄弱词</h2>
        <p>${report.weakWords.length ? report.weakWords.map((word) => word.word).join("、") : "本轮没有新增错词。"}</p>
      </article>
      <article class="copy-card">
        <h2>建议</h2>
        <p>${report.summary}</p>
      </article>
      <button class="primary-button" type="button" data-action="go-home">完成</button>
    </section>
  `;
}

function handleStartTest() {
  slowTestQuestionId = null;
  startAssessment(state);
  saveAndRender(VIEWS.TEST);
}

function handleAnswerTest(selected) {
  slowTestQuestionId = null;
  clearTestTimer();
  answerAssessmentQuestion(state, selected);
  saveState(state);
  if (state.assessment.completed) {
    showView(VIEWS.TEST_RESULT);
  } else {
    renderView(VIEWS.TEST);
  }
}

function handleStartDaily() {
  startDailyLearning(state);
  saveAndRender(VIEWS.PRECHECK);
}

function handleMarkPrecheck(wordId, status) {
  markPrecheck(state, wordId, status);
  if (status === "unfamiliar" && state.daily.selectedWordIds.length === 3) {
    confirmPrecheck(state);
    saveAndRender(VIEWS.WORD_STUDY);
    return;
  }
  saveAndRender(VIEWS.PRECHECK);
}

function handleTogglePrecheckWord(wordId) {
  togglePrecheckWord(state, wordId);
  saveAndRender(VIEWS.PRECHECK);
}

function handleAutoSelect() {
  autoSelectPrecheckWords(state);
  saveAndRender(VIEWS.PRECHECK);
}

function handleConfirmPrecheck() {
  confirmPrecheck(state);
  saveAndRender(VIEWS.WORD_STUDY);
}

function handleMarkStudy(familiarity) {
  markStudyWord(state, familiarity);
  saveState(state);
  const nextWord = getCurrentStudyWord(state);
  if (nextWord) {
    renderWordStudy();
  } else {
    showView(VIEWS.WORD_STUDY);
  }
}

function handleFinishReview() {
  state.daily.reviewed = true;
  state.daily.groupFeedback = "";
  prepareAudioQuestions(state);
  saveAndRender(VIEWS.AUDIO_MEANING);
}

function handleAnswerAudio(selected) {
  const result = answerAudioQuestion(state, selected);
  if (result.isCorrect) {
    advanceAudioQuestion();
    return;
  }
  saveState(state);
  renderAudioMeaning();
  openDetail(result.word.id, "audio");
}

function handleNextAudio() {
  advanceAudioQuestion();
}

function advanceAudioQuestion() {
  const phase = moveToNextAudioQuestion(state);
  if (phase === "next-selection") {
    saveAndRender(VIEWS.PRECHECK);
  } else if (phase === "mixed-review") {
    saveAndRender(VIEWS.GROUP_REVIEW);
  } else {
    saveState(state);
    renderAudioMeaning();
  }
}

function handleAnswerMixed(selected) {
  const result = answerMixedReviewQuestion(state, selected);
  if (result.isCorrect) {
    advanceMixedReviewQuestion();
    return;
  }
  saveState(state);
  renderView(VIEWS.GROUP_REVIEW);
}

function handleNextMixed() {
  advanceMixedReviewQuestion();
}

function advanceMixedReviewQuestion() {
  const phase = moveToNextMixedReviewQuestion(state);
  if (phase === "complete") {
    const nextPhase = completeMixedReview(state);
    if (nextPhase === "daily-report") {
      saveAndRender(VIEWS.DAILY_REPORT);
    } else {
      saveAndRender(VIEWS.PRECHECK);
    }
  } else {
    saveAndRender(VIEWS.GROUP_REVIEW);
  }
}

function handleFinishMixedReview() {
  const nextPhase = completeMixedReview(state);
  saveAndRender(nextPhase === "daily-report" ? VIEWS.DAILY_REPORT : VIEWS.PRECHECK);
}

function handleSpeak(wordId) {
  const word = getWordById(wordId);
  if (word) speakWord(word.word);
}

function handleReset() {
  state = resetState();
  saveAndRender(VIEWS.HOME);
}

function saveAndRender(view) {
  saveState(state);
  showView(view || getCurrentView());
}

function scheduleTestPrompt(questionId) {
  clearTestTimer();
  if (slowTestQuestionId === questionId) return;
  const timeoutMs = Number(window.__testTimeoutMs || 12000);
  testTimeoutId = window.setTimeout(() => {
    slowTestQuestionId = questionId;
    if (getCurrentView() === VIEWS.TEST) {
      renderView(VIEWS.TEST);
    }
  }, timeoutMs);
}

function clearTestTimer() {
  if (testTimeoutId) {
    window.clearTimeout(testTimeoutId);
    testTimeoutId = null;
  }
}

function scheduleAutoSpeak(word, key) {
  if (!word || lastAutoSpeakKey === key) return;
  lastAutoSpeakKey = key;
  window.setTimeout(() => {
    const view = getCurrentView();
    if (view === VIEWS.WORD_STUDY || view === VIEWS.AUDIO_MEANING || view === VIEWS.GROUP_REVIEW) {
      speakWord(word.word);
    }
  }, 80);
}

function openDetail(wordId, returnAction = null) {
  const word = getWordById(wordId);
  if (!word) return;
  detailReturnAction = returnAction;
  detailWordId = wordId;
  detailTab = "collocations";
  renderDetailContent(word);
  const modal = document.querySelector("#detail-modal");
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

function renderDetailContent(word) {
  document.querySelector("#detail-content").innerHTML = `
    <p class="section-label">详细词卡</p>
    <h1 id="detail-title" class="detail-word">${word.syllables}</h1>
    <p class="ipa"><span>英</span>${word.ipa}</p>
    <p class="meaning"><span>${word.pos}</span>${word.cn.join("，")}</p>
    ${renderMemoryImage(word)}
    ${renderExampleOrSource(word)}
    <div class="tabs">
      <button class="${detailTab === "collocations" ? "active" : ""}" type="button" data-action="switch-detail-tab" data-value="collocations">词组搭配</button>
      <button class="${detailTab === "derivatives" ? "active" : ""}" type="button" data-action="switch-detail-tab" data-value="derivatives">派生</button>
      <button class="${detailTab === "synonyms" ? "active" : ""}" type="button" data-action="switch-detail-tab" data-value="synonyms">近义</button>
    </div>
    ${renderDetailTabContent(word)}
  `;
}

function switchDetailTab(tab) {
  const word = getWordById(detailWordId);
  if (!word) return;
  detailTab = tab;
  renderDetailContent(word);
}

function closeDetail() {
  const modal = document.querySelector("#detail-modal");
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  if (detailReturnAction === "audio") {
    renderView(VIEWS.AUDIO_MEANING);
  }
  if (detailReturnAction === "mixed") {
    renderView(VIEWS.GROUP_REVIEW);
  }
  detailReturnAction = null;
  detailWordId = null;
  detailTab = "collocations";
}

function escapeAttr(value) {
  return String(value).replaceAll('"', "&quot;");
}

function formatMeaning(option) {
  const [first, ...rest] = option.split("，");
  return `<span>${first}</span>${rest.length ? `<small>${rest.join("，")}</small>` : ""}`;
}

function renderDetailTabContent(word) {
  if (detailTab === "derivatives") {
    return `
      <ul class="collocation-list" aria-label="派生">
        <li><span>派生词待补充</span><small>第一版先保留课标基础释义</small></li>
        <li><span>${word.headword}</span><small>${word.pos} · ${word.curriculumStage}</small></li>
      </ul>
    `;
  }
  if (detailTab === "synonyms") {
    return `
      <ul class="collocation-list" aria-label="近义">
        <li><span>近义词待自建</span><small>避免复制未授权商业词典内容</small></li>
        <li><span>${word.tags.join("、")}</span><small>可用于后续同类词复习</small></li>
      </ul>
    `;
  }
  return `
    <ul class="collocation-list" aria-label="词组搭配">
      ${word.collocations.length
        ? word.collocations.map((item) => `<li><span>${item.en}</span><small>${item.cn}</small></li>`).join("")
        : `<li><span>例句和搭配待自建</span><small>不复制未授权商业词典内容</small></li>`}
    </ul>
  `;
}

function renderExampleOrSource(word) {
  if (word.example_en || word.example_cn) {
    return `
      <article class="example-card">
        <p>${word.example_en}</p>
        <small>${word.example_cn}</small>
      </article>
    `;
  }
  return `
    <article class="example-card">
      <p>${word.curriculumStage} · 课标序号 ${word.sourceIndex}</p>
      <small>词表：${word.source.word_list}；释义：${word.source.definition}</small>
    </article>
  `;
}

function renderMemoryImage(word) {
  const image = word.memoryImage;
  if (!image) return "";
  return `
    <figure class="memory-image" aria-label="${escapeAttr(`${word.word} 记忆图`)}">
      <svg class="memory-illustration" viewBox="0 0 120 96" role="img" aria-label="${escapeAttr(image.meaning)} 占位插图">
        <rect x="8" y="10" width="104" height="72" rx="14"></rect>
        <circle cx="88" cy="30" r="14"></circle>
        <path d="M20 72 C34 54 45 54 58 70 C67 58 78 52 102 72 Z"></path>
        <path d="M34 34 h34 M34 46 h24"></path>
      </svg>
      <span>记忆图</span>
      <strong>${image.meaning}</strong>
      <small>词性 ${image.pos}</small>
      <p>场景：${image.scene}</p>
    </figure>
  `;
}
