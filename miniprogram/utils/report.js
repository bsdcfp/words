function buildAssessmentResult(assessment) {
  const answered = assessment.answers.length;
  const correct = assessment.answers.filter((answer) => answer.isCorrect).length;
  const unknown = assessment.answers.filter((answer) => answer.selected === "不认识").length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const vocabulary = estimateVocabulary(correct, unknown, answered);
  const stage = vocabulary >= 2600 ? "高中进阶" : vocabulary >= 1600 ? "初中高阶" : "初中基础";
  const advice = vocabulary >= 2600
    ? "适合进入高频核心词和语境复习。"
    : "建议先补基础词义，再增加听音辨义训练。";

  return { answered, correct, unknown, accuracy, vocabulary, stage, advice };
}

function buildDailyReport(state, words) {
  const selected = state.daily.completedWordIds.length
    ? state.daily.completedWordIds
    : state.daily.batchWordIds.length
      ? state.daily.batchWordIds
      : state.daily.selectedWordIds;
  const records = state.answerRecords.filter((record) => record.sessionId === state.daily.startedAt);
  const audioRecords = records.filter((record) => record.type === "audio-meaning" || record.type === "mixed-review");
  const correct = audioRecords.filter((record) => record.isCorrect).length;
  const accuracy = audioRecords.length ? Math.round((correct / audioRecords.length) * 100) : 0;
  const weakWordIds = uniqueIds(audioRecords.filter((record) => !record.isCorrect).map((record) => record.wordId));
  const weakWords = weakWordIds.map((id) => words.find((word) => word.id === id)).filter(Boolean);

  return {
    learnedCount: selected.length,
    mixedReviewCount: state.daily.mixedReviewWordIds.length || 0,
    audioCount: audioRecords.length,
    accuracy,
    weakWords,
    nextReview: getReviewLabel(weakWords.length),
    streakRewardText: getRewardStreakText(state),
    summary: accuracy >= 80 ? "本组掌握稳定，明天做一次短复习即可。" : "本组还有薄弱词，建议明天优先复习错词。"
  };
}

function getRewardStreakText(state) {
  const current = Number(state.user?.streakDays || 0);
  const longest = Number(state.user?.longestStreak || 0);
  return current > 0 ? `连续打卡 ${current} 天` : `最长连续打卡 ${longest} 天`;
}

function estimateVocabulary(correct, unknown, answered) {
  if (!answered) return 600;
  const scaledCorrect = (correct / answered) * 50;
  const breakpoints = [[0, 600], [10, 900], [20, 1500], [30, 2300], [40, 3100], [50, 3800]];
  let base = breakpoints[0][1];
  for (let index = 1; index < breakpoints.length; index += 1) {
    const [rightScore, rightVocab] = breakpoints[index];
    const [leftScore, leftVocab] = breakpoints[index - 1];
    if (scaledCorrect <= rightScore) {
      const ratio = (scaledCorrect - leftScore) / Math.max(1, rightScore - leftScore);
      base = leftVocab + ratio * (rightVocab - leftVocab);
      break;
    }
    base = rightVocab;
  }
  const unknownPenalty = Math.min(420, Math.round((unknown / Math.max(1, answered)) * 520));
  return Math.max(600, Math.round(base - unknownPenalty));
}

function getReviewLabel(hasWeakWords) {
  const date = new Date();
  date.setDate(date.getDate() + (hasWeakWords ? 1 : 3));
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function uniqueIds(ids) {
  const seen = {};
  return ids.filter((id) => {
    if (!id || seen[id]) return false;
    seen[id] = true;
    return true;
  });
}

module.exports = {
  buildAssessmentResult,
  buildDailyReport,
  getRewardStreakText
};
