function getConfiguredLingQEndpoint() {
  return process.env.LINGQ_STATS_URL || "";
}

const DEFAULT_LINGQ_DISPLAY_LANGUAGE = "en";
const DEFAULT_LINGQ_STUDY_LANGUAGE = "ja";

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

    const numericValue = Number(currentValue);
    if (Number.isFinite(numericValue)) {
      return Math.max(0, Math.round(numericValue));
    }
  }

  return null;
}

export function extractLingQWordsRead(payload) {
  return findFirstNumericValue(payload, [
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
