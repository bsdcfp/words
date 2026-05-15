export const VIEWS = {
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

let currentView = VIEWS.HOME;

export function showView(viewName) {
  currentView = viewName;
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.dataset.view === viewName);
  });
  window.scrollTo({ top: 0, behavior: "instant" });
  window.dispatchEvent(new CustomEvent("viewchange", { detail: { viewName } }));
}

export function getCurrentView() {
  return currentView;
}
