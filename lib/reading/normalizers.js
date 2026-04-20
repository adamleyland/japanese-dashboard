const TITLE_KEYS = ["title", "book_title", "name", "series_title"];
const AUTHOR_KEYS = ["author", "author_name", "authors", "creator"];
const COVER_KEYS = [
  "cover_url",
  "cover_image_url",
  "artwork_url",
  "image_url",
  "thumbnail_url",
  "thumbnail",
  "cover",
  "image",
];
const STATUS_KEYS = ["reading_status", "status", "state", "shelf", "stage"];
const PROGRESS_PERCENT_KEYS = [
  "progress_percent",
  "percent_complete",
  "progress_percentage",
  "completion_percentage",
  "completion_percent",
];
const CURRENT_PAGE_KEYS = ["current_page", "pages_read", "page", "page_current"];
const TOTAL_PAGE_KEYS = ["total_pages", "page_count", "pages_total"];
const WORDS_READ_KEYS = ["words_read", "read_words", "word_count_read"];
const TOTAL_WORDS_KEYS = ["total_words", "word_count", "words_total"];
const UPDATED_AT_KEYS = ["updated_at", "last_updated", "modified_at"];
const STARTED_AT_KEYS = ["started_at", "date_started", "start_date"];
const FINISHED_AT_KEYS = ["finished_at", "date_finished", "completed_at", "finish_date"];

function pickFirstValue(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function toText(value, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalizedValue = value.replace(/,/g, "").trim();
    if (!normalizedValue) {
      return null;
    }

    const numericValue = Number(normalizedValue);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  return null;
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toRatioPercent(value) {
  const numericValue = toNumber(value);
  if (numericValue === null) {
    return null;
  }

  if (numericValue <= 1) {
    return Math.max(0, Math.min(100, numericValue * 100));
  }

  return Math.max(0, Math.min(100, numericValue));
}

function normalizeReadingStatus(value) {
  const normalizedValue = toText(value).toLowerCase();

  if (!normalizedValue) {
    return "queued";
  }

  if (
    normalizedValue.includes("currently") ||
    normalizedValue.includes("in progress") ||
    normalizedValue.includes("in-progress") ||
    normalizedValue === "reading" ||
    normalizedValue === "current" ||
    normalizedValue === "active"
  ) {
    return "current";
  }

  if (
    normalizedValue === "read" ||
    normalizedValue.includes("finish") ||
    normalizedValue.includes("complete") ||
    normalizedValue === "done"
  ) {
    return "completed";
  }

  if (
    normalizedValue.includes("to read") ||
    normalizedValue.includes("reading list") ||
    normalizedValue.includes("backlog") ||
    normalizedValue.includes("wishlist") ||
    normalizedValue.includes("plan")
  ) {
    return "queued";
  }

  return "queued";
}

export function getReadingStatusLabel(status) {
  if (status === "current") {
    return "Currently Reading";
  }

  if (status === "completed") {
    return "Read";
  }

  return "Reading List";
}

export function formatReadingWords(value) {
  const safeValue = Math.max(0, Math.round(Number(value) || 0));
  return safeValue.toLocaleString();
}

export function formatReadingPercent(value) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return `${Math.round(safeValue)}%`;
}

export function buildReadingProgressLabel(item) {
  if (!item) {
    return "No progress yet";
  }

  if (item.currentPage !== null && item.totalPages !== null) {
    return `Page ${item.currentPage.toLocaleString()} of ${item.totalPages.toLocaleString()}`;
  }

  if (item.wordsRead !== null && item.totalWords !== null) {
    return `${formatReadingWords(item.wordsRead)} of ${formatReadingWords(item.totalWords)} words`;
  }

  if (item.progressPercent !== null) {
    return `${formatReadingPercent(item.progressPercent)} complete`;
  }

  if (item.wordsRead !== null) {
    return `${formatReadingWords(item.wordsRead)} words tracked`;
  }

  return "No progress yet";
}

export function normalizeReadingItem(record, index = 0) {
  const rawTitle = pickFirstValue(record, TITLE_KEYS);
  const rawAuthor = pickFirstValue(record, AUTHOR_KEYS);
  const rawStatus = pickFirstValue(record, STATUS_KEYS);
  const currentPage = toNumber(pickFirstValue(record, CURRENT_PAGE_KEYS));
  const totalPages = toNumber(pickFirstValue(record, TOTAL_PAGE_KEYS));
  const wordsRead = toNumber(pickFirstValue(record, WORDS_READ_KEYS));
  const totalWords = toNumber(pickFirstValue(record, TOTAL_WORDS_KEYS));
  const derivedPercentFromPages =
    currentPage !== null && totalPages ? (currentPage / totalPages) * 100 : null;
  const derivedPercentFromWords =
    wordsRead !== null && totalWords ? (wordsRead / totalWords) * 100 : null;
  const progressPercent =
    toRatioPercent(pickFirstValue(record, PROGRESS_PERCENT_KEYS)) ??
    derivedPercentFromPages ??
    derivedPercentFromWords;
  const coverCandidates = COVER_KEYS.map((key) => toText(record?.[key]))
    .filter(Boolean)
    .filter((value, candidateIndex, values) => values.indexOf(value) === candidateIndex);
  const status = normalizeReadingStatus(rawStatus);

  return {
    id:
      toText(record?.id) ||
      toText(record?.book_id) ||
      toText(record?.slug) ||
      `${toText(rawTitle, "reading-item")}-${index}`,
    title: toText(rawTitle, "Untitled"),
    author: toText(rawAuthor, "Unknown author"),
    status,
    statusLabel: getReadingStatusLabel(status),
    coverUrl: coverCandidates[0] || null,
    coverCandidates,
    progressPercent:
      progressPercent === null ? null : Math.max(0, Math.min(100, Number(progressPercent))),
    currentPage,
    totalPages,
    wordsRead,
    totalWords,
    startedAt: toIsoString(pickFirstValue(record, STARTED_AT_KEYS)),
    finishedAt: toIsoString(pickFirstValue(record, FINISHED_AT_KEYS)),
    updatedAt: toIsoString(pickFirstValue(record, UPDATED_AT_KEYS)),
    progressLabel: "",
    raw: record,
  };
}

export function normalizeReadingItems(records) {
  return (records || []).map((record, index) => {
    const item = normalizeReadingItem(record, index);

    return {
      ...item,
      progressLabel: buildReadingProgressLabel(item),
    };
  });
}

