import rakutenImageUtils from "@/lib/rakutenImage";

const { getHighResRakutenImage } = rakutenImageUtils;

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

function toIsoString(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeReadingStatus(value) {
  const normalizedValue = toText(value).toLowerCase();

  if (normalizedValue === "in_progress" || normalizedValue === "reading" || normalizedValue === "current") {
    return "in_progress";
  }

  if (
    normalizedValue === "reading_list" ||
    normalizedValue === "queued" ||
    normalizedValue === "to_read"
  ) {
    return "reading_list";
  }

  if (
    normalizedValue === "finished" ||
    normalizedValue === "completed" ||
    normalizedValue === "complete"
  ) {
    return "finished";
  }

  return "reading_list";
}

export function getReadingStatusLabel(status) {
  if (status === "in_progress") {
    return "In progress";
  }

  if (status === "finished") {
    return "Finished";
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

export function formatReadingDate(value) {
  const textValue = toText(value);
  if (!textValue) {
    return "";
  }

  const date = new Date(textValue);
  if (Number.isNaN(date.getTime())) {
    return textValue;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatReadingMatchConfidence(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value <= 1) {
      return formatReadingPercent(value * 100);
    }

    if (value >= 0 && value <= 100) {
      return formatReadingPercent(value);
    }

    return value.toLocaleString();
  }

  const textValue = toText(value);
  if (!textValue) {
    return "";
  }

  const numericValue = Number(textValue);
  if (Number.isFinite(numericValue)) {
    return formatReadingMatchConfidence(numericValue);
  }

  return textValue;
}

export function humanizeReadingValue(value) {
  const textValue = toText(value);
  if (!textValue) {
    return "";
  }

  return textValue
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildCoverCandidates(record) {
  const candidates = [
    getHighResRakutenImage(toText(record?.image_url)),
    getHighResRakutenImage(toText(record?.imageUrl)),
    getHighResRakutenImage(toText(record?.coverUrl)),
    getHighResRakutenImage(toText(record?.raw?.image_url)),
  ].filter(Boolean);

  return candidates.filter(
    (candidate, index) => candidates.indexOf(candidate) === index,
  );
}

export function normalizeReadingItem(record, index = 0) {
  const coverCandidates = buildCoverCandidates(record);
  const coverUrl = coverCandidates[0] || null;
  const status = normalizeReadingStatus(record?.status);

  return {
    id: toText(record?.id) || `book-${index}`,
    title: toText(record?.title, "Untitled"),
    status,
    statusLabel: getReadingStatusLabel(status),
    titleNormalized: toText(record?.title_normalized),
    author: toText(record?.author),
    subtitle: toText(record?.author),
    isbn: toText(record?.isbn),
    caption: toText(record?.caption),
    image_url: getHighResRakutenImage(toText(record?.image_url)),
    coverUrl,
    coverCandidates,
    imageUrl: coverUrl,
    rakutenUrl: toText(record?.rakuten_url),
    salesDate: toText(record?.sales_date),
    salesDateLabel: formatReadingDate(record?.sales_date),
    matchStatus: toText(record?.match_status),
    matchStatusLabel: humanizeReadingValue(record?.match_status),
    matchConfidence: record?.match_confidence ?? null,
    matchConfidenceLabel: formatReadingMatchConfidence(record?.match_confidence),
    createdAt: toIsoString(record?.created_at),
    updatedAt: toIsoString(record?.updated_at),
    progressPercent: null,
    progressLabel: null,
    raw: record,
  };
}

export function normalizeReadingItems(records) {
  return (records || []).map((record, index) => normalizeReadingItem(record, index));
}
