export const DEFAULT_READING_LIBRARY_TABLE = "books";
export const READING_BOOKS_SELECT_COLUMNS = [
  "id",
  "title",
  "status",
  "title_normalized",
  "author",
  "isbn",
  "caption",
  "image_url",
  "rakuten_url",
  "sales_date",
  "match_status",
  "match_confidence",
  "created_at",
  "updated_at",
].join(",");

export const READING_FILTERS = [
  { key: "all", label: "All books" },
  { key: "in_progress", label: "In progress" },
  { key: "reading_list", label: "Reading list" },
  { key: "finished", label: "Finished" },
];

export const DEFAULT_READING_FILTER = "all";
export const DEFAULT_READING_LAYOUT_MODE = "list";
export const READING_GOAL_STORAGE_KEY = "jp_reading_goal_words";
export const READING_FILTER_STORAGE_KEY = "jp_reading_filter";
export const READING_LAYOUT_MODE_STORAGE_KEY = "jp_reading_layout_mode";
export const DEFAULT_READING_GOAL = 5000000;
