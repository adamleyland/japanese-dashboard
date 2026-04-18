"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearOtherCurrentAudiobooks,
  fetchUserAudiobookProgress,
  upsertUserAudiobookProgress,
} from "@/lib/audiobookProgress";
import { MOCK_AUDIOBOOKS } from "@/lib/mockAudiobooks";

const AUDIOBOOK_PLAYER_STORAGE_KEY = "jp_audiobook_player_state";
const AUDIOBOOK_GRADIENTS = [
  "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #4f46e5 100%)",
  "linear-gradient(135deg, #10b981 0%, #14b8a6 100%)",
  "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
  "linear-gradient(135deg, #f97316 0%, #fb7185 100%)",
  "linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)",
];
const AUDIOBOOK_ACCENTS = ["#fbbf24", "#38bdf8", "#34d399", "#c084fc", "#fb923c", "#5eead4"];

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
    .map((chapter, index) => ({
      id: chapter?.id || `chapter-${index + 1}`,
      title: chapter?.title || `Chapter ${index + 1}`,
      startSeconds: toSafeNumber(chapter?.startSeconds, chapter?.start_seconds),
    }))
    .filter((chapter) => chapter.title);
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
    title: book?.title?.trim?.() || "Untitled audiobook",
    author: book?.author?.trim?.() || "Unknown author",
    narrator: book?.narrator?.trim?.() || "",
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

function getInitialPlayerState(defaultProgressMap) {
  if (typeof window === "undefined") {
    return {
      currentBookId: null,
      lastOpenedBookId: null,
      progressMap: defaultProgressMap,
    };
  }

  try {
    const storedValue = window.localStorage.getItem(AUDIOBOOK_PLAYER_STORAGE_KEY);
    if (!storedValue) {
      return {
        currentBookId: null,
        lastOpenedBookId: null,
        progressMap: defaultProgressMap,
      };
    }

    const parsedValue = JSON.parse(storedValue);
    const mergedProgressMap = {
      ...defaultProgressMap,
      ...(parsedValue?.progressMap || {}),
    };

    return {
      currentBookId:
        typeof parsedValue?.currentBookId === "string" ? parsedValue.currentBookId : null,
      lastOpenedBookId:
        typeof parsedValue?.lastOpenedBookId === "string" ? parsedValue.lastOpenedBookId : null,
      progressMap: mergedProgressMap,
    };
  } catch {
    return {
      currentBookId: null,
      lastOpenedBookId: null,
      progressMap: defaultProgressMap,
    };
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
  const initialState = useMemo(() => getInitialPlayerState(defaultProgressMap), [defaultProgressMap]);
  const [currentBookId, setCurrentBookId] = useState(initialState.currentBookId);
  const [lastOpenedBookId, setLastOpenedBookId] = useState(initialState.lastOpenedBookId);
  const [activeBook, setActiveBook] = useState(null);
  const [progressMap, setProgressMap] = useState(initialState.progressMap);
  const [durationMap, setDurationMap] = useState(() => buildDefaultDurationMap(availableBooks));
  const [playbackState, setPlaybackState] = useState(
    initialState.currentBookId ? "paused" : "idle",
  );
  const [savingProgress, setSavingProgress] = useState(false);
  const [serverCurrentBookId, setServerCurrentBookId] = useState(null);
  const currentBookRef = useRef(null);
  const currentBookIdRef = useRef(currentBookId);
  const audioRef = useRef(null);
  const loadedAudioBookIdRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const lastSavedSnapshotRef = useRef({
    audiobookId: null,
    progressSeconds: -1,
    durationSeconds: -1,
  });
  const markedCurrentBookIdRef = useRef(null);
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
          durationSeconds: resolvedDurationSeconds,
          progressSeconds,
          progressPercent,
          remainingSeconds: Math.max(0, resolvedDurationSeconds - progressSeconds),
          isFinished: progressSeconds >= resolvedDurationSeconds,
        };
      }),
    [availableBooks, durationMap, progressMap],
  );

  const currentBook =
    activeBook && activeBook.id === resolvedCurrentBookId ? activeBook : null;

  const currentProgressSeconds = currentBook?.progressSeconds || 0;
  const durationSeconds = currentBook?.durationSeconds || 0;
  const progressPercent = currentBook?.progressPercent || 0;

  const currentlyListeningBook = activeBook;

  useEffect(() => {
    currentBookRef.current = currentBook;
  }, [currentBook]);

  useEffect(() => {
    if (!books.length) {
      return;
    }

    setActiveBook((currentValue) => {
      if (currentValue) {
        const nextProgress = clampProgress(
          progressMap[currentValue.id] ?? currentValue.progressSeconds,
          durationMap[currentValue.id] ?? currentValue.durationSeconds,
        );
        const nextDuration = durationMap[currentValue.id] ?? currentValue.durationSeconds;
        const nextProgressPercent = nextDuration ? (nextProgress / nextDuration) * 100 : 0;

        return {
          ...currentValue,
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
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      AUDIOBOOK_PLAYER_STORAGE_KEY,
      JSON.stringify({
        currentBookId: resolvedCurrentBookId,
        lastOpenedBookId: resolvedLastOpenedBookId,
        progressMap,
      }),
    );
  }, [progressMap, resolvedCurrentBookId, resolvedLastOpenedBookId]);

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
        return;
      }

      saveInFlightRef.current = true;
      setSavingProgress(true);

      try {
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
      } catch (error) {
        console.error("Failed to persist audiobook progress", error);
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

        const nextProgressEntries = {};
        const nextDurationEntries = {};

        rows.forEach((row) => {
          const audiobookId = String(row.audiobook_id);
          if (!availableBookIds.has(audiobookId)) {
            return;
          }

          nextProgressEntries[audiobookId] = toSafeNumber(row.progress_seconds);
          nextDurationEntries[audiobookId] = toSafeNumber(row.duration_seconds);
        });

        setProgressMap((currentMap) => ({
          ...currentMap,
          ...nextProgressEntries,
        }));

        setDurationMap((currentMap) => ({
          ...currentMap,
          ...nextDurationEntries,
        }));

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

      const nextProgress = clampProgress(audio.currentTime, Number.isFinite(audio.duration) ? audio.duration : Infinity);
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
    };

    const syncDuration = () => {
      const activeBookId = currentBookIdRef.current;
      if (!activeBookId || !Number.isFinite(audio.duration) || audio.duration <= 0) {
        return;
      }

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
      syncDuration();

      if (Number.isFinite(nextSeek)) {
        audio.currentTime = Math.max(0, nextSeek);
        pendingSeekRef.current = null;
      }

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

      setPlaybackState((currentState) =>
        currentState === "idle" ? currentState : "paused",
      );
      syncProgress();
    };

    const handleEnded = () => {
      const activeBookId = currentBookIdRef.current;
      if (activeBookId && Number.isFinite(audio.duration) && audio.duration > 0) {
        setProgressMap((currentMap) => ({
          ...currentMap,
          [activeBookId]: audio.duration,
        }));
      }

      setPlaybackState("paused");
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("timeupdate", syncProgress);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
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
  }, []);

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

    if (loadedAudioBookIdRef.current !== currentBook.id) {
      audio.pause();
      pendingSeekRef.current = targetProgress;
      audio.src = currentBook.audioUrl || "";
      loadedAudioBookIdRef.current = currentBook.id;

      if (currentBook.audioUrl) {
        audio.load();
      }

      return;
    }

    if (Math.abs(audio.currentTime - targetProgress) > 0.75) {
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
    if (!userId || !currentBook) {
      return;
    }

    void persistProgress({
      audiobookId: currentBook.id,
      progressSeconds: currentBook.progressSeconds,
      durationSeconds: currentBook.durationSeconds,
      markCurrent: true,
      force: true,
    });
  }, [currentBook, persistProgress, userId]);

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
      if (!userId || !activeBook) {
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
        force: true,
      });
    },
    [persistProgress, userId],
  );

  const loadBook = useCallback((book, nextPlaybackState = "loaded") => {
    if (!book?.id) {
      return;
    }

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

      setProgressMap((currentMap) => ({
        ...currentMap,
        [activeBook.id]: safeProgress,
      }));
      setLastOpenedBookId(activeBook.id);
    },
    [books],
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

    loadBook(activeBook, nextPlaybackState);
  }, [activeBook, loadBook]);

  return {
    books,
    currentBook,
    currentProgressSeconds,
    hasPlayableAudio: Boolean(currentBook?.audioUrl),
    isPlaying: playbackState === "playing",
    currentlyListeningBook,
    durationSeconds,
    loadBook,
    playbackState,
    progressPercent,
    closePlayer,
    returnToLibrary,
    savingProgress,
    seekTo,
    selectCurrentlyListening,
    skipBy,
    togglePlayback,
  };
}
