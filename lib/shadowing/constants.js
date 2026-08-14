export const SHADOWING_SORT_MODES = [
  { value: "original", label: "Original deck order" },
  { value: "core-index", label: "Core-Index" },
  { value: "optimized-sent-index", label: "Optimized-Sent-Index" },
  { value: "random", label: "Random" },
];

export const SHADOWING_DECK_FIELD_NAMES = [
  "Expression",
  "Reading",
  "Sentence-Kana",
  "Sentence-English",
  "Sentence-Audio",
  "Vocabulary-Kanji",
  "Vocabulary-Furigana",
  "Vocabulary-Kana",
  "Vocabulary-English",
  "Vocabulary-Audio",
  "Vocabulary-Pos",
  "Sentence-Clozed",
  "Core-Index",
  "Optimized-Voc-Index",
  "Optimized-Sent-Index",
  "Tags",
  "Notes",
];

export const DEFAULT_SHADOWING_SETTINGS = {
  sentenceCount: 12,
  repetitions: 3,
  repeatGapSeconds: 1.5,
  sentenceGapSeconds: 3,
  playbackRate: 1,
  shuffle: false,
  showEnglish: true,
  showReading: true,
  sortMode: "original",
};

export const SHADOWING_STORAGE_KEYS = {
  selectedDeckId: "jp_shadowing_selected_deck_id",
  settings: "jp_shadowing_settings",
  goal: "jp_shadowing_goal_hours",
  vocabularyOpen: "jp_shadowing_vocab_panel_open",
  totalReps: "jp_shadowing_total_reps",
  streak: "jp_shadowing_streak",
};
