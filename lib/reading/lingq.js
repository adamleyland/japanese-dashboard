function getConfiguredLingQEndpoint() {
  return process.env.LINGQ_STATS_URL || "";
}

const DEFAULT_LINGQ_DISPLAY_LANGUAGE = "en";
const DEFAULT_LINGQ_STUDY_LANGUAGE = "ja";

export function getLingQApiToken() {
  const rawToken =
    process.env.LINGQ_API_KEY ||
    process.env.LINGQ_API_TOKEN ||
    process.env.LINGQ_BEARER_TOKEN ||
    "";

  return rawToken.replace(/^(token|bearer)\s+/i, "").trim();
}

export function buildLingQApiHeaders() {
  const token = getLingQApiToken();

  return {
    Authorization: `Token ${token}`,
    Accept: "application/json",
  };
}

function getNumericValue(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : null;
}

export function getLingQConfigurationState() {
  const endpoint = getConfiguredLingQEndpoint();
  const bearerToken = process.env.LINGQ_BEARER_TOKEN || "";
  const apiToken = process.env.LINGQ_API_TOKEN || "";
  const apiKey = process.env.LINGQ_API_KEY || "";

  return {
    endpoint,
    configured: Boolean(endpoint),
    credentials: {
      bearerToken,
      apiToken,
      apiKey,
    },
  };
}

export function buildLingQHeaders() {
  const { credentials } = getLingQConfigurationState();
  const headers = {
    Accept: "application/json",
  };

  if (credentials.bearerToken) {
    headers.Authorization = `Bearer ${credentials.bearerToken}`;
  } else if (credentials.apiToken) {
    headers.Authorization = `Token ${credentials.apiToken}`;
  }

  if (credentials.apiKey) {
    headers["X-API-Key"] = credentials.apiKey;
  }

  return headers;
}

export function buildLingQLessonUrl({
  lessonId,
  language = DEFAULT_LINGQ_STUDY_LANGUAGE,
  displayLanguage = DEFAULT_LINGQ_DISPLAY_LANGUAGE,
  lessonUrl = null,
} = {}) {
  if (typeof lessonUrl === "string" && lessonUrl.trim()) {
    if (/^https?:\/\//i.test(lessonUrl)) {
      return lessonUrl.trim();
    }

    if (lessonUrl.startsWith("/")) {
      return `https://www.lingq.com${lessonUrl}`;
    }
  }

  const normalizedLessonId = Number(lessonId);
  if (!Number.isFinite(normalizedLessonId) || normalizedLessonId <= 0) {
    return null;
  }

  return `https://www.lingq.com/${displayLanguage}/learn/${language}/web/lesson/${Math.round(
    normalizedLessonId,
  )}`;
}

function findFirstNumericValue(payload, paths) {
  for (const path of paths) {
    let currentValue = payload;

    for (const segment of path) {
      currentValue = currentValue?.[segment];
      if (currentValue === undefined || currentValue === null) {
        break;
      }
    }

    const numericValue = getNumericValue(currentValue);
    if (numericValue !== null) {
      return Math.round(numericValue);
    }
  }

  return null;
}

function sumNumericValues(value) {
  const numericValue = getNumericValue(value);
  if (numericValue !== null) {
    return numericValue;
  }

  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + sumNumericValues(item), 0);
  }

  if (value && typeof value === "object") {
    const directValue = findFirstNumericValue(value, [
      ["wordsRead"],
      ["words_read"],
      ["readWords"],
      ["read_words"],
      ["value"],
      ["count"],
      ["reading"],
    ]);

    if (directValue !== null) {
      return directValue;
    }

    return Object.values(value).reduce((total, item) => total + sumNumericValues(item), 0);
  }

  return 0;
}

export function extractLingQWordsRead(payload) {
  return findFirstNumericValue(payload, [
    ["readWords"],
    ["read_words"],
    ["wordsRead"],
    ["words_read"],
    ["totalWordsRead"],
    ["total_words_read"],
    ["stats", "wordsRead"],
    ["stats", "words_read"],
    ["statistics", "wordsRead"],
    ["statistics", "words_read"],
    ["results", "wordsRead"],
    ["results", "words_read"],
    ["data", "wordsRead"],
    ["data", "words_read"],
    ["data", "stats", "wordsRead"],
    ["data", "stats", "words_read"],
    ["allTime", "wordsRead"],
    ["allTime", "words_read"],
    ["totals", "wordsRead"],
    ["totals", "words_read"],
    ["user", "wordsRead"],
    ["user", "words_read"],
  ]);
}

export function extractLingQReadingChartWords(payload) {
  const seriesList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  for (const series of seriesList) {
    const seriesName = typeof series?.name === "string" ? series.name.toLowerCase() : "";
    if (seriesName && !seriesName.includes("reading")) {
      continue;
    }

    const totalWords = findFirstNumericValue(series, [
      ["total"],
      ["totalWords"],
      ["totalWordsRead"],
      ["wordsRead"],
      ["readWords"],
    ]);

    if (totalWords !== null) {
      return totalWords;
    }

    for (const key of ["daily", "data", "values", "chartData"]) {
      if (series?.[key]) {
        return Math.round(sumNumericValues(series[key]));
      }
    }
  }

  return null;
}
