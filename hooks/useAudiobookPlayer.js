"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOCK_AUDIOBOOKS } from "@/lib/mockAudiobooks";

const AUDIOBOOK_PLAYER_STORAGE_KEY = "jp_audiobook_player_state";

function buildDefaultProgressMap() {
  return Object.fromEntries(
    MOCK_AUDIOBOOKS.map((book) => [book.id, Math.max(0, book.progressSeconds || 0)]),
  );
}

function clampProgress(progressSeconds, durationSeconds) {
  return Math.max(0, Math.min(durationSeconds, progressSeconds || 0));
}

function getInitialPlayerState() {
  const defaultProgressMap = buildDefaultProgressMap();

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

export function useAudiobookPlayer() {
  const initialState = useMemo(() => getInitialPlayerState(), []);
  const [currentBookId, setCurrentBookId] = useState(initialState.currentBookId);
  const [lastOpenedBookId, setLastOpenedBookId] = useState(initialState.lastOpenedBookId);
  const [progressMap, setProgressMap] = useState(initialState.progressMap);
  const [playbackState, setPlaybackState] = useState(
    initialState.currentBookId ? "paused" : "idle",
  );
  const currentBookIdRef = useRef(currentBookId);
  const playbackStateRef = useRef(playbackState);

  const books = useMemo(
    () =>
      MOCK_AUDIOBOOKS.map((book) => {
        const progressSeconds = clampProgress(progressMap[book.id], book.durationSeconds);
        const progressPercent = book.durationSeconds
          ? (progressSeconds / book.durationSeconds) * 100
          : 0;

        return {
          ...book,
          progressSeconds,
          progressPercent,
          remainingSeconds: Math.max(0, book.durationSeconds - progressSeconds),
          isFinished: progressSeconds >= book.durationSeconds,
        };
      }),
    [progressMap],
  );

  const currentBook = useMemo(
    () => books.find((book) => book.id === currentBookId) || null,
    [books, currentBookId],
  );

  const currentProgressSeconds = currentBook?.progressSeconds || 0;
  const durationSeconds = currentBook?.durationSeconds || 0;
  const progressPercent = currentBook?.progressPercent || 0;

  const currentlyListeningBook = useMemo(() => {
    if (currentBook) {
      return currentBook;
    }

    if (lastOpenedBookId) {
      const lastOpenedBook = books.find((book) => book.id === lastOpenedBookId);
      if (lastOpenedBook) {
        return lastOpenedBook;
      }
    }

    const inProgressBook = books
      .filter((book) => book.progressSeconds > 0 && book.progressSeconds < book.durationSeconds)
      .sort((left, right) => right.progressSeconds - left.progressSeconds)[0];

    return inProgressBook || books[0] || null;
  }, [books, currentBook, lastOpenedBookId]);

  useEffect(() => {
    currentBookIdRef.current = currentBookId;
  }, [currentBookId]);

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      AUDIOBOOK_PLAYER_STORAGE_KEY,
      JSON.stringify({
        currentBookId,
        lastOpenedBookId,
        progressMap,
      }),
    );
  }, [currentBookId, lastOpenedBookId, progressMap]);

  useEffect(() => {
    if (playbackState !== "playing" || !currentBook) {
      return;
    }

    const timer = window.setInterval(() => {
      setProgressMap((currentMap) => {
        const currentProgress = clampProgress(currentMap[currentBook.id], currentBook.durationSeconds);
        const nextProgress = clampProgress(currentProgress + 1, currentBook.durationSeconds);

        if (nextProgress === currentProgress) {
          if (nextProgress >= currentBook.durationSeconds && playbackStateRef.current === "playing") {
            setPlaybackState("paused");
          }
          return currentMap;
        }

        if (nextProgress >= currentBook.durationSeconds && playbackStateRef.current === "playing") {
          setPlaybackState("paused");
        }

        return {
          ...currentMap,
          [currentBook.id]: nextProgress,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentBook, playbackState]);

  const loadBook = useCallback((bookId) => {
    if (!bookId) {
      return;
    }

    setCurrentBookId(bookId);
    setLastOpenedBookId(bookId);
    setPlaybackState("loaded");
  }, []);

  const returnToLibrary = useCallback(() => {
    setPlaybackState("idle");
    setCurrentBookId(null);
  }, []);

  const togglePlayback = useCallback(() => {
    if (!currentBookIdRef.current) {
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

  const selectCurrentlyListening = useCallback(() => {
    if (!currentlyListeningBook?.id) {
      return;
    }

    loadBook(currentlyListeningBook.id);
  }, [currentlyListeningBook, loadBook]);

  return {
    books,
    currentBook,
    currentProgressSeconds,
    currentlyListeningBook,
    durationSeconds,
    loadBook,
    playbackState,
    progressPercent,
    returnToLibrary,
    seekTo,
    selectCurrentlyListening,
    skipBy,
    togglePlayback,
  };
}
