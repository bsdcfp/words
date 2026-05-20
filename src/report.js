const ASSESSMENT_LAYERS = [
  { id: "foundation", label: "义务教育基础词", starLevel: 0, wordCount: 1500, passRate: 80 },
  { id: "required", label: "高中必修词", starLevel: 1, wordCount: 499, passRate: 70 },
  { id: "selective", label: "选择性必修词", starLevel: 2, wordCount: 1001, passRate: 60 }
];

export function buildAssessmentResult(assessment) {
  const answered = assessment.answers.length;
  const correct = assessment.answers.filter((answer) => answer.isCorrect).length;
  const unknown = assessment.answers.filter((answer) => answer.selected === "不认识").length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const layerStats = buildLayerStats(assessment.answers);
  const startLevel = decideStartLevel(layerStats);
  const vocabularyRange = estimateVocabularyRange(layerStats);
  const stage = ASSESSMENT_LAYERS.find((layer) => layer.id === startLevel)?.label || "高中必修词";
  const advice = `建议从${stage}开始。学习 3 天后会结合真实表现自动校准。`;

  return {
    answered,
    correct,
    unknown,
    wrongChoice: answered - correct - unknown,
    accuracy,
    vocabulary: `${vocabularyRange.lower}-${vocabularyRange.upper}`,
    vocabularyRange,
    startLevel,
    startLevelLabel: stage,
    layerStats,
    stage,
    advice
  };
}

function buildLayerStats(answers) {
  return ASSESSMENT_LAYERS.reduce((stats, layer) => {
    const layerAnswers = answers.filter((answer) => answer.layer === layer.id);
    const total = layerAnswers.length;
    const correct = layerAnswers.filter((answer) => answer.isCorrect).length;
    const unknown = layerAnswers.filter((answer) => answer.selected === "不认识").length;
    const wrongChoice = total - correct - unknown;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    stats[layer.id] = {
      total,
      correct,
      unknown,
      wrongChoice,
      accuracy,
      unknownRate: total ? Math.round((unknown / total) * 100) : 0,
      wrongChoiceRate: total ? Math.round((wrongChoice / total) * 100) : 0,
      passed: accuracy >= layer.passRate,
      passRate: layer.passRate,
      wordCount: layer.wordCount,
      label: layer.label
    };
    return stats;
  }, {});
}

function decideStartLevel(layerStats) {
  const firstFailed = ASSESSMENT_LAYERS.find((layer) => !layerStats[layer.id]?.passed);
  return firstFailed ? firstFailed.id : "selective";
}

function estimateVocabularyRange(layerStats) {
  const range = ASSESSMENT_LAYERS.reduce((sum, layer) => {
    const stats = layerStats[layer.id];
    const rate = Math.min(1, Math.max(0, (stats?.accuracy || 0) / 100));
    const upperContribution = stats?.passed ? layer.wordCount : layer.wordCount * rate;
    const lowerContribution = stats?.passed ? layer.wordCount : layer.wordCount * rate * 0.5;
    return {
      lower: sum.lower + lowerContribution,
      upper: sum.upper + upperContribution
    };
  }, { lower: 0, upper: 0 });

  return {
    lower: Math.round(range.lower),
    upper: Math.max(Math.round(range.upper), Math.round(range.lower))
  };
}

export function buildDailyReport(state, words) {
  const selected = state.daily.completedWordIds.length ? state.daily.completedWordIds : state.daily.batchWordIds.length ? state.daily.batchWordIds : state.daily.selectedWordIds;
  const records = state.answerRecords.filter((record) => record.sessionId === state.daily.startedAt);
  const audioRecords = records.filter((record) => record.type === "audio-meaning");
  const correct = audioRecords.filter((record) => record.isCorrect).length;
  const accuracy = audioRecords.length ? Math.round((correct / audioRecords.length) * 100) : 0;
  const weakWordIds = Array.from(new Set(audioRecords.filter((record) => !record.isCorrect).map((record) => record.wordId)));
  const weakWords = weakWordIds.map((id) => words.find((word) => word.id === id)).filter(Boolean);

  return {
    learnedCount: selected.length,
    mixedReviewCount: state.daily.mixedReviewWordIds?.length || 0,
    audioCount: audioRecords.length,
    accuracy,
    weakWords,
    nextReview: getReviewLabel(weakWords.length),
    streakRewardText: getRewardStreakText(state),
    summary: accuracy >= 80 ? "本组掌握稳定，明天做一次短复习即可。" : "本组还有薄弱词，建议明天优先复习错词。"
  };
}

function getReviewLabel(hasWeakWords) {
  const date = new Date();
  date.setDate(date.getDate() + (hasWeakWords ? 1 : 3));
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

export function getRewardStreakText(state) {
  const current = Number(state.user?.streakDays || 0);
  const longest = Number(state.user?.longestStreak || 0);
  if (current > 0) {
    return `连续打卡 ${current} 天`;
  }
  return `最长连续打卡 ${longest} 天`;
}
