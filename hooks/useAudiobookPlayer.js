"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearOtherCurrentAudiobooks,
  fetchUserAudiobookProgress,
  upsertUserAudiobookProgress,
} from "@/lib/audiobookProgress";
import { buildJapaneseSearchIndex } from "@/lib/japaneseSearch";
import { MOCK_AUDIOBOOKS } from "@/lib/mockAudiobooks";

const AUDIOBOOK_PLAYER_STORAGE_KEY = "jp_audiobook_player_state";
const AUDIOBOOK_PLAYER_STORAGE_KEY_LEGACY = AUDIOBOOK_PLAYER_STORAGE_KEY;
const AUDIOBOOK_PLAYER_GUEST_SCOPE = "guest";
const audiobookPlayerSessionCache = {};
const AUDIOBOOK_PLAYER_DEBUG = true;
const AUDIOBOOK_GRADIENTS = [
  "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #4f46e5 100%)",
  "linear-gradient(135deg, #10b981 0%, #14b8a6 100%)",
  "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
  "linear-gradient(135deg, #f97316 0%, #fb7185 100%)",
  "linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)",
];
const AUDIOBOOK_ACCENTS = ["#fbbf24", "#38bdf8", "#34d399", "#c084fc", "#fb923c", "#5eead4"];
const AUDIOBOOK_SEARCH_ALIASES = {
  "１Ｑ８４―ＢＯＯＫ１〈４月－６月〉前編": [
    "いちきゅうはちよん ぶっく1 しがつ ろくがつ ぜんぺん",
    "ichikyuuhachiyon book1 shigatsu rokugatsu zenpen",
    "1q84 book1 zenpen",
  ],
  "１Ｑ８４―ＢＯＯＫ１〈４月－６月〉後編": [
    "いちきゅうはちよん ぶっく1 しがつ ろくがつ こうへん",
    "ichikyuuhachiyon book1 shigatsu rokugatsu kouhen",
    "1q84 book1 kouhen",
  ],
  "スプートニクの恋人": [
    "すぷーとにくのこいびと",
    "suputoniku no koibito",
    "sputnik no koibito",
  ],
  "ノルウェイの森 上": [
    "のるうぇいのもり じょう",
    "noruwei no mori jou",
    "norwegian wood jou",
  ],
  告白: [
    "こくはく",
    "kokuhaku",
  ],
  "国境の南、太陽の西": [
    "こっきょうのみなみ たいようのにし",
    "kokkyou no minami taiyou no nishi",
  ],
  "愛しさに気づかぬうちに": [
    "いとしさにきづかぬうちに",
    "itoshisa ni kizukanu uchi ni",
  ],
  "放課後ミステリクラブ　３ 動くカメの銅像事件": [
    "ほうかごみすてりくらぶ さん うごくかめのどうぞうじけん",
    "houkago misuteri kurabu san ugoku kame no douzou jiken",
  ],
  "放課後ミステリクラブ　4 密室のウサギ小屋事件": [
    "ほうかごみすてりくらぶ よん みっしつのうさぎごやじけん",
    "houkago misuteri kurabu yon misshitsu no usagigoya jiken",
  ],
  "殺人ライセンス": [
    "さつじんらいせんす",
    "satsujin raisensu",
  ],
  "色彩を持たない多崎つくると、彼の巡礼の年": [
    "しきさいをもたない たざきつくると かれのじゅんれいのとし",
    "shikisai o motanai tazaki tsukuru to kare no junrei no toshi",
  ],
};

const AUDIOBOOK_AUTHOR_SEARCH_ALIASES = {
  "村上 春樹": ["むらかみ はるき", "murakami haruki"],
  "湊 かなえ": ["みなと かなえ", "minato kanae"],
  "川口 俊和": ["かわぐち としかず", "kawaguchi toshikazu"],
  "知念 実希人": ["ちねん みきと", "chinen mikito"],
  "今野 敏": ["こんの びん", "konno bin"],
};

function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractFileStem(value) {
  const input = toTrimmedString(value);
  if (!input) {
    return "";
  }

  const lastSegment = input.split("/").pop()?.split("\\").pop() || input;
  return lastSegment.replace(/\.[a-z0-9]+$/i, "").trim();
}

function normalizeSearchCollection(value) {
  if (Array.isArray(value)) {
    return value.flatMap(normalizeSearchCollection);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n|;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function shouldIncludeSearchValue(value) {
  const trimmedValue = toTrimmedString(value);
  if (!trimmedValue) {
    return false;
  }

  const normalizedValue = trimmedValue.toLowerCase();
  if (
    normalizedValue.startsWith("http://") ||
    normalizedValue.startsWith("https://") ||
    normalizedValue.startsWith("data:")
  ) {
    return false;
  }

  return trimmedValue.length <= 240;
}

function decodeEscapedUnicode(value) {
  return value.replace(/\\u([0-9a-f]{4})/gi, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

function maybeParseStructuredString(value) {
  const trimmedValue = toTrimmedString(value);
  if (!trimmedValue || !/^[\[{]/.test(trimmedValue)) {
    return null;
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    return null;
  }
}

function extractSearchSegments(value) {
  const normalizedValue = toTrimmedString(value).normalize("NFKC");
  if (!normalizedValue) {
    return [];
  }

  return normalizedValue.match(/[一-龯々ぁ-んァ-ヶー]+|[a-z0-9]+/gi) || [];
}

function collectSearchableStrings(value, bucket = new Set(), seen = new WeakSet()) {
  if (typeof value === "string") {
    const decodedValue = decodeEscapedUnicode(value);
    const parsedValue = maybeParseStructuredString(decodedValue);
    if (parsedValue) {
      collectSearchableStrings(parsedValue, bucket, seen);
    }

    if (shouldIncludeSearchValue(decodedValue)) {
      const trimmedValue = decodedValue.trim();
      bucket.add(trimmedValue);

      const fileStem = extractFileStem(trimmedValue);
      if (fileStem && fileStem !== trimmedValue) {
        bucket.add(fileStem);
      }

      extractSearchSegments(trimmedValue).forEach((segment) => {
        if (segment !== trimmedValue) {
          bucket.add(segment);
        }
      });
    }

    return bucket;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      collectSearchableStrings(entry, bucket, seen);
    });
    return bucket;
  }

  if (!value || typeof value !== "object") {
    return bucket;
  }

  if (seen.has(value)) {
    return bucket;
  }

  seen.add(value);

  Object.values(value).forEach((entry) => {
    collectSearchableStrings(entry, bucket, seen);
  });

  return bucket;
}

function buildAudiobookSearchValues(book) {
  return [
    book?.title,
    book?.title_ja,
    book?.title_jp,
    book?.title_kana,
    book?.titleKana,
    book?.title_reading,
    book?.titleReading,
    book?.title_romaji,
    book?.titleRomaji,
    book?.native_title,
    book?.nativeTitle,
    book?.author,
    book?.author_ja,
    book?.author_jp,
    book?.author_kana,
    book?.authorKana,
    book?.author_reading,
    book?.authorReading,
    book?.author_romaji,
    book?.authorRomaji,
    book?.narrator,
    book?.narrator_ja,
    book?.narrator_kana,
    book?.narrator_reading,
    book?.narratorReading,
    book?.narrator_romaji,
    book?.series,
    book?.series_name,
    book?.series_ja,
    book?.series_jp,
    book?.series_kana,
    book?.seriesKana,
    book?.series_reading,
    book?.seriesReading,
    book?.series_romaji,
    book?.seriesRomaji,
    book?.slug,
    book?.source_filename,
    extractFileStem(book?.source_filename),
    extractFileStem(book?.audio_url),
    book?.part,
    book?.publisher,
    book?.search_text,
    book?.searchText,
    ...normalizeSearchCollection(book?.aliases),
    ...normalizeSearchCollection(book?.alias),
    ...normalizeSearchCollection(book?.alternate_titles),
    ...normalizeSearchCollection(book?.alternateTitles),
    ...normalizeSearchCollection(book?.keywords),
    ...normalizeSearchCollection(book?.search_terms),
    ...normalizeSearchCollection(book?.searchTerms),
    ...normalizeSearchCollection(AUDIOBOOK_SEARCH_ALIASES[toTrimmedString(book?.title)]),
    ...normalizeSearchCollection(AUDIOBOOK_AUTHOR_SEARCH_ALIASES[toTrimmedString(book?.author)]),
    ...collectSearchableStrings(book),
  ];
}

function toSafeNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 0;
}

function normalizeChapters(chapters) {
  if (!Array.isArray(chapters)) {
    return [];
  }

  return chapters
    .map((chapter, index) => {
      const chapterIndex = Math.max(
        0,
        Math.floor(
          toSafeNumber(chapter?.chapterIndex, chapter?.chapter_index, chapter?.index, index),
        ),
      );
      const audiobookId = String(chapter?.audiobookId ?? chapter?.audiobook_id ?? "");
      const startSeconds = toSafeNumber(chapter?.startSeconds, chapter?.start_seconds);
      const rawEndSeconds = chapter?.endSeconds ?? chapter?.end_seconds;
      const parsedEndSeconds = Number(rawEndSeconds);
      const endSeconds =
        rawEndSeconds == null || rawEndSeconds === ""
          ? null
          : Number.isFinite(parsedEndSeconds) && parsedEndSeconds > startSeconds
            ? parsedEndSeconds
            : null;

      return {
        id: String(chapter?.id || `chapter-${chapterIndex + 1}`),
        audiobookId,
        chapterIndex,
        title: chapter?.title || `Chapter ${chapterIndex + 1}`,
        startSeconds,
        endSeconds,
      };
    })
    .filter((chapter) => chapter.title)
    .sort((left, right) => left.chapterIndex - right.chapterIndex || left.startSeconds - right.startSeconds);
}

function getActiveChapterIndex(chapters, currentTimeSeconds) {
  if (!Array.isArray(chapters) || !chapters.length) {
    return -1;
  }

  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    const nextChapter = chapters[index + 1];
    const boundary =
      nextChapter?.startSeconds ??
      (Number.isFinite(chapter?.endSeconds) && chapter.endSeconds > chapter.startSeconds
        ? chapter.endSeconds
        : Number.POSITIVE_INFINITY);

    if (currentTimeSeconds >= chapter.startSeconds && currentTimeSeconds < boundary) {
      return index;
    }
  }

  return currentTimeSeconds >= chapters[chapters.length - 1].startSeconds
    ? chapters.length - 1
    : -1;
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...error,
    };
  }

  if (error && typeof error === "object") {
    const entries = Object.entries(error);
    if (entries.length) {
      return Object.fromEntries(entries);
    }
  }

  return error;
}

function normalizeAudiobook(book, index) {
  const durationSeconds = toSafeNumber(book?.durationSeconds, book?.duration_seconds);
  const progressSeconds = clampProgress(
    toSafeNumber(
      book?.progressSeconds,
      book?.progress_seconds,
      book?.resumePositionSeconds,
      book?.resume_position_seconds,
      book?.currentPositionSeconds,
      book?.current_position_seconds,
    ),
    durationSeconds,
  );

  return {
    id: String(book?.id ?? book?.slug ?? book?.audio_url ?? `audiobook-${index + 1}`),
    title: toTrimmedString(book?.title) || "Untitled audiobook",
    author: toTrimmedString(book?.author) || "Unknown author",
    narrator: toTrimmedString(book?.narrator),
    series: toTrimmedString(book?.series) || toTrimmedString(book?.series_name),
    searchIndex: buildJapaneseSearchIndex(buildAudiobookSearchValues(book)),
    durationSeconds,
    progressSeconds,
    description:
      book?.description?.trim?.() ||
      "Continue building your listening library with a longer-form listening session.",
    cover_url: book?.cover_url || book?.coverImage || "",
    coverImage: book?.coverImage || book?.cover_url || "",
    coverGradient:
      book?.coverGradient || AUDIOBOOK_GRADIENTS[index % AUDIOBOOK_GRADIENTS.length],
    accentColor: book?.accentColor || AUDIOBOOK_ACCENTS[index % AUDIOBOOK_ACCENTS.length],
    audioUrl: book?.audioUrl || book?.audio_url || "",
    chapters: normalizeChapters(book?.chapters),
  };
}

function buildDefaultProgressMap(books) {
  return Object.fromEntries(
    books.map((book) => [book.id, Math.max(0, book.progressSeconds || 0)]),
  );
}

function buildDefaultDurationMap(books) {
  return Object.fromEntries(
    books.map((book) => [book.id, Math.max(0, book.durationSeconds || 0)]),
  );
}

function clampProgress(progressSeconds, durationSeconds) {
  return Math.max(0, Math.min(durationSeconds, progressSeconds || 0));
}

function logAudiobookDebug(event, payload = {}) {
  if (!AUDIOBOOK_PLAYER_DEBUG || typeof console === "undefined") {
    return;
  }

  console.info(`[AudiobookPlayer] ${event}`, payload);
}

function parseStoredTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsedValue = Date.parse(value);
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return new Date(parsedValue).toISOString();
}

function normalizeStoredProgressEntry(value, fallbackUpdatedAt = null) {
  if (typeof value === "number") {
    return {
      currentTime: Math.max(0, value),
      durationSeconds: 0,
      updatedAt: fallbackUpdatedAt,
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    currentTime: Math.max(
      0,
      toSafeNumber(value.currentTime, value.progressSeconds, value.progress_seconds),
    ),
    durationSeconds: Math.max(
      0,
      toSafeNumber(value.durationSeconds, value.duration_seconds),
    ),
    updatedAt: parseStoredTimestamp(value.updatedAt ?? value.updated_at) ?? fallbackUpdatedAt,
  };
}

function normalizeStoredPlayerState(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const currentBookId =
    typeof value.currentBookId === "string" && value.currentBookId.trim()
      ? value.currentBookId
      : null;
  const lastOpenedBookId =
    typeof value.lastOpenedBookId === "string" && value.lastOpenedBookId.trim()
      ? value.lastOpenedBookId
      : null;
  const progressEntries = {};
  const rawProgressEntries =
    value.progressEntries && typeof value.progressEntries === "object" ? value.progressEntries : null;

  if (rawProgressEntries) {
    Object.entries(rawProgressEntries).forEach(([audiobookId, entry]) => {
      const normalizedEntry = normalizeStoredProgressEntry(entry);
      if (!normalizedEntry || !audiobookId) {
        return;
      }

      progressEntries[String(audiobookId)] = normalizedEntry;
    });
  } else if (value.progressMap && typeof value.progressMap === "object") {
    const legacyUpdatedAt =
      parseStoredTimestamp(value.updatedAt ?? value.updated_at) ?? new Date().toISOString();

    Object.entries(value.progressMap).forEach(([audiobookId, progressSeconds]) => {
      const normalizedEntry = normalizeStoredProgressEntry(progressSeconds, legacyUpdatedAt);
      if (!normalizedEntry || !audiobookId) {
        return;
      }

      progressEntries[String(audiobookId)] = normalizedEntry;
    });
  }

  return {
    currentBookId,
    lastOpenedBookId,
    progressEntries,
  };
}

function getAudiobookPlayerStorageKey(userId = "") {
  return `${AUDIOBOOK_PLAYER_STORAGE_KEY}:${userId || AUDIOBOOK_PLAYER_GUEST_SCOPE}`;
}

function readStoredPlayerState(storageKey, fallbackKeys = []) {
  if (!storageKey) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(audiobookPlayerSessionCache, storageKey)) {
    return audiobookPlayerSessionCache[storageKey];
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const candidateKeys = [storageKey, ...fallbackKeys.filter(Boolean)];

    for (const candidateKey of candidateKeys) {
      const storedValue = window.localStorage.getItem(candidateKey);
      if (!storedValue) {
        continue;
      }

      const parsedValue = normalizeStoredPlayerState(JSON.parse(storedValue));
      audiobookPlayerSessionCache[storageKey] = parsedValue;

      if (candidateKey !== storageKey && parsedValue) {
        writeStoredPlayerState(storageKey, parsedValue);
      }

      return parsedValue;
    }

    audiobookPlayerSessionCache[storageKey] = null;
    return null;
  } catch {
    return null;
  }
}

function buildStoredPlayerState({
  currentBookId,
  lastOpenedBookId,
  progressMap,
  durationMap,
  progressUpdatedAtMap,
}) {
  const audiobookIds = new Set([
    ...Object.keys(progressMap || {}),
    ...Object.keys(durationMap || {}),
    ...Object.keys(progressUpdatedAtMap || {}),
  ]);
  const progressEntries = {};

  audiobookIds.forEach((audiobookId) => {
    progressEntries[audiobookId] = {
      currentTime: Math.max(0, Number(progressMap?.[audiobookId] || 0)),
      durationSeconds: Math.max(0, Number(durationMap?.[audiobookId] || 0)),
      updatedAt: parseStoredTimestamp(progressUpdatedAtMap?.[audiobookId]),
    };
  });

  return {
    currentBookId: currentBookId || null,
    lastOpenedBookId: lastOpenedBookId || null,
    progressEntries,
  };
}

function writeStoredPlayerState(storageKey, snapshot) {
  if (!storageKey) {
    return;
  }

  audiobookPlayerSessionCache[storageKey] = snapshot;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // Ignore storage write failures and continue with in-memory session state.
  }
}

export function useAudiobookPlayer(sourceBooks = [], userId = "") {
  const availableBooks = useMemo(() => {
    const normalizedFetchedBooks = Array.isArray(sourceBooks)
      ? sourceBooks.map(normalizeAudiobook)
      : [];

    if (normalizedFetchedBooks.length) {
      return normalizedFetchedBooks;
    }

    return MOCK_AUDIOBOOKS.map(normalizeAudiobook);
  }, [sourceBooks]);

  const defaultProgressMap = useMemo(
    () => buildDefaultProgressMap(availableBooks),
    [availableBooks],
  );
  const defaultDurationMap = useMemo(
    () => buildDefaultDurationMap(availableBooks),
    [availableBooks],
  );
  const storageKey = useMemo(() => getAudiobookPlayerStorageKey(userId), [userId]);
  const legacyFallbackStorageKey = useMemo(
    () => (userId ? null : AUDIOBOOK_PLAYER_STORAGE_KEY_LEGACY),
    [userId],
  );
  const [currentBookId, setCurrentBookId] = useState(null);
  const [lastOpenedBookId, setLastOpenedBookId] = useState(null);
  const [activeBook, setActiveBook] = useState(null);
  const [progressMap, setProgressMap] = useState(defaultProgressMap);
  const [durationMap, setDurationMap] = useState(defaultDurationMap);
  const [chapterMap, setChapterMap] = useState({});
  const [activeChapterIndex, setActiveChapterIndex] = useState(-1);
  const [playbackState, setPlaybackState] = useState("idle");
  const [savingProgress, setSavingProgress] = useState(false);
  const [serverCurrentBookId, setServerCurrentBookId] = useState(null);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const currentBookRef = useRef(null);
  const currentBookIdRef = useRef(currentBookId);
  const lastOpenedBookIdRef = useRef(lastOpenedBookId);
  const audioRef = useRef(null);
  const loadedAudioBookIdRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const sourceSwitchRef = useRef(null);
  const defaultProgressMapRef = useRef(defaultProgressMap);
  const defaultDurationMapRef = useRef(defaultDurationMap);
  const progressMapRef = useRef(defaultProgressMap);
  const durationMapRef = useRef(defaultDurationMap);
  const progressUpdatedAtRef = useRef({});
  const saveInFlightRef = useRef(false);
  const lastSavedSnapshotRef = useRef({
    audiobookId: null,
    progressSeconds: -1,
    durationSeconds: -1,
  });
  const markedCurrentBookIdRef = useRef(null);
  const fetchedChapterBookIdsRef = useRef(new Set());
  const availableBookIds = useMemo(
    () => new Set(availableBooks.map((book) => book.id)),
    [availableBooks],
  );
  const resolvedCurrentBookId = availableBookIds.has(currentBookId) ? currentBookId : null;
  const resolvedLastOpenedBookId = availableBookIds.has(lastOpenedBookId) ? lastOpenedBookId : null;

  const books = useMemo(
    () =>
      availableBooks.map((book) => {
        const progressSeconds = clampProgress(
          progressMap[book.id] ?? book.progressSeconds,
          durationMap[book.id] ?? book.durationSeconds,
        );
        const resolvedDurationSeconds = durationMap[book.id] ?? book.durationSeconds;
        const progressPercent = resolvedDurationSeconds
          ? (progressSeconds / resolvedDurationSeconds) * 100
          : 0;

        return {
          ...book,
          chapters: chapterMap[book.id] ?? book.chapters,
          durationSeconds: resolvedDurationSeconds,
          progressSeconds,
          progressPercent,
          remainingSeconds: Math.max(0, resolvedDurationSeconds - progressSeconds),
          isFinished: progressSeconds >= resolvedDurationSeconds,
        };
      }),
    [availableBooks, chapterMap, durationMap, progressMap],
  );

  const currentBook = resolvedCurrentBookId
    ? books.find((book) => book.id === resolvedCurrentBookId) || null
    : null;

  const currentProgressSeconds = currentBook?.progressSeconds || 0;
  const durationSeconds = currentBook?.durationSeconds || 0;
  const progressPercent = currentBook?.progressPercent || 0;

  const currentlyListeningBook = activeBook
    ? books.find((book) => book.id === activeBook.id) || activeBook
    : null;
  const currentChapters = currentBook?.chapters ?? [];

  useEffect(() => {
    currentBookRef.current = currentBook;
  }, [currentBook]);

  useEffect(() => {
    defaultProgressMapRef.current = defaultProgressMap;
  }, [defaultProgressMap]);

  useEffect(() => {
    defaultDurationMapRef.current = defaultDurationMap;
  }, [defaultDurationMap]);

  useEffect(() => {
    setStorageHydrated(false);
    setCurrentBookId(null);
    setLastOpenedBookId(null);
    setActiveBook(null);
    setProgressMap(defaultProgressMapRef.current);
    setDurationMap(defaultDurationMapRef.current);
    setPlaybackState("idle");
    setServerCurrentBookId(null);
    progressMapRef.current = defaultProgressMapRef.current;
    durationMapRef.current = defaultDurationMapRef.current;
    progressUpdatedAtRef.current = {};
    lastSavedSnapshotRef.current = {
      audiobookId: null,
      progressSeconds: -1,
      durationSeconds: -1,
    };
    markedCurrentBookIdRef.current = null;
    currentBookIdRef.current = null;
    lastOpenedBookIdRef.current = null;
  }, [storageKey]);

  useEffect(() => {
    if (!books.length) {
      return;
    }

    setActiveBook((currentValue) => {
      if (currentValue) {
        const resolvedBook = books.find((book) => book.id === currentValue.id);
        const nextProgress = clampProgress(
          progressMap[currentValue.id] ?? currentValue.progressSeconds,
          durationMap[currentValue.id] ?? currentValue.durationSeconds,
        );
        const nextDuration = durationMap[currentValue.id] ?? currentValue.durationSeconds;
        const nextProgressPercent = nextDuration ? (nextProgress / nextDuration) * 100 : 0;

        return {
          ...(resolvedBook || currentValue),
          progressSeconds: nextProgress,
          durationSeconds: nextDuration,
          progressPercent: nextProgressPercent,
          remainingSeconds: Math.max(0, nextDuration - nextProgress),
        };
      }

      const seedBookId = resolvedCurrentBookId || serverCurrentBookId || resolvedLastOpenedBookId;
      if (!seedBookId) {
        return null;
      }

      return books.find((book) => book.id === seedBookId) || null;
    });
  }, [
    books,
    durationMap,
    progressMap,
    resolvedCurrentBookId,
    resolvedLastOpenedBookId,
    serverCurrentBookId,
  ]);

  useEffect(() => {
    currentBookIdRef.current = resolvedCurrentBookId;
  }, [resolvedCurrentBookId]);

  useEffect(() => {
    lastOpenedBookIdRef.current = resolvedLastOpenedBookId;
  }, [resolvedLastOpenedBookId]);

  useEffect(() => {
    progressMapRef.current = progressMap;
  }, [progressMap]);

  useEffect(() => {
    durationMapRef.current = durationMap;
  }, [durationMap]);

  useEffect(() => {
    let cancelled = false;

    async function loadChapters() {
      if (!currentBook?.id) {
        setActiveChapterIndex(-1);
        return;
      }

      if (Array.isArray(currentBook.chapters) && currentBook.chapters.length > 0) {
        setChapterMap((currentValue) => {
          if (currentValue[currentBook.id]?.length === currentBook.chapters.length) {
            return currentValue;
          }

          return {
            ...currentValue,
            [currentBook.id]: currentBook.chapters,
          };
        });
        setActiveChapterIndex(
          getActiveChapterIndex(currentBook.chapters, currentBook.progressSeconds || 0),
        );
        fetchedChapterBookIdsRef.current.add(currentBook.id);
        return;
      }

      if (fetchedChapterBookIdsRef.current.has(currentBook.id)) {
        const nextIndex = getActiveChapterIndex(
          chapterMap[currentBook.id] ?? currentBook.chapters,
          currentBook.progressSeconds || 0,
        );
        setActiveChapterIndex(nextIndex);
        return;
      }

      fetchedChapterBookIdsRef.current.add(currentBook.id);

      const response = await fetch(
        `/api/audiobooks/${encodeURIComponent(currentBook.id)}/chapters`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        console.error("Failed to load audiobook chapters", {
          audiobookId: currentBook.id,
          status: response.status,
          error: payload?.error || "Chapter request failed.",
        });
        fetchedChapterBookIdsRef.current.delete(currentBook.id);
        return;
      }

      const payload = await response.json();
      const normalizedChapters = normalizeChapters(payload?.chapters);

      if (
        payload?.audiobookId &&
        String(payload.audiobookId) !== String(currentBook.id)
      ) {
        console.error("Received chapters for the wrong audiobook", {
          requestedAudiobookId: currentBook.id,
          responseAudiobookId: payload.audiobookId,
        });
        fetchedChapterBookIdsRef.current.delete(currentBook.id);
        return;
      }

      setChapterMap((currentValue) => ({
        ...currentValue,
        [currentBook.id]: normalizedChapters,
      }));

      setActiveChapterIndex(
        getActiveChapterIndex(
          normalizedChapters.length ? normalizedChapters : currentBook.chapters,
          currentBook.progressSeconds || 0,
        ),
      );
    }

    void loadChapters();

    return () => {
      cancelled = true;
    };
  }, [chapterMap, currentBook]);

  useEffect(() => {
    if (typeof window === "undefined" || storageHydrated || !storageKey) {
      return;
    }

    try {
      const fallbackKeys = legacyFallbackStorageKey ? [legacyFallbackStorageKey] : [];
      const storedState = readStoredPlayerState(storageKey, fallbackKeys);
      if (!storedState) {
        setStorageHydrated(true);
        return;
      }

      const nextProgressEntries = storedState.progressEntries || {};
      const nextProgressMap = {};
      const nextDurationMap = {};
      const nextUpdatedAtMap = {};
      logAudiobookDebug("hydrate-local-progress-start", {
        storageKey,
        currentBookId: storedState.currentBookId,
        lastOpenedBookId: storedState.lastOpenedBookId,
        progressEntryCount: Object.keys(nextProgressEntries).length,
      });

      Object.entries(nextProgressEntries).forEach(([audiobookId, entry]) => {
        nextProgressMap[audiobookId] = Math.max(0, Number(entry?.currentTime || 0));
        nextDurationMap[audiobookId] = Math.max(0, Number(entry?.durationSeconds || 0));

        const updatedAt = parseStoredTimestamp(entry?.updatedAt);
        if (updatedAt) {
          nextUpdatedAtMap[audiobookId] = updatedAt;
        }
      });

      setProgressMap((currentMap) => ({
        ...currentMap,
        ...nextProgressMap,
      }));
      setDurationMap((currentMap) => ({
        ...currentMap,
        ...nextDurationMap,
      }));
      progressUpdatedAtRef.current = {
        ...progressUpdatedAtRef.current,
        ...nextUpdatedAtMap,
      };
      setCurrentBookId((currentValue) =>
        currentValue === storedState.currentBookId ? currentValue : storedState.currentBookId,
      );
      setLastOpenedBookId((currentValue) =>
        currentValue === storedState.lastOpenedBookId ? currentValue : storedState.lastOpenedBookId,
      );
      if (storedState.currentBookId) {
        setPlaybackState((currentValue) => (currentValue === "idle" ? "paused" : currentValue));
      }
      logAudiobookDebug("hydrate-local-progress-complete", {
        storageKey,
        currentBookId: storedState.currentBookId,
        lastOpenedBookId: storedState.lastOpenedBookId,
        nextProgressMap,
      });
    } catch {
      // Ignore invalid local state and fall back to deterministic defaults.
    } finally {
      setStorageHydrated(true);
    }
  }, [legacyFallbackStorageKey, storageHydrated, storageKey]);

  useEffect(() => {
    setProgressMap((currentMap) => ({
      ...defaultProgressMap,
      ...currentMap,
    }));
  }, [defaultProgressMap]);

  useEffect(() => {
    setDurationMap((currentMap) => ({
      ...defaultDurationMap,
      ...currentMap,
    }));
  }, [defaultDurationMap]);

  useEffect(() => {
    if (typeof window === "undefined" || !storageHydrated || !storageKey) {
      return;
    }

    writeStoredPlayerState(
      storageKey,
      buildStoredPlayerState({
        currentBookId: resolvedCurrentBookId,
        lastOpenedBookId: resolvedLastOpenedBookId,
        progressMap,
        durationMap,
        progressUpdatedAtMap: progressUpdatedAtRef.current,
      }),
    );
  }, [
    durationMap,
    progressMap,
    resolvedCurrentBookId,
    resolvedLastOpenedBookId,
    storageKey,
    storageHydrated,
  ]);

  const markLocalProgressUpdated = useCallback((audiobookId, timestamp = new Date().toISOString()) => {
    if (!audiobookId) {
      return null;
    }

    const normalizedTimestamp = parseStoredTimestamp(timestamp) || new Date().toISOString();
    progressUpdatedAtRef.current = {
      ...progressUpdatedAtRef.current,
      [audiobookId]: normalizedTimestamp,
    };

    return normalizedTimestamp;
  }, []);

  const writeLiveProgressSnapshot = useCallback(
    ({ audiobookId, progressSeconds, durationSeconds, updatedAt = new Date().toISOString() }) => {
      if (!storageHydrated || !audiobookId) {
        return;
      }

      const safeDuration = Math.max(
        0,
        Number(durationSeconds || durationMapRef.current[audiobookId] || 0),
      );
      const safeProgress = clampProgress(
        Number(progressSeconds || 0),
        safeDuration > 0 ? safeDuration : Number.POSITIVE_INFINITY,
      );
      const normalizedTimestamp = markLocalProgressUpdated(audiobookId, updatedAt);
      const nextProgressMap = {
        ...progressMapRef.current,
        [audiobookId]: safeProgress,
      };
      const nextDurationMap =
        safeDuration > 0
          ? {
              ...durationMapRef.current,
              [audiobookId]: safeDuration,
            }
          : durationMapRef.current;

      progressMapRef.current = nextProgressMap;
      durationMapRef.current = nextDurationMap;
      logAudiobookDebug("write-live-progress-snapshot", {
        audiobookId,
        progressSeconds: safeProgress,
        durationSeconds: safeDuration,
        updatedAt: normalizedTimestamp,
      });

      writeStoredPlayerState(
        storageKey,
        buildStoredPlayerState({
          currentBookId: currentBookIdRef.current,
          lastOpenedBookId: lastOpenedBookIdRef.current,
          progressMap: nextProgressMap,
          durationMap: nextDurationMap,
          progressUpdatedAtMap: {
            ...progressUpdatedAtRef.current,
            ...(normalizedTimestamp ? { [audiobookId]: normalizedTimestamp } : {}),
          },
        }),
      );
    },
    [markLocalProgressUpdated, storageHydrated, storageKey],
  );

  const persistProgress = useCallback(
    async ({
      audiobookId,
      progressSeconds,
      durationSeconds: nextDurationSeconds,
      markCurrent = false,
      force = false,
    }) => {
      if (!userId || !audiobookId || saveInFlightRef.current) {
        return;
      }

      const roundedProgress = Math.max(0, Math.floor(progressSeconds || 0));
      const roundedDuration = Math.max(0, Math.floor(nextDurationSeconds || 0));
      const lastSnapshot = lastSavedSnapshotRef.current;

      if (
        !force &&
        lastSnapshot.audiobookId === audiobookId &&
        Math.abs(lastSnapshot.progressSeconds - roundedProgress) < 5 &&
        Math.abs(lastSnapshot.durationSeconds - roundedDuration) < 5 &&
        (!markCurrent || markedCurrentBookIdRef.current === audiobookId)
      ) {
        logAudiobookDebug("skip-persist-progress", {
          audiobookId,
          progressSeconds: roundedProgress,
          durationSeconds: roundedDuration,
          markCurrent,
          force,
        });
        return;
      }

      saveInFlightRef.current = true;
      setSavingProgress(true);

      try {
        logAudiobookDebug("persist-progress-start", {
          audiobookId,
          progressSeconds: roundedProgress,
          durationSeconds: roundedDuration,
          markCurrent,
          force,
        });
        if (markCurrent) {
          await clearOtherCurrentAudiobooks(userId, audiobookId);
          markedCurrentBookIdRef.current = audiobookId;
          setServerCurrentBookId(audiobookId);
        }

        await upsertUserAudiobookProgress({
          userId,
          audiobookId,
          progressSeconds: roundedProgress,
          durationSeconds: roundedDuration,
          lastListenedAt: new Date().toISOString(),
          isCurrent: true,
        });

        lastSavedSnapshotRef.current = {
          audiobookId,
          progressSeconds: roundedProgress,
          durationSeconds: roundedDuration,
        };
        logAudiobookDebug("persist-progress-complete", {
          audiobookId,
          progressSeconds: roundedProgress,
          durationSeconds: roundedDuration,
        });
      } catch (error) {
        console.error("Failed to persist audiobook progress", {
          userId,
          audiobookId,
          progressSeconds: roundedProgress,
          durationSeconds: roundedDuration,
          markCurrent,
          error: serializeError(error),
        });
      } finally {
        saveInFlightRef.current = false;
        setSavingProgress(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      setServerCurrentBookId(null);
      markedCurrentBookIdRef.current = null;
      return;
    }

    let cancelled = false;

    const hydrateProgress = async () => {
      try {
        const rows = await fetchUserAudiobookProgress(userId);
        if (cancelled) {
          return;
        }
        logAudiobookDebug("hydrate-remote-progress-start", {
          userId,
          rowCount: rows.length,
        });

        const nextProgressEntries = {};
        const nextDurationEntries = {};
        const nextUpdatedAtEntries = {};

        rows.forEach((row) => {
          const audiobookId = String(row.audiobook_id);
          if (!availableBookIds.has(audiobookId)) {
            return;
          }

          const serverUpdatedAt = parseStoredTimestamp(row.updated_at ?? row.last_listened_at);
          const localUpdatedAt = parseStoredTimestamp(progressUpdatedAtRef.current[audiobookId]);

          if (
            localUpdatedAt &&
            (!serverUpdatedAt || Date.parse(localUpdatedAt) > Date.parse(serverUpdatedAt))
          ) {
            return;
          }

          nextProgressEntries[audiobookId] = toSafeNumber(row.progress_seconds);
          nextDurationEntries[audiobookId] = toSafeNumber(row.duration_seconds);
          if (serverUpdatedAt) {
            nextUpdatedAtEntries[audiobookId] = serverUpdatedAt;
          }
        });

        setProgressMap((currentMap) => ({
          ...currentMap,
          ...nextProgressEntries,
        }));

        setDurationMap((currentMap) => ({
          ...currentMap,
          ...nextDurationEntries,
        }));
        progressUpdatedAtRef.current = {
          ...progressUpdatedAtRef.current,
          ...nextUpdatedAtEntries,
        };

        const preferredCurrentRow =
          rows.find((row) => row.is_current && availableBookIds.has(String(row.audiobook_id))) ||
          rows.find((row) => availableBookIds.has(String(row.audiobook_id))) ||
          null;

        const preferredCurrentId = preferredCurrentRow
          ? String(preferredCurrentRow.audiobook_id)
          : null;

        setServerCurrentBookId(preferredCurrentId);
        markedCurrentBookIdRef.current = preferredCurrentId;
        lastSavedSnapshotRef.current = preferredCurrentId
          ? {
              audiobookId: preferredCurrentId,
              progressSeconds: toSafeNumber(preferredCurrentRow?.progress_seconds),
              durationSeconds: toSafeNumber(preferredCurrentRow?.duration_seconds),
            }
          : {
              audiobookId: null,
              progressSeconds: -1,
              durationSeconds: -1,
            };

        setLastOpenedBookId((currentValue) =>
          currentValue && availableBookIds.has(currentValue)
            ? currentValue
            : preferredCurrentId,
        );
        setCurrentBookId((currentValue) =>
          currentValue && availableBookIds.has(currentValue)
            ? currentValue
            : preferredCurrentId,
        );
        if (preferredCurrentId) {
          setPlaybackState((currentValue) => (currentValue === "idle" ? "paused" : currentValue));
        }
        logAudiobookDebug("hydrate-remote-progress-complete", {
          userId,
          preferredCurrentId,
          nextProgressEntries,
          nextDurationEntries,
        });
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to restore audiobook progress", error);
        }
      }
    };

    void hydrateProgress();

    return () => {
      cancelled = true;
    };
  }, [availableBookIds, userId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const syncProgress = () => {
      const activeBookId = currentBookIdRef.current;
      if (!activeBookId) {
        return;
      }

      if (
        sourceSwitchRef.current?.bookId === activeBookId &&
        Number.isFinite(pendingSeekRef.current)
      ) {
        logAudiobookDebug("skip-progress-sync-during-source-switch", {
          audiobookId: activeBookId,
          pendingSeek: pendingSeekRef.current,
          currentTime: audio.currentTime,
        });
        return;
      }

      const activeBook = currentBookRef.current;

      const nextProgress = clampProgress(audio.currentTime, Number.isFinite(audio.duration) ? audio.duration : Infinity);
      logAudiobookDebug("sync-progress", {
        audiobookId: activeBookId,
        currentTime: audio.currentTime,
        nextProgress,
        duration: audio.duration,
      });
      markLocalProgressUpdated(activeBookId);
      setProgressMap((currentMap) => {
        const currentProgress = currentMap[activeBookId] ?? 0;
        if (Math.abs(currentProgress - nextProgress) < 0.25) {
          return currentMap;
        }

        return {
          ...currentMap,
          [activeBookId]: nextProgress,
        };
      });
      setActiveChapterIndex(getActiveChapterIndex(activeBook?.chapters, nextProgress));
    };

    const syncDuration = () => {
      const activeBookId = currentBookIdRef.current;
      if (!activeBookId || !Number.isFinite(audio.duration) || audio.duration <= 0) {
        return;
      }

      logAudiobookDebug("sync-duration", {
        audiobookId: activeBookId,
        duration: audio.duration,
      });

      setDurationMap((currentMap) => {
        if (currentMap[activeBookId] === audio.duration) {
          return currentMap;
        }

        return {
          ...currentMap,
          [activeBookId]: audio.duration,
        };
      });

      setProgressMap((currentMap) => {
        const currentProgress = currentMap[activeBookId] ?? 0;
        const safeProgress = clampProgress(currentProgress, audio.duration);
        if (safeProgress === currentProgress) {
          return currentMap;
        }

        return {
          ...currentMap,
          [activeBookId]: safeProgress,
        };
      });
    };

    const handleLoadedMetadata = () => {
      const nextSeek = pendingSeekRef.current;
      const activeBookId = currentBookIdRef.current;
      logAudiobookDebug("loaded-metadata", {
        audiobookId: activeBookId,
        pendingSeek: nextSeek,
        duration: audio.duration,
      });
      syncDuration();

      if (Number.isFinite(nextSeek)) {
        logAudiobookDebug("apply-initial-current-time", {
          audiobookId: activeBookId,
          requestedSeek: nextSeek,
          duration: audio.duration,
        });
        audio.currentTime = clampProgress(
          nextSeek,
          Number.isFinite(audio.duration) ? audio.duration : Number.POSITIVE_INFINITY,
        );
        pendingSeekRef.current = null;
      }

      sourceSwitchRef.current = null;
      syncProgress();
    };

    const handlePlay = () => {
      setPlaybackState((currentState) =>
        currentState === "idle" ? currentState : "playing",
      );
    };

    const handlePause = () => {
      if (audio.ended) {
        return;
      }

      if (
        sourceSwitchRef.current?.bookId === currentBookIdRef.current &&
        Number.isFinite(pendingSeekRef.current)
      ) {
        logAudiobookDebug("skip-pause-sync-during-source-switch", {
          audiobookId: currentBookIdRef.current,
          pendingSeek: pendingSeekRef.current,
          currentTime: audio.currentTime,
        });
        return;
      }

      setPlaybackState((currentState) =>
        currentState === "idle" ? currentState : "paused",
      );
      syncProgress();
      writeLiveProgressSnapshot({
        audiobookId: currentBookIdRef.current,
        progressSeconds: audio.currentTime,
        durationSeconds: Number.isFinite(audio.duration) ? audio.duration : 0,
      });
    };

    const handleEnded = () => {
      const activeBookId = currentBookIdRef.current;
      sourceSwitchRef.current = null;
      if (activeBookId && Number.isFinite(audio.duration) && audio.duration > 0) {
        markLocalProgressUpdated(activeBookId);
        setProgressMap((currentMap) => ({
          ...currentMap,
          [activeBookId]: audio.duration,
        }));
        writeLiveProgressSnapshot({
          audiobookId: activeBookId,
          progressSeconds: audio.duration,
          durationSeconds: audio.duration,
        });
      }

      setActiveChapterIndex(getActiveChapterIndex(currentBookRef.current?.chapters, audio.duration || 0));
      setPlaybackState("paused");
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("timeupdate", syncProgress);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      sourceSwitchRef.current = null;
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("timeupdate", syncProgress);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
      loadedAudioBookIdRef.current = null;
    };
  }, [markLocalProgressUpdated, writeLiveProgressSnapshot]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!currentBook) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      loadedAudioBookIdRef.current = null;
      return;
    }

    const targetProgress = clampProgress(
      progressMap[currentBook.id] ?? currentBook.progressSeconds,
      currentBook.durationSeconds,
    );
    logAudiobookDebug("mount-active-book", {
      audiobookId: currentBook.id,
      targetProgress,
      currentBookProgressSeconds: currentBook.progressSeconds,
      progressMapValue: progressMap[currentBook.id],
      durationSeconds: currentBook.durationSeconds,
      loadedAudioBookId: loadedAudioBookIdRef.current,
    });

    if (loadedAudioBookIdRef.current !== currentBook.id) {
      sourceSwitchRef.current = {
        bookId: currentBook.id,
        targetProgress,
        previousBookId: loadedAudioBookIdRef.current,
      };
      pendingSeekRef.current = targetProgress;
      logAudiobookDebug("switch-audio-source", {
        audiobookId: currentBook.id,
        targetProgress,
        previousBookId: loadedAudioBookIdRef.current,
      });
      audio.pause();
      audio.src = currentBook.audioUrl || "";
      loadedAudioBookIdRef.current = currentBook.id;

      if (currentBook.audioUrl) {
        audio.load();
      } else {
        sourceSwitchRef.current = null;
        pendingSeekRef.current = null;
      }

      return;
    }

    if (Math.abs(audio.currentTime - targetProgress) > 0.75) {
      logAudiobookDebug("sync-audio-current-time-to-target", {
        audiobookId: currentBook.id,
        audioCurrentTime: audio.currentTime,
        targetProgress,
      });
      audio.currentTime = targetProgress;
    }
  }, [currentBook, progressMap]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentBook) {
      return;
    }

    if (!currentBook.audioUrl) {
      return;
    }

    if (playbackState === "playing") {
      void audio.play().catch(() => {
        setPlaybackState("paused");
      });
      return;
    }

    audio.pause();
  }, [currentBook, playbackState]);

  useEffect(() => {
    setActiveChapterIndex(getActiveChapterIndex(currentBook?.chapters, currentBook?.progressSeconds || 0));
  }, [currentBook]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const flushCurrentProgress = () => {
      const activeBook = currentBookRef.current;
      if (!activeBook?.id) {
        return;
      }

      const audio = audioRef.current;
      const liveProgress = audio ? audio.currentTime : activeBook.progressSeconds;
      const liveDuration =
        audio && Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : activeBook.durationSeconds;

      writeLiveProgressSnapshot({
        audiobookId: activeBook.id,
        progressSeconds: liveProgress,
        durationSeconds: liveDuration,
      });

      if (userId) {
        void persistProgress({
          audiobookId: activeBook.id,
          progressSeconds: liveProgress,
          durationSeconds: liveDuration,
          markCurrent: true,
          force: true,
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushCurrentProgress();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushCurrentProgress);
    window.addEventListener("beforeunload", flushCurrentProgress);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushCurrentProgress);
      window.removeEventListener("beforeunload", flushCurrentProgress);
    };
  }, [persistProgress, userId, writeLiveProgressSnapshot]);

  useEffect(() => {
    const activeBook = currentBookRef.current;
    if (!userId || !activeBook) {
      return;
    }

    void persistProgress({
      audiobookId: activeBook.id,
      progressSeconds: activeBook.progressSeconds,
      durationSeconds: activeBook.durationSeconds,
      markCurrent: true,
      force: true,
    });
  }, [currentBook?.id, persistProgress, userId]);

  useEffect(() => {
    if (!userId || playbackState !== "playing" || !currentBook) {
      return;
    }

    const timer = window.setInterval(() => {
      const activeBook = currentBookRef.current;
      if (!activeBook) {
        return;
      }

      const audio = audioRef.current;
      const liveProgress = audio ? audio.currentTime : activeBook.progressSeconds;
      const liveDuration =
        audio && Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : activeBook.durationSeconds;

      void persistProgress({
        audiobookId: activeBook.id,
        progressSeconds: liveProgress,
        durationSeconds: liveDuration,
        markCurrent: true,
      });
    }, 15000);

    return () => window.clearInterval(timer);
  }, [currentBook, persistProgress, playbackState, userId]);

  useEffect(() => {
    if (!userId || playbackState === "playing" || !currentBook) {
      return;
    }

    void persistProgress({
      audiobookId: currentBook.id,
      progressSeconds: currentBook.progressSeconds,
      durationSeconds: currentBook.durationSeconds,
      markCurrent: true,
      force: true,
    });
  }, [currentBook, persistProgress, playbackState, userId]);

  useEffect(
    () => () => {
      const activeBook = currentBookRef.current;
      if (!activeBook) {
        return;
      }

      const audio = audioRef.current;
      const liveProgress = audio ? audio.currentTime : activeBook.progressSeconds;
      const liveDuration =
        audio && Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : activeBook.durationSeconds;

      writeLiveProgressSnapshot({
        audiobookId: activeBook.id,
        progressSeconds: liveProgress,
        durationSeconds: liveDuration,
      });

      if (userId) {
        void persistProgress({
          audiobookId: activeBook.id,
          progressSeconds: liveProgress,
          durationSeconds: liveDuration,
          markCurrent: true,
          force: true,
        });
      }
    },
    [persistProgress, userId, writeLiveProgressSnapshot],
  );

  const loadBook = useCallback((book, nextPlaybackState = "loaded", source = "unknown") => {
    if (!book?.id) {
      return;
    }

    logAudiobookDebug("select-book", {
      source,
      audiobookId: book.id,
      progressSeconds: book.progressSeconds,
      durationSeconds: book.durationSeconds,
      progressPercent: book.progressPercent,
    });
    setActiveBook(book);
    setCurrentBookId(book.id);
    setLastOpenedBookId(book.id);
    setServerCurrentBookId(book.id);
    setPlaybackState(nextPlaybackState);
  }, []);

  const returnToLibrary = useCallback(() => {
    audioRef.current?.pause();
    setPlaybackState("idle");
    setCurrentBookId(null);
  }, []);

  const closePlayer = useCallback(() => {
    audioRef.current?.pause();
    setPlaybackState("paused");
  }, []);

  const togglePlayback = useCallback(() => {
    const activeBookId = currentBookIdRef.current;
    if (!activeBookId) {
      return;
    }

    const activeBook = currentBookRef.current;
    if (!activeBook?.audioUrl) {
      return;
    }

    setPlaybackState((currentState) => {
      if (currentState === "playing") {
        return "paused";
      }

      return "playing";
    });
  }, []);

  const seekTo = useCallback(
    (nextProgressSeconds) => {
      const activeBookId = currentBookIdRef.current;
      const activeBook = books.find((book) => book.id === activeBookId);
      if (!activeBook) {
        return;
      }

      const safeProgress = clampProgress(nextProgressSeconds, activeBook.durationSeconds);
      const audio = audioRef.current;
      if (audio && loadedAudioBookIdRef.current === activeBook.id) {
        audio.currentTime = safeProgress;
      }

      markLocalProgressUpdated(activeBook.id);

      setProgressMap((currentMap) => ({
        ...currentMap,
        [activeBook.id]: safeProgress,
      }));
      setLastOpenedBookId(activeBook.id);
    },
    [books, markLocalProgressUpdated],
  );

  const skipBy = useCallback(
    (deltaSeconds) => {
      if (!currentBook) {
        return;
      }

      seekTo(currentBook.progressSeconds + deltaSeconds);
    },
    [currentBook, seekTo],
  );

  const selectCurrentlyListening = useCallback((nextPlaybackState = "loaded") => {
    if (!activeBook?.id) {
      return;
    }

    loadBook(activeBook, nextPlaybackState, "currently-listening");
  }, [activeBook, loadBook]);

  const playFromStart = useCallback(() => {
    const activeBook = currentBookRef.current;
    if (!activeBook?.audioUrl) {
      return;
    }

    seekTo(0);
  }, [seekTo]);

  return {
    books,
    chapters: currentChapters,
    currentBook,
    currentProgressSeconds,
    hasPlayableAudio: Boolean(currentBook?.audioUrl),
    isPlaying: playbackState === "playing",
    currentlyListeningBook,
    durationSeconds,
    activeChapterIndex,
    loadBook,
    playbackState,
    progressPercent,
    closePlayer,
    returnToLibrary,
    playFromStart,
    savingProgress,
    seekTo,
    selectCurrentlyListening,
    skipBy,
    togglePlayback,
  };
}
