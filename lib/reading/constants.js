export const DEFAULT_READING_LIBRARY_TABLE =
  process.env.NEXT_PUBLIC_READING_LIBRARY_TABLE || "reading_library";

export const READING_FILTERS = [
  { key: "current", label: "Currently Reading" },
  { key: "queued", label: "Reading List" },
  { key: "completed", label: "Read" },
];

export const DEFAULT_READING_FILTER = READING_FILTERS[0].key;
export const READING_GOAL_STORAGE_KEY = "jp_reading_goal_words";
export const DEFAULT_READING_GOAL = 5000000;

