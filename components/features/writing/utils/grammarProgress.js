import grammarCatalog from "@/data/jlpt-grammar.json";

export const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];
export const GRAMMAR_CATALOG = grammarCatalog;

export function buildGrammarProgress(attempts = []) {
  const attemptsByPoint = new Map();

  attempts.forEach((attempt) => {
    const pointId = String(attempt?.grammarPointId || "");
    if (!pointId) return;
    const current = attemptsByPoint.get(pointId) || [];
    current.push(attempt);
    attemptsByPoint.set(pointId, current);
  });

  const points = GRAMMAR_CATALOG.map((point) =>
    buildGrammarPointProgress(point, attemptsByPoint.get(point.id) || []),
  );
  const practiced = points.filter((point) => point.entryCount > 0);
  const mastered = points.filter((point) => point.status === "mastered");
  const levelSummaries = Object.fromEntries(
    JLPT_LEVELS.map((level) => {
      const levelPoints = points.filter((point) => point.level === level);
      const levelPracticed = levelPoints.filter((point) => point.entryCount > 0);
      return [level, {
        total: levelPoints.length,
        practiced: levelPracticed.length,
        mastered: levelPoints.filter((point) => point.status === "mastered").length,
        coverage: percentage(levelPracticed.length, levelPoints.length),
        mastery: average(levelPoints.map((point) => point.masteryScore)),
      }];
    }),
  );

  return {
    points,
    total: points.length,
    practiced: practiced.length,
    mastered: mastered.length,
    coverage: percentage(practiced.length, points.length),
    mastery: average(points.map((point) => point.masteryScore)),
    practicedMastery: average(practiced.map((point) => point.qualityAverage)),
    levelSummaries,
  };
}

export function chooseAdaptiveGrammar(progress, level, excludedPointId = "") {
  const now = Date.now();
  const candidates = progress.points.filter(
    (point) => point.level === level && point.id !== excludedPointId,
  );
  const needsPractice = candidates.filter((point) => ["learning", "improving"].includes(point.status));
  const unseen = candidates.filter((point) => point.status === "unseen");
  const roll = Math.random();
  const pool = needsPractice.length && roll < 0.45
    ? needsPractice
    : unseen.length && roll < 0.9
      ? unseen
      : candidates;
  const weighted = pool.map((point) => ({ point, weight: getPromptWeight(point, now) }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);

  if (!totalWeight) return pool[0] || candidates[0] || null;

  let cursor = Math.random() * totalWeight;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.point;
  }

  return weighted.at(-1)?.point || null;
}

export function findGrammarCandidates(body, targetPointId = "", maximum = 12) {
  const normalizedBody = normalizeJapanese(body);
  if (!normalizedBody) return [];

  return GRAMMAR_CATALOG
    .map((point) => ({
      point,
      matchLength: getGrammarForms(point.japanese)
        .filter((form) => form.length >= 2 && normalizedBody.includes(form))
        .reduce((longest, form) => Math.max(longest, form.length), 0),
    }))
    .filter((item) => item.point.id !== targetPointId && item.matchLength > 0)
    .sort((left, right) => right.matchLength - left.matchLength || levelRank(left.point.level) - levelRank(right.point.level))
    .slice(0, maximum)
    .map(({ point }) => point);
}

function buildGrammarPointProgress(point, rawAttempts) {
  const attempts = [...rawAttempts].sort(
    (left, right) => new Date(left.updatedAt || 0) - new Date(right.updatedAt || 0),
  );
  const scoredAttempts = attempts.filter(
    (attempt) => attempt.source === "prompted" || attempt.attempted || attempt.used,
  );
  const successfulAttempts = scoredAttempts.filter(
    (attempt) => attempt.used && Number(attempt.qualityScore) >= 70,
  );
  const qualityScores = scoredAttempts.map((attempt) => clampScore(attempt.qualityScore));
  const qualityAverage = average(qualityScores);
  const recentScores = qualityScores.slice(-5);
  const recentAverage = average(recentScores);
  const entryCount = new Set(scoredAttempts.map((attempt) => attempt.entryId).filter(Boolean)).size;
  const confidence = Math.min(1, entryCount / 5);
  const masteryScore = Math.round((recentAverage * 0.7 + qualityAverage * 0.3) * confidence);
  const lastTwoStrong = qualityScores.length >= 2 && qualityScores.slice(-2).every((score) => score >= 85);
  const mastered = successfulAttempts.length >= 5 && qualityAverage >= 85 && lastTwoStrong;
  const strong = successfulAttempts.length >= 3 && qualityAverage >= 80;
  const status = mastered
    ? "mastered"
    : strong
      ? "strong"
      : entryCount >= 2
        ? "improving"
        : entryCount === 1
          ? "learning"
          : "unseen";
  const latestAttempt = attempts.at(-1) || null;

  return {
    ...point,
    attempts,
    attemptCount: scoredAttempts.length,
    entryCount,
    successfulUses: successfulAttempts.length,
    qualityAverage,
    recentAverage,
    masteryScore,
    status,
    lastPracticedAt: latestAttempt?.updatedAt || "",
    latestFeedback: latestAttempt?.feedback || "",
    latestEvidence: latestAttempt?.evidence || "",
  };
}

function getPromptWeight(point, now) {
  if (point.status === "unseen") return 72;

  const lastPracticed = new Date(point.lastPracticedAt || 0).getTime();
  const daysSince = lastPracticed ? Math.max(0, (now - lastPracticed) / 86400000) : 60;

  if (point.status === "mastered") {
    return daysSince < 45 ? 0.15 : Math.min(8, 1 + (daysSince - 45) / 10);
  }

  const weakness = Math.max(0, 100 - point.qualityAverage);
  const staleness = Math.min(24, daysSince * 0.8);
  const recentPenalty = daysSince < 2 ? 24 : daysSince < 7 ? 10 : 0;
  const statusBoost = point.status === "learning" ? 24 : point.status === "improving" ? 17 : 5;
  return Math.max(2, 12 + weakness * 0.65 + staleness + statusBoost - recentPenalty);
}

function percentage(value, total) {
  return total ? roundProgress((value / total) * 100) : 0;
}

function average(values) {
  if (!values.length) return 0;
  return roundProgress(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length);
}

function roundProgress(value) {
  if (value > 0 && value < 1) return Math.round(value * 100) / 100;
  return Math.round(value * 10) / 10;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function getGrammarForms(value) {
  return String(value || "")
    .split(/[・/／]/)
    .map((form) => normalizeJapanese(form).replace(/[()（）]/g, ""))
    .filter(Boolean);
}

function normalizeJapanese(value) {
  return String(value || "")
    .replace(/[～〜~\s「」『』。、！？!?]/g, "")
    .trim();
}

function levelRank(level) {
  return { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 }[level] ?? 5;
}
