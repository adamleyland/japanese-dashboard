const WORDS_PER_CHARACTER = 0.5;
const WORDS_PER_MINUTE = 30;

export function countWritingCharacters(value = "") {
  return String(value).replace(/\s+/g, "").length;
}

export function estimateWritingWords(characterCount = 0) {
  return Math.max(0, Math.round((Number(characterCount) || 0) * WORDS_PER_CHARACTER));
}

export function estimateWritingMinutes(estimatedWords = 0) {
  const safeWords = Math.max(0, Number(estimatedWords) || 0);
  return Math.round((safeWords / WORDS_PER_MINUTE) * 10) / 10;
}

export function estimateWritingHours(estimatedWords = 0) {
  return estimateWritingMinutes(estimatedWords) / 60;
}

export function buildWritingMetrics(body = "") {
  const characterCount = countWritingCharacters(body);
  const estimatedWords = estimateWritingWords(characterCount);
  const estimatedMinutes = estimateWritingMinutes(estimatedWords);

  return {
    characterCount,
    estimatedWords,
    estimatedMinutes,
  };
}

export function getEntryPreview(body = "", maxLength = 180) {
  const compactBody = String(body).replace(/\s+/g, " ").trim();
  if (compactBody.length <= maxLength) {
    return compactBody;
  }

  return `${compactBody.slice(0, maxLength).trimEnd()}...`;
}

export function getEntryDisplayTitle(entry) {
  if (entry?.title?.trim()) {
    return entry.title.trim();
  }

  return buildWritingJapaneseTitle(entry?.entryLocalDate || entry?.createdAt);
}

export function formatWritingLongDate(value) {
  const date = toValidDate(value);
  if (!date) {
    return "Unknown date";
  }

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function buildWritingJapaneseTitle(value) {
  const date = toValidDate(value);
  if (!date) {
    return "日記";
  }

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatWritingCount(value) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString();
}

export function formatWritingDuration(minutes = 0) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);

  if (safeMinutes >= 60) {
    const hours = safeMinutes / 60;
    return `${hours.toLocaleString(undefined, {
      minimumFractionDigits: hours >= 10 ? 0 : 1,
      maximumFractionDigits: 1,
    })}h`;
  }

  if (safeMinutes >= 1) {
    return `${safeMinutes.toLocaleString(undefined, {
      minimumFractionDigits: safeMinutes % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    })}m`;
  }

  return "<1m";
}

export function filterWritingEntries(entries, filter = "all") {
  const now = new Date();

  if (filter === "week") {
    const startOfWeek = getStartOfWeek(now);
    return entries.filter((entry) => {
      const entryDate = toValidDate(entry.createdAt);
      return entryDate && entryDate >= startOfWeek;
    });
  }

  if (filter === "month") {
    return entries.filter((entry) => {
      const entryDate = toValidDate(entry.createdAt);
      return (
        entryDate &&
        entryDate.getFullYear() === now.getFullYear() &&
        entryDate.getMonth() === now.getMonth()
      );
    });
  }

  return entries;
}

export function buildWritingSummary(entries) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const today = new Date();
  const todayKey = getDayKey(today);
  const startOfWeek = getStartOfWeek(today);

  const totalCharacters = safeEntries.reduce(
    (sum, entry) => sum + Math.max(0, Number(entry.characterCount) || 0),
    0,
  );
  const totalEstimatedWords = safeEntries.reduce(
    (sum, entry) => sum + Math.max(0, Number(entry.estimatedWords) || 0),
    0,
  );
  const totalEstimatedMinutes = safeEntries.reduce(
    (sum, entry) => sum + Math.max(0, Number(entry.estimatedMinutes) || 0),
    0,
  );
  const todayEntries = safeEntries.filter((entry) => getDayKey(entry.createdAt) === todayKey);
  const weekEntries = safeEntries.filter((entry) => {
    const entryDate = toValidDate(entry.createdAt);
    return entryDate && entryDate >= startOfWeek;
  });

  return {
    totalCharacters,
    totalEstimatedWords,
    totalEstimatedMinutes,
    todayCharacters: todayEntries.reduce(
      (sum, entry) => sum + Math.max(0, Number(entry.characterCount) || 0),
      0,
    ),
    todayEstimatedWords: todayEntries.reduce(
      (sum, entry) => sum + Math.max(0, Number(entry.estimatedWords) || 0),
      0,
    ),
    weekEstimatedWords: weekEntries.reduce(
      (sum, entry) => sum + Math.max(0, Number(entry.estimatedWords) || 0),
      0,
    ),
    entriesThisWeek: weekEntries.length,
    currentStreak: calculateWritingStreak(safeEntries, today),
    weeklyActivity: buildWeeklyActivity(safeEntries, today),
  };
}

function buildWeeklyActivity(entries, referenceDate) {
  const totalsByDay = entries.reduce((map, entry) => {
    const dayKey = getDayKey(entry.createdAt);
    if (!dayKey) {
      return map;
    }

    const currentTotals = map.get(dayKey) || {
      characterCount: 0,
      estimatedWords: 0,
    };
    currentTotals.characterCount += Math.max(0, Number(entry.characterCount) || 0);
    currentTotals.estimatedWords += Math.max(0, Number(entry.estimatedWords) || 0);
    map.set(dayKey, currentTotals);
    return map;
  }, new Map());

  return Array.from({ length: 7 }, (_, index) => {
    const currentDate = new Date(referenceDate);
    currentDate.setHours(0, 0, 0, 0);
    currentDate.setDate(referenceDate.getDate() - (6 - index));
    const dayKey = getDayKey(currentDate);

    return {
      dayKey,
      label: currentDate.toLocaleDateString(undefined, { weekday: "short" }),
      characterCount: totalsByDay.get(dayKey)?.characterCount || 0,
      estimatedWords: totalsByDay.get(dayKey)?.estimatedWords || 0,
    };
  });
}

function calculateWritingStreak(entries, referenceDate) {
  const entryDays = new Set(entries.map((entry) => getDayKey(entry.createdAt)).filter(Boolean));
  let streak = 0;
  const currentDate = new Date(referenceDate);
  currentDate.setHours(0, 0, 0, 0);

  while (entryDays.has(getDayKey(currentDate))) {
    streak += 1;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}

function getStartOfWeek(referenceDate) {
  const nextDate = new Date(referenceDate);
  nextDate.setHours(0, 0, 0, 0);
  const weekday = nextDate.getDay();
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  nextDate.setDate(nextDate.getDate() - mondayOffset);
  return nextDate;
}

function getDayKey(value) {
  const date = toValidDate(value);
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toValidDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
