"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  BarChart3,
  ChevronDown,
  CloudUpload,
  Languages,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Sparkles,
  SlidersHorizontal,
  Volume2,
  X,
} from "lucide-react";
import NumberField from "@/components/ui/NumberField";
import {
  DEFAULT_SHADOWING_SETTINGS,
  SHADOWING_SORT_MODES,
  SHADOWING_STORAGE_KEYS,
} from "@/lib/shadowing/constants";
import {
  buildShadowingQueue,
  calculateShadowingProgress,
  formatShadowingHours,
  normalizeShadowingSettings,
} from "@/lib/shadowing/session";
import {
  fetchProfileShadowingGoal,
  persistProfileShadowingGoal,
} from "@/lib/profiles";

const DEFAULT_SHADOWING_GOAL = 250;
const KANA_CHARACTER_REGEX = /[ぁ-ゖゝゞァ-ヺー]/;
const KANJI_CHARACTER_REGEX = /[一-龯々〆ヵヶ]/;

function getScopedStorageKey(baseKey, userId = "") {
  return userId ? `${baseKey}:${userId}` : baseKey;
}

function readStoredShadowingSettings(userId = "") {
  if (typeof window === "undefined") {
    return DEFAULT_SHADOWING_SETTINGS;
  }

  try {
    const parsedValue = JSON.parse(
      window.localStorage.getItem(getScopedStorageKey(SHADOWING_STORAGE_KEYS.settings, userId)) ||
        "null",
    );

    return normalizeShadowingSettings(parsedValue || DEFAULT_SHADOWING_SETTINGS);
  } catch {
    return DEFAULT_SHADOWING_SETTINGS;
  }
}

function readStoredGoal(userId = "") {
  if (typeof window === "undefined") {
    return DEFAULT_SHADOWING_GOAL;
  }

  const parsedValue = Number(
    window.localStorage.getItem(getScopedStorageKey(SHADOWING_STORAGE_KEYS.goal, userId)),
  );

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_SHADOWING_GOAL;
}

function readStoredBoolean(baseKey, userId = "", fallback = false) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(getScopedStorageKey(baseKey, userId));
  if (rawValue == null) {
    return fallback;
  }

  return rawValue === "true";
}

function readStoredDeckId(userId = "") {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(
    getScopedStorageKey(SHADOWING_STORAGE_KEYS.selectedDeckId, userId),
  ) || "";
}

function readStoredTotalReps(userId = "") {
  if (typeof window === "undefined") {
    return 0;
  }

  const parsedValue = Number(
    window.localStorage.getItem(getScopedStorageKey(SHADOWING_STORAGE_KEYS.totalReps, userId)),
  );

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function formatSeconds(value) {
  const totalSeconds = Math.max(0, Number(value) || 0);
  if (totalSeconds >= 60) {
    return `${Math.round(totalSeconds)}s`;
  }

  return `${totalSeconds.toFixed(totalSeconds % 1 === 0 ? 0 : 1)}s`;
}

function clampIndex(value, maxLength) {
  if (!maxLength) {
    return 0;
  }

  return Math.max(0, Math.min(maxLength - 1, Number(value) || 0));
}

function katakanaToHiragana(value) {
  return String(value || "").replace(/[ァ-ヶ]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0x60),
  );
}

function normalizeKanaForMatch(value) {
  return katakanaToHiragana(String(value || ""));
}

function isKanaCharacter(character) {
  return KANA_CHARACTER_REGEX.test(character);
}

function isKanjiCharacter(character) {
  return KANJI_CHARACTER_REGEX.test(character);
}

function isRenderableRubyCharacter(character) {
  return isKanjiCharacter(character);
}

function buildBracketFuriganaSegments(text) {
  const normalizedText = String(text || "");
  const matcher = /([一-龯々〆ヵヶ]+)[（(【\[]([^）)】\]]+)[）)】\]]/g;
  const segments = [];
  let cursor = 0;
  let matchedAny = false;

  for (const match of normalizedText.matchAll(matcher)) {
    matchedAny = true;
    const matchedText = match[0] || "";
    const baseText = match[1] || "";
    const furiganaText = match[2] || "";
    const matchIndex = Number(match.index || 0);

    if (matchIndex > cursor) {
      segments.push({
        type: "text",
        text: normalizedText.slice(cursor, matchIndex),
      });
    }

    segments.push({
      type: "ruby",
      base: baseText,
      reading: furiganaText,
    });

    cursor = matchIndex + matchedText.length;
  }

  if (!matchedAny) {
    return null;
  }

  if (cursor < normalizedText.length) {
    segments.push({
      type: "text",
      text: normalizedText.slice(cursor),
    });
  }

  return segments;
}

function buildAlignedFuriganaSegments(text, reading) {
  const baseText = String(text || "");
  const readingText = String(reading || "");

  if (!baseText || !readingText) {
    return [{ type: "text", text: baseText }];
  }

  const normalizedReading = normalizeKanaForMatch(readingText);
  const segments = [];
  let readingIndex = 0;
  let cursor = 0;

  while (cursor < baseText.length) {
    const character = baseText[cursor];

    if (!isRenderableRubyCharacter(character)) {
      if (
        isKanaCharacter(character) &&
        normalizeKanaForMatch(character) === normalizedReading[readingIndex]
      ) {
        readingIndex += 1;
      }

      segments.push({
        type: "text",
        text: character,
      });
      cursor += 1;
      continue;
    }

    let kanjiEnd = cursor + 1;
    while (kanjiEnd < baseText.length && isRenderableRubyCharacter(baseText[kanjiEnd])) {
      kanjiEnd += 1;
    }

    const kanjiChunk = baseText.slice(cursor, kanjiEnd);
    let nextLiteralKana = "";
    let literalCursor = kanjiEnd;

    while (literalCursor < baseText.length && isKanaCharacter(baseText[literalCursor])) {
      nextLiteralKana += baseText[literalCursor];
      literalCursor += 1;
    }

    const normalizedLiteralKana = normalizeKanaForMatch(nextLiteralKana);
    const nextLiteralIndex = normalizedLiteralKana
      ? normalizedReading.indexOf(normalizedLiteralKana, readingIndex)
      : -1;

    const rubyReading =
      nextLiteralIndex >= 0
        ? readingText.slice(readingIndex, nextLiteralIndex)
        : readingText.slice(readingIndex);

    if (rubyReading) {
      segments.push({
        type: "ruby",
        base: kanjiChunk,
        reading: rubyReading,
      });
      readingIndex += rubyReading.length;
    } else {
      segments.push({
        type: "text",
        text: kanjiChunk,
      });
    }

    if (nextLiteralKana) {
      segments.push({
        type: "text",
        text: nextLiteralKana,
      });
      readingIndex += nextLiteralKana.length;
      cursor = literalCursor;
      continue;
    }

    cursor = kanjiEnd;
  }

  return segments;
}

function buildRubySegments(text, reading = "") {
  const normalizedText = String(text || "");
  const normalizedReading = String(reading || "");

  if (!normalizedText) {
    return [];
  }

  if (!normalizedReading) {
    return [{ type: "text", text: normalizedText }];
  }

  return (
    buildBracketFuriganaSegments(normalizedText) ||
    buildBracketFuriganaSegments(normalizedReading) ||
    buildAlignedFuriganaSegments(normalizedText, normalizedReading)
  );
}

function hasRubyReading(text, reading = "") {
  return buildRubySegments(text, reading).some((segment) => segment.type === "ruby" && segment.reading);
}

function RubyText({ text, reading = "", style = null, rubyStyle = null, rtStyle = null }) {
  const segments = buildRubySegments(text, reading);

  return (
    <span style={style}>
      {segments.map((segment, index) => {
        if (segment.type === "ruby" && segment.reading) {
          return (
            <ruby key={`${segment.base}-${segment.reading}-${index}`} style={rubyStyle}>
              {segment.base}
              <rt style={rtStyle}>{segment.reading}</rt>
            </ruby>
          );
        }

        return <span key={`${segment.text}-${index}`}>{segment.text}</span>;
      })}
    </span>
  );
}

async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "Request failed.");
  }

  return payload;
}

function createImportSessionId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `shadowing-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function fetchShadowingImportStatus(sessionId) {
  const response = await fetch(`/api/shadowing/import-status?sessionId=${encodeURIComponent(sessionId)}`, {
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));

  if (response.status === 404) {
    return null;
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "Failed to load shadowing import progress.");
  }

  return payload?.status || null;
}

function formatImportProgressSummary(snapshot, uploadProgress) {
  const totalCards = Number(snapshot?.totalCards || 0);
  const currentCard = Math.max(
    Number(snapshot?.currentCard || 0),
    Number(snapshot?.processedCards || 0),
  );

  if (totalCards > 0) {
    return `${Math.min(currentCard, totalCards)}/${totalCards}`;
  }

  return uploadProgress ? `${uploadProgress}%` : "Waiting";
}

async function uploadShadowingDeckRequest(formData, { onProgress, onProcessing } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let processingTriggered = false;
    let processingFallbackTimeoutId = null;

    const triggerProcessing = () => {
      if (processingTriggered) {
        return;
      }

      processingTriggered = true;
      onProcessing?.();
    };

    const clearProcessingFallback = () => {
      if (processingFallbackTimeoutId) {
        window.clearTimeout(processingFallbackTimeoutId);
        processingFallbackTimeoutId = null;
      }
    };

    xhr.open("POST", "/api/shadowing/decks");
    xhr.responseType = "text";
    processingFallbackTimeoutId = window.setTimeout(() => {
      triggerProcessing();
    }, 12000);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const progress = Math.max(6, Math.min(72, Math.round((event.loaded / event.total) * 72)));
      onProgress?.(progress);

      if (event.loaded >= event.total) {
        triggerProcessing();
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState >= 2) {
        triggerProcessing();
      }
    };

    xhr.onerror = () => {
      clearProcessingFallback();
      reject(
        new Error(
          "Upload failed before the server could respond. Check the browser Network tab and the local server terminal for the real error.",
        ),
      );
    };

    xhr.onload = () => {
      clearProcessingFallback();
      let payload = {};
      const rawResponseText = String(xhr.responseText || "").trim();

      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {
        payload = {};
      }

      if (xhr.status < 200 || xhr.status >= 300 || !payload?.ok) {
        const fallbackMessage = rawResponseText
          ? rawResponseText.replace(/\s+/g, " ").slice(0, 240)
          : xhr.statusText || "Upload failed.";
        reject(
          new Error(
            payload?.error ||
              `Upload failed (${xhr.status || "unknown status"}). ${fallbackMessage}`,
          ),
        );
        return;
      }

      resolve(payload);
    };

    xhr.onabort = () => {
      clearProcessingFallback();
      reject(new Error("Upload was cancelled before the import finished."));
    };

    xhr.send(formData);
  });
}

function logShadowingDebug(eventName, payload) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.debug(`[Shadowing] ${eventName}`, payload);
}

const SHADOWING_PLAYBACK_RATE_OPTIONS = [
  { value: 0.75, label: "0.75x" },
  { value: 0.9, label: "0.9x" },
  { value: 1, label: "1x" },
  { value: 1.1, label: "1.1x" },
  { value: 1.25, label: "1.25x" },
];

export default function ShadowingWorkspace({
  styles,
  shadowingHours,
  setShadowingHours,
  isCompact = false,
  isMobile = false,
  authUserId = "",
}) {
  const [decks, setDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(Boolean(authUserId));
  const [decksError, setDecksError] = useState("");
  const [deckCardsById, setDeckCardsById] = useState({});
  const [deckCardsLoadedById, setDeckCardsLoadedById] = useState({});
  const [cardsLoadingDeckId, setCardsLoadingDeckId] = useState("");
  const [deckCardsError, setDeckCardsError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deckActionStatus, setDeckActionStatus] = useState("");
  const [importSessionId, setImportSessionId] = useState("");
  const [importProgressSnapshot, setImportProgressSnapshot] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);
  const [isMobileSessionOpen, setIsMobileSessionOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadMode, setUploadMode] = useState("new");
  const [uploadTargetDeckId, setUploadTargetDeckId] = useState("");
  const [uploadDeckName, setUploadDeckName] = useState("");
  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [selectedDeckId, setSelectedDeckId] = useState(() => readStoredDeckId(authUserId));
  const [deckNameDraft, setDeckNameDraft] = useState("");
  const [savingDeckName, setSavingDeckName] = useState(false);
  const [settings, setSettings] = useState(() => readStoredShadowingSettings(authUserId));
  const [goalHours, setGoalHours] = useState(() => readStoredGoal(authUserId));
  const [goalHydrated, setGoalHydrated] = useState(false);
  const [vocabularyOpen, setVocabularyOpen] = useState(() =>
    readStoredBoolean(SHADOWING_STORAGE_KEYS.vocabularyOpen, authUserId, false),
  );
  const [totalReps, setTotalReps] = useState(() => readStoredTotalReps(authUserId));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sessionNotice, setSessionNotice] = useState("");
  const [showInlineEnglish, setShowInlineEnglish] = useState(
    () => readStoredShadowingSettings(authUserId).showEnglish,
  );
  const [showInlineReading, setShowInlineReading] = useState(
    () => readStoredShadowingSettings(authUserId).showReading,
  );
  const audioRef = useRef(null);
  const vocabularyAudioRef = useRef(null);
  const fileInputRef = useRef(null);
  const skipNextGoalPersistRef = useRef(false);
  const playbackRef = useRef({
    phase: "idle",
    timeoutId: null,
    dueAt: 0,
    remainingMs: 0,
    gapKind: "",
    resumeAction: null,
    index: 0,
    repetition: 1,
  });
  const queueRef = useRef([]);
  const settingsRef = useRef(settings);
  const isPlayingRef = useRef(false);
  const currentIndexRef = useRef(currentIndex);
  const currentRepetitionRef = useRef(currentRepetition);
  const sessionClockRef = useRef({
    elapsedMs: 0,
    startedAt: 0,
  });
  const sessionCommitRef = useRef(false);

  const selectedDeck = useMemo(() => {
    const baseDeck = decks.find((deck) => deck.id === selectedDeckId) || null;
    if (!baseDeck) {
      return null;
    }

    const cards = Array.isArray(deckCardsById[baseDeck.id]) ? deckCardsById[baseDeck.id] : [];
    const cardsLoaded = Boolean(deckCardsLoadedById[baseDeck.id]);
    const playableCount = cardsLoaded
      ? cards.filter((card) => card?.isAudioAvailable).length
      : 0;
    const noteCount = Number(baseDeck?.noteCount ?? baseDeck?.totalCards ?? 0);

    return {
      ...baseDeck,
      noteCount,
      cards,
      cardsLoaded,
      playableCount,
      textOnlyCount: cardsLoaded ? Math.max(0, cards.length - playableCount) : 0,
    };
  }, [deckCardsById, deckCardsLoadedById, decks, selectedDeckId]);
  const selectedDeckCardsLoading = Boolean(selectedDeckId && cardsLoadingDeckId === selectedDeckId);
  const queueSettings = useMemo(
    () => ({
      sentenceCount: settings.sentenceCount,
      repetitions: settings.repetitions,
      repeatGapSeconds: settings.repeatGapSeconds,
      sentenceGapSeconds: settings.sentenceGapSeconds,
      shuffle: false,
      sortMode: settings.sortMode,
    }),
    [
      settings.repeatGapSeconds,
      settings.repetitions,
      settings.sentenceCount,
      settings.sentenceGapSeconds,
      settings.sortMode,
    ],
  );
  const sessionQueue = useMemo(
    () => buildShadowingQueue(selectedDeck?.cards || [], queueSettings),
    [queueSettings, selectedDeck?.cards],
  );
  const displayCards = selectedDeck?.cards || [];
  const currentCard =
    sessionQueue[currentIndex] ||
    displayCards.find((card) => card.isAudioAvailable) ||
    displayCards[0] ||
    null;
  const translationVisible = settings.showEnglish && showInlineEnglish;
  const readingVisible = settings.showReading && showInlineReading;
  const sessionProgress = calculateShadowingProgress(
    currentIndex,
    currentRepetition,
    sessionQueue.length,
    settings.repetitions,
  );
  const visibleSessionProgress = sessionCompleted ? 100 : sessionProgress;
  const goalProgress = Math.max(
    0,
    Math.min(100, (Number(shadowingHours || 0) / Math.max(1, Number(goalHours || 0))) * 100),
  );
  const numericFieldMobileOptimized = isMobile || isCompact;
  const sentenceAudioUrl = currentCard?.hasSentenceAudio
    ? `/api/shadowing/media/${currentCard.id}?kind=sentence`
    : "";
  const vocabularyAudioUrl = currentCard?.hasVocabAudio
    ? `/api/shadowing/media/${currentCard.id}?kind=vocabulary`
    : "";
  const activeImportProgressSnapshot =
    importProgressSnapshot && importProgressSnapshot.sessionId === importSessionId
      ? importProgressSnapshot
      : null;
  const hasVisibleImportProgress = Boolean(
    uploading ||
      uploadStatus ||
      (activeImportProgressSnapshot &&
        !activeImportProgressSnapshot.isComplete &&
        !activeImportProgressSnapshot.isError),
  );
  const uploadProgressSummary = formatImportProgressSummary(
    activeImportProgressSnapshot,
    uploadProgress,
  );

  queueRef.current = sessionQueue;
  settingsRef.current = settings;
  isPlayingRef.current = isPlaying;
  currentIndexRef.current = currentIndex;
  currentRepetitionRef.current = currentRepetition;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = settings.playbackRate;
      audioRef.current.defaultPlaybackRate = settings.playbackRate;
    }

    if (vocabularyAudioRef.current) {
      vocabularyAudioRef.current.playbackRate = settings.playbackRate;
      vocabularyAudioRef.current.defaultPlaybackRate = settings.playbackRate;
    }
  }, [settings.playbackRate]);

  const pauseSessionClock = useCallback(() => {
    if (!sessionClockRef.current.startedAt) {
      return;
    }

    sessionClockRef.current.elapsedMs += Date.now() - sessionClockRef.current.startedAt;
    sessionClockRef.current.startedAt = 0;
  }, []);

  const resumeSessionClock = useCallback(() => {
    if (sessionClockRef.current.startedAt) {
      return;
    }

    sessionClockRef.current.startedAt = Date.now();
  }, []);

  const resetSessionClock = useCallback(() => {
    sessionClockRef.current = {
      elapsedMs: 0,
      startedAt: 0,
    };
  }, []);

  const getElapsedSessionMs = useCallback(() => {
    return (
      sessionClockRef.current.elapsedMs +
      (sessionClockRef.current.startedAt ? Date.now() - sessionClockRef.current.startedAt : 0)
    );
  }, []);

  const clearPendingGap = useCallback(() => {
    if (playbackRef.current.timeoutId) {
      window.clearTimeout(playbackRef.current.timeoutId);
      playbackRef.current.timeoutId = null;
    }
  }, []);

  const hardStopPlayback = useCallback(
    ({ resetAudio = true, preserveSelection = true } = {}) => {
      clearPendingGap();
      pauseSessionClock();
      setIsPlaying(false);
      isPlayingRef.current = false;
      playbackRef.current = {
        phase: "idle",
        timeoutId: null,
        dueAt: 0,
        remainingMs: 0,
        gapKind: "",
        resumeAction: null,
        index: preserveSelection ? currentIndexRef.current : 0,
        repetition: preserveSelection ? currentRepetitionRef.current : 1,
      };

      if (audioRef.current) {
        audioRef.current.pause();
        if (resetAudio) {
          audioRef.current.currentTime = 0;
        }
      }
    },
    [clearPendingGap, pauseSessionClock],
  );

  const startGap = useCallback(
    (gapKind, durationMs, resumeAction) => {
      clearPendingGap();

      if (durationMs <= 0) {
        resumeAction();
        return;
      }

      playbackRef.current = {
        ...playbackRef.current,
        phase: "gap",
        gapKind,
        dueAt: Date.now() + durationMs,
        remainingMs: durationMs,
        resumeAction,
        timeoutId: window.setTimeout(() => {
          playbackRef.current.timeoutId = null;
          resumeAction();
        }, durationMs),
      };
    },
    [clearPendingGap],
  );

  const finishSession = useCallback(async () => {
    if (sessionCommitRef.current) {
      return;
    }

    sessionCommitRef.current = true;
    pauseSessionClock();
    clearPendingGap();
    setIsPlaying(false);
    setSessionCompleted(true);
    setSessionNotice("Session complete. Nice work.");

    const queueLength = queueRef.current.length;
    const repetitions = settingsRef.current.repetitions;
    const elapsedMs = getElapsedSessionMs();
    const elapsedHours = elapsedMs / 3_600_000;
    const elapsedSeconds = Math.max(1, Math.round(elapsedMs / 1000));
    const completedReps = queueLength * repetitions;

    playbackRef.current = {
      phase: "completed",
      timeoutId: null,
      dueAt: 0,
      remainingMs: 0,
      gapKind: "",
      resumeAction: null,
      index: Math.max(0, queueLength - 1),
      repetition: repetitions,
    };

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (elapsedHours > 0) {
      setShadowingHours((currentValue) => currentValue + elapsedHours, {
        kind: "session",
        source: "shadowing",
        note: selectedDeck?.name
          ? `${selectedDeck.name}: ${queueLength} sentences x ${repetitions} reps`
          : `Shadowing session: ${queueLength} sentences x ${repetitions} reps`,
      });
    }

    setTotalReps((currentValue) => currentValue + completedReps);

    if (authUserId) {
      try {
        await fetch("/api/shadowing/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deckId: selectedDeck?.id || null,
            elapsedSeconds,
            completedSentences: queueLength,
            completedReps,
          }),
        });
      } catch (error) {
        console.error("Failed to persist shadowing session stats", error);
      }
    }
  }, [
    authUserId,
    clearPendingGap,
    getElapsedSessionMs,
    pauseSessionClock,
    selectedDeck?.id,
    selectedDeck?.name,
    setShadowingHours,
  ]);

  const playSentenceAt = useCallback(
    async (index, repetition, { resumeAudio = false } = {}) => {
      const queue = queueRef.current;
      const card = queue[index];

      if (!card) {
        await finishSession();
        return;
      }

      const audioNode = audioRef.current;
      if (!audioNode) {
        return;
      }

      const audioUrl = card.hasSentenceAudio
        ? `/api/shadowing/media/${card.id}?kind=sentence`
        : "";

      if (!audioUrl) {
        if (index >= queue.length - 1) {
          await finishSession();
          return;
        }

        setCurrentIndex(index + 1);
        setCurrentRepetition(1);
        await playSentenceAt(index + 1, 1);
        return;
      }

      setCurrentIndex(index);
      setCurrentRepetition(repetition);
      setSessionCompleted(false);
      playbackRef.current = {
        ...playbackRef.current,
        phase: "audio",
        index,
        repetition,
        remainingMs: 0,
        dueAt: 0,
        gapKind: "",
        resumeAction: null,
      };

      if (!resumeAudio || audioNode.src !== new URL(audioUrl, window.location.origin).toString()) {
        audioNode.src = audioUrl;
      }

      if (!resumeAudio) {
        audioNode.currentTime = 0;
      }

      audioNode.playbackRate = settingsRef.current.playbackRate;
      audioNode.defaultPlaybackRate = settingsRef.current.playbackRate;

      try {
        await audioNode.play();
      } catch (error) {
        console.error("Failed to play shadowing audio", error);
        setSessionNotice("This sentence audio could not be played. Skipping ahead.");

        if (index >= queue.length - 1) {
          await finishSession();
          return;
        }

        startGap("sentence", settingsRef.current.sentenceGapSeconds * 1000, () => {
          void playSentenceAt(index + 1, 1);
        });
      }
    },
    [finishSession, startGap],
  );

  const resetSessionPosition = useCallback(() => {
    setCurrentIndex(0);
    setCurrentRepetition(1);
    setSessionCompleted(false);
    setSessionNotice("");
    sessionCommitRef.current = false;
    playbackRef.current = {
      phase: "idle",
      timeoutId: null,
      dueAt: 0,
      remainingMs: 0,
      gapKind: "",
      resumeAction: null,
      index: 0,
      repetition: 1,
    };
    resetSessionClock();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [resetSessionClock]);

  const handleAudioEnded = useCallback(() => {
    if (!isPlayingRef.current) {
      return;
    }

    const { index, repetition } = playbackRef.current;
    const queueLength = queueRef.current.length;
    const repetitions = settingsRef.current.repetitions;

    if (repetition < repetitions) {
      startGap("repeat", settingsRef.current.repeatGapSeconds * 1000, () => {
        void playSentenceAt(index, repetition + 1);
      });
      return;
    }

    if (index < queueLength - 1) {
      startGap("sentence", settingsRef.current.sentenceGapSeconds * 1000, () => {
        void playSentenceAt(index + 1, 1);
      });
      return;
    }

    void finishSession();
  }, [finishSession, playSentenceAt, startGap]);

  const handlePlayPause = useCallback(async () => {
    if (!sessionQueue.length) {
      return;
    }

    let startIndex = clampIndex(currentIndex, sessionQueue.length);
    let startRepetition = clampIndex(currentRepetition - 1, settings.repetitions) + 1;

    if (isPlayingRef.current) {
      setIsPlaying(false);
      pauseSessionClock();

      if (playbackRef.current.phase === "gap") {
        clearPendingGap();
        playbackRef.current.remainingMs = Math.max(0, playbackRef.current.dueAt - Date.now());
      }

      if (playbackRef.current.phase === "audio" && audioRef.current) {
        audioRef.current.pause();
      }

      return;
    }

    if (sessionCompleted || currentIndex >= sessionQueue.length) {
      resetSessionPosition();
      startIndex = 0;
      startRepetition = 1;
    }

    setSessionNotice("");
    setIsPlaying(true);
    resumeSessionClock();

    if (playbackRef.current.phase === "audio" && audioRef.current?.src) {
      await playSentenceAt(playbackRef.current.index, playbackRef.current.repetition, {
        resumeAudio: true,
      });
      return;
    }

    if (playbackRef.current.phase === "gap" && playbackRef.current.resumeAction) {
      startGap(
        playbackRef.current.gapKind,
        playbackRef.current.remainingMs || 0,
        playbackRef.current.resumeAction,
      );
      return;
    }

    await playSentenceAt(startIndex, startRepetition);
  }, [
    clearPendingGap,
    currentIndex,
    currentRepetition,
    pauseSessionClock,
    playSentenceAt,
    resetSessionPosition,
    resumeSessionClock,
    sessionCompleted,
    sessionQueue.length,
    settings.repetitions,
    startGap,
  ]);

  const handleOpenMobileSession = useCallback(async () => {
    setIsMobileSessionOpen(true);

    if (!isPlayingRef.current && sessionQueue.length) {
      await handlePlayPause();
    }
  }, [handlePlayPause, sessionQueue.length]);

  const handleCloseMobileSession = useCallback(async () => {
    if (isPlayingRef.current) {
      await handlePlayPause();
    }

    setIsMobileSessionOpen(false);
  }, [handlePlayPause]);

  const handleVocabularyAudio = useCallback(async () => {
    if (!vocabularyAudioUrl || !vocabularyAudioRef.current) {
      return;
    }

    vocabularyAudioRef.current.src = vocabularyAudioUrl;
    vocabularyAudioRef.current.currentTime = 0;
    vocabularyAudioRef.current.playbackRate = settingsRef.current.playbackRate;
    vocabularyAudioRef.current.defaultPlaybackRate = settingsRef.current.playbackRate;

    try {
      await vocabularyAudioRef.current.play();
    } catch (error) {
      console.error("Failed to play vocabulary audio", error);
    }
  }, [vocabularyAudioUrl]);

  const loadDecks = useCallback(async () => {
    if (!authUserId) {
      setDecks([]);
      setDeckCardsById({});
      setDeckCardsLoadedById({});
      setCardsLoadingDeckId("");
      setDecksLoading(false);
      setDecksError("Sign in to import and save shadowing decks.");
      setDeckCardsError("");
      setTotalReps(0);
      return;
    }

    setDecksLoading(true);
    setDecksError("");
    setDeckCardsError("");

    try {
      const payload = await parseJsonResponse(await fetch("/api/shadowing/decks"));
      const availableDecks = Array.isArray(payload?.decks) ? payload.decks : [];
      logShadowingDebug("loaded decks", availableDecks);
      setDecks(availableDecks);
      setDeckCardsById({});
      setDeckCardsLoadedById({});

      const nextDeckId = (() => {
        const storedDeckId = readStoredDeckId(authUserId);

        if (availableDecks.some((deck) => deck.id === storedDeckId)) {
          return storedDeckId;
        }

        if (availableDecks.length === 1) {
          return availableDecks[0].id || "";
        }

        return "";
      })();

      setSelectedDeckId(nextDeckId);
    } catch (error) {
      console.error("Failed to load shadowing decks", error);
      setDecksError(error instanceof Error ? error.message : "Failed to load shadowing decks.");
    } finally {
      setDecksLoading(false);
    }
  }, [authUserId]);

  const loadSelectedDeck = useCallback(
    async (deckId, { force = false } = {}) => {
      const normalizedDeckId = String(deckId || "").trim();
      if (!authUserId || !normalizedDeckId) {
        return;
      }

      if (!force && deckCardsLoadedById[normalizedDeckId]) {
        return;
      }

      setCardsLoadingDeckId(normalizedDeckId);
      setDeckCardsError("");

      try {
        const payload = await parseJsonResponse(
          await fetch(`/api/shadowing/decks?deckId=${encodeURIComponent(normalizedDeckId)}`),
        );
        const loadedDeck = payload?.deck || null;
        const cards = Array.isArray(loadedDeck?.cards) ? loadedDeck.cards : [];
        logShadowingDebug("card query result count", {
          deckId: normalizedDeckId,
          cardCount: cards.length,
        });

        setDecks((currentDecks) =>
          currentDecks.map((deck) =>
            deck.id === normalizedDeckId
              ? {
                  ...deck,
                  noteCount: Number(loadedDeck?.noteCount ?? deck.noteCount ?? deck.totalCards ?? 0),
                  totalCards: Number(loadedDeck?.noteCount ?? deck.totalCards ?? deck.noteCount ?? 0),
                  total_cards: Number(loadedDeck?.noteCount ?? deck.total_cards ?? deck.totalCards ?? 0),
                  importedAt: loadedDeck?.importedAt || deck.importedAt || deck.createdAt || null,
                  createdAt: loadedDeck?.importedAt || deck.createdAt || deck.importedAt || null,
                  created_at: loadedDeck?.importedAt || deck.created_at || deck.createdAt || null,
                }
              : deck,
          ),
        );
        setDeckCardsById((currentValue) => ({
          ...currentValue,
          [normalizedDeckId]: cards,
        }));
        setDeckCardsLoadedById((currentValue) => ({
          ...currentValue,
          [normalizedDeckId]: true,
        }));
      } catch (error) {
        console.error("Failed to load selected shadowing deck", error);
        setDeckCardsError(
          error instanceof Error ? error.message : "Failed to load the selected deck cards.",
        );
      } finally {
        setCardsLoadingDeckId((currentValue) =>
          currentValue === normalizedDeckId ? "" : currentValue,
        );
      }
    },
    [authUserId, deckCardsLoadedById],
  );

  const persistSelectedDeck = useCallback((deckId) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getScopedStorageKey(SHADOWING_STORAGE_KEYS.selectedDeckId, authUserId),
      String(deckId || ""),
    );
  }, [authUserId]);

  const handleDeckImport = useCallback(
    async () => {
      const file = pendingUploadFile;
      if (!file) {
        return;
      }

      if (!authUserId) {
        setUploadStatus("Sign in before importing a shadowing deck.");
        return;
      }

      setUploading(true);
      setUploadProgress(8);
      setUploadStatus(`Uploading ${file.name}...`);
      setDecksError("");
      const nextImportSessionId = createImportSessionId();
      setImportSessionId(nextImportSessionId);
      setImportProgressSnapshot({
        sessionId: nextImportSessionId,
        stage: "uploading",
        statusText: `Uploading ${file.name}...`,
        totalCards: 0,
        processedCards: 0,
        currentCard: 0,
        progressPercent: 8,
        isComplete: false,
        isError: false,
        error: "",
      });

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("importSessionId", nextImportSessionId);
        if (uploadMode === "existing" && uploadTargetDeckId) {
          formData.append("targetDeckId", uploadTargetDeckId);
        }
        if (uploadDeckName.trim()) {
          formData.append("deckName", uploadDeckName.trim());
        }

        const payload = await uploadShadowingDeckRequest(formData, {
          onProgress: (progress) => {
            setUploadProgress(progress);
          },
          onProcessing: () => {
            setUploadProgress((currentValue) => Math.max(currentValue, 84));
            setUploadStatus(`Importing ${file.name}... this can take a few minutes for large decks.`);
          },
        });

        const nextDecks = Array.isArray(payload?.decks) ? payload.decks : [];
        const nextSelectedDeckId = payload?.importedDeckId || "";
        setDecks(nextDecks);
        setDeckCardsById((currentValue) => {
          if (!nextSelectedDeckId) {
            return currentValue;
          }

          const nextValue = { ...currentValue };
          delete nextValue[nextSelectedDeckId];
          return nextValue;
        });
        setDeckCardsLoadedById((currentValue) => {
          if (!nextSelectedDeckId) {
            return currentValue;
          }

          const nextValue = { ...currentValue };
          delete nextValue[nextSelectedDeckId];
          return nextValue;
        });
        setSelectedDeckId(nextSelectedDeckId);
        persistSelectedDeck(nextSelectedDeckId);
        setUploadProgress(100);
        setUploadStatus(`Imported ${file.name}.`);
        setImportProgressSnapshot((currentValue) =>
          currentValue
            ? {
                ...currentValue,
                importedDeckId: nextSelectedDeckId,
                progressPercent: 100,
                isComplete: true,
                isError: false,
                statusText: `Imported ${file.name}.`,
              }
            : currentValue,
        );
        setDeckActionStatus(
          uploadMode === "existing"
            ? `Added ${file.name} to ${uploadDeckName.trim() || selectedDeck?.name || "that deck"}.`
            : `Created ${uploadDeckName.trim() || payload?.decks?.[0]?.name || "a new deck"}.`,
        );
        setIsUploadModalOpen(false);
        setPendingUploadFile(null);
      } catch (error) {
        console.error("Failed to import shadowing deck", error);
        setUploadProgress(0);
        setUploadStatus(error instanceof Error ? error.message : "Upload failed.");
        setImportProgressSnapshot((currentValue) =>
          currentValue
            ? {
                ...currentValue,
                isError: true,
                isComplete: false,
                error: error instanceof Error ? error.message : "Upload failed.",
                statusText: error instanceof Error ? error.message : "Upload failed.",
              }
            : currentValue,
        );
        setDecksError(error instanceof Error ? error.message : "Failed to import the deck.");
      } finally {
        setUploading(false);
      }
    },
    [
      authUserId,
      pendingUploadFile,
      persistSelectedDeck,
      selectedDeck?.name,
      uploadDeckName,
      uploadMode,
      uploadTargetDeckId,
    ],
  );

  const handleQueueUploadFile = useCallback(
    (file) => {
      if (!file) {
        return;
      }

      setPendingUploadFile(file);
      setUploadProgress(0);
      setUploadStatus(`${file.name} selected. Ready to upload.`);

      if (uploadMode === "new" && !uploadDeckName.trim()) {
        setUploadDeckName(file.name.replace(/\.apkg$/i, ""));
      }
    },
    [uploadDeckName, uploadMode],
  );

  const handleRenameDeck = useCallback(async () => {
    if (!authUserId || !selectedDeck?.id || !deckNameDraft.trim()) {
      return;
    }

    setSavingDeckName(true);
    setDeckActionStatus("");
    setDecksError("");

    try {
      const payload = await parseJsonResponse(
        await fetch("/api/shadowing/decks", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deckId: selectedDeck.id,
            deckName: deckNameDraft.trim(),
          }),
        }),
      );

      setDecks(Array.isArray(payload?.decks) ? payload.decks : []);
      setDeckActionStatus(`Renamed deck to ${deckNameDraft.trim()}.`);
      setUploadDeckName(deckNameDraft.trim());
    } catch (error) {
      console.error("Failed to rename shadowing deck", error);
      setDecksError(error instanceof Error ? error.message : "Failed to rename the deck.");
    } finally {
      setSavingDeckName(false);
    }
  }, [authUserId, deckNameDraft, selectedDeck?.id]);

    const resetUploadForm = useCallback(
      (nextDeckId = "") => {
        setUploadMode(nextDeckId ? "existing" : "new");
        setUploadTargetDeckId(nextDeckId || selectedDeck?.id || decks[0]?.id || "");
        setUploadDeckName(nextDeckId ? selectedDeck?.name || "" : "");
        if (!uploading) {
          setPendingUploadFile(null);
          setUploadProgress(0);
          setUploadStatus("");
          setImportSessionId("");
          setImportProgressSnapshot(null);
        }
      },
      [decks, selectedDeck?.id, selectedDeck?.name, uploading],
    );

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    setSettings(readStoredShadowingSettings(authUserId));
    setSelectedDeckId(readStoredDeckId(authUserId));
    setVocabularyOpen(readStoredBoolean(SHADOWING_STORAGE_KEYS.vocabularyOpen, authUserId, false));
    setGoalHours(readStoredGoal(authUserId));
    setGoalHydrated(false);
    setTotalReps(readStoredTotalReps(authUserId));
    setDeckCardsById({});
    setDeckCardsLoadedById({});
    setCardsLoadingDeckId("");
    setDeckCardsError("");
    setImportSessionId("");
    setImportProgressSnapshot(null);
  }, [authUserId]);

  useEffect(() => {
    if (!importSessionId || !authUserId) {
      return undefined;
    }

    let cancelled = false;

    const syncImportProgress = async () => {
      try {
        const snapshot = await fetchShadowingImportStatus(importSessionId);
        if (!snapshot || cancelled) {
          return;
        }

        setImportProgressSnapshot(snapshot);
        if (snapshot.statusText) {
          setUploadStatus(snapshot.statusText);
        }
        if (Number.isFinite(snapshot.progressPercent)) {
          setUploadProgress(snapshot.progressPercent);
        }
        if (snapshot.isError && snapshot.error) {
          setDecksError(snapshot.error);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to sync shadowing import progress", error);
        }
      }
    };

    void syncImportProgress();
    const intervalId = window.setInterval(() => {
      void syncImportProgress();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authUserId, importSessionId]);

  useEffect(() => {
    if (!deckActionStatus) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setDeckActionStatus("");
    }, 4500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [deckActionStatus]);

  useEffect(() => {
    if (!uploadStatus || uploading) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setUploadStatus("");
      setUploadProgress(0);
      setImportSessionId("");
      setImportProgressSnapshot(null);
    }, 4500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [uploadStatus, uploading]);

  useEffect(() => {
    if (!isUploadModalOpen) {
      return;
    }

    resetUploadForm(uploadTargetDeckId || selectedDeck?.id || "");
  }, [isUploadModalOpen, resetUploadForm, selectedDeck?.id, uploadTargetDeckId]);

  useEffect(() => {
    if ((!isUploadModalOpen && !focusMode && !isMobileSessionOpen) || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [focusMode, isMobileSessionOpen, isUploadModalOpen]);

  useEffect(() => {
    if ((!focusMode && !isMobileSessionOpen) || typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (focusMode) {
          setFocusMode(false);
        }

        if (isMobileSessionOpen) {
          setIsMobileSessionOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusMode, isMobileSessionOpen]);

  useEffect(() => {
    resetSessionPosition();
    hardStopPlayback({ preserveSelection: false });
  }, [
    hardStopPlayback,
    resetSessionPosition,
    selectedDeckId,
    settings.repeatGapSeconds,
    settings.repetitions,
    settings.sentenceCount,
    settings.sentenceGapSeconds,
    settings.sortMode,
  ]);

  useEffect(() => {
    setDeckNameDraft(selectedDeck?.name || "");
    if (!uploadTargetDeckId && selectedDeck?.id) {
      setUploadTargetDeckId(selectedDeck.id);
    }
    if (!uploadDeckName && selectedDeck?.name) {
      setUploadDeckName(selectedDeck.name);
    }
  }, [selectedDeck?.id, selectedDeck?.name, uploadDeckName, uploadTargetDeckId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getScopedStorageKey(SHADOWING_STORAGE_KEYS.settings, authUserId),
      JSON.stringify(settings),
    );
  }, [authUserId, settings]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getScopedStorageKey(SHADOWING_STORAGE_KEYS.vocabularyOpen, authUserId),
      String(vocabularyOpen),
    );
  }, [authUserId, vocabularyOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getScopedStorageKey(SHADOWING_STORAGE_KEYS.goal, authUserId),
      String(goalHours),
    );
  }, [authUserId, goalHours]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getScopedStorageKey(SHADOWING_STORAGE_KEYS.totalReps, authUserId),
      String(Math.max(0, Math.round(totalReps))),
    );
  }, [authUserId, totalReps]);

  useEffect(() => {
    if (!authUserId) {
      skipNextGoalPersistRef.current = false;
      setGoalHydrated(true);
      return;
    }

    let isActive = true;

    void (async () => {
      const profileGoal = await fetchProfileShadowingGoal(authUserId);
      if (!isActive) {
        return;
      }

      if (profileGoal) {
        skipNextGoalPersistRef.current = true;
        setGoalHours(profileGoal);
      } else {
        skipNextGoalPersistRef.current = false;
      }

      setGoalHydrated(true);
    })();

    return () => {
      isActive = false;
    };
  }, [authUserId]);

  useEffect(() => {
    if (!goalHydrated || !authUserId) {
      return;
    }

    if (skipNextGoalPersistRef.current) {
      skipNextGoalPersistRef.current = false;
      return;
    }

    void persistProfileShadowingGoal(authUserId, goalHours);
  }, [authUserId, goalHours, goalHydrated]);

  useEffect(() => {
    setShowInlineEnglish(settings.showEnglish);
  }, [settings.showEnglish]);

  useEffect(() => {
    setShowInlineReading(settings.showReading);
  }, [settings.showReading]);

  useEffect(() => {
    if (!selectedDeckId) {
      return;
    }

    persistSelectedDeck(selectedDeckId);
  }, [persistSelectedDeck, selectedDeckId]);

  useEffect(() => {
    logShadowingDebug("selectedDeckId", selectedDeckId);
  }, [selectedDeckId]);

  useEffect(() => {
    logShadowingDebug("selectedDeck", selectedDeck);
  }, [selectedDeck]);

  useEffect(() => {
    if (!selectedDeckId || !decks.some((deck) => deck.id === selectedDeckId)) {
      setDeckCardsError("");
      return;
    }

    void loadSelectedDeck(selectedDeckId);
  }, [decks, loadSelectedDeck, selectedDeckId]);

  useEffect(() => {
    return () => {
      hardStopPlayback({ preserveSelection: true });
    };
  }, [hardStopPlayback]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    const audioNode = audioRef.current;
    audioNode.addEventListener("ended", handleAudioEnded);

    return () => {
      audioNode.removeEventListener("ended", handleAudioEnded);
    };
  }, [handleAudioEnded]);

  const deckSummary = (() => {
    if (!selectedDeck) {
      if (decksLoading) {
        return "Loading decks...";
      }

      if (decks.length) {
        return "Choose a deck to preview its sentences.";
      }

      return "Upload an Anki sentence deck to build a repeatable shadowing session.";
    }

    if (!selectedDeck.cardsLoaded && selectedDeckCardsLoading) {
      return `Loading ${selectedDeck.noteCount} cards...`;
    }

    if (selectedDeck.cardsLoaded) {
      return `${selectedDeck.playableCount} playable / ${selectedDeck.noteCount} total`;
    }

    return `${selectedDeck.noteCount} total`;
  })();
  const emptyStateMessage = !decksLoading && !decks.length && !decksError
    ? "No decks uploaded yet."
    : "";
  const loadingStateMessage = decksLoading && !decks.length
    ? "Loading decks..."
    : selectedDeckCardsLoading
      ? "Loading cards for the selected deck..."
      : "";
  const selectedDeckEmptyMessage =
    selectedDeck?.cardsLoaded && !selectedDeck.cards.length
      ? uploading
        ? "This deck is still importing. Cards will appear here once the import finishes."
        : "Deck selected but no cards found."
      : "";
  const focusModeEnabled = focusMode && hasMounted;

  const renderSessionSection = (isFocusView = false, options = {}) => {
    const { isMobileSheet = false } = options;
    const focusToggleLabel = isFocusView ? "Exit focus" : "Deep focus";

    return (
      <section
        style={{
          ...styles.largeCard,
          ...(
            isMobileSheet
              ? localStyles.mobileSessionSheetContent
              : isFocusView
              ? localStyles.focusSectionShell(isMobile)
              : {
                  display: "grid",
                  gridTemplateRows: "auto 1fr auto",
                  gap: "18px",
                  padding: isMobile ? "16px" : styles.largeCard.padding,
                  height: isMobile ? "auto" : "100%",
                  ...(isMobile ? localStyles.mobilePrimarySection : null),
                }
          ),
        }}
      >
        <div style={localStyles.headerRow}>
          <div style={{ minWidth: 0 }}>
            <h2 style={styles.sectionTitle}>Shadowing session</h2>
          </div>

          <div style={localStyles.inlineToggles}>
            <button
              type="button"
              style={localStyles.iconToggle(translationVisible)}
              onClick={() => setShowInlineEnglish((value) => !value)}
              aria-label={translationVisible ? "Hide English translation" : "Show English translation"}
              title={translationVisible ? "Hide English translation" : "Show English translation"}
            >
              <Languages size={16} />
            </button>

            <button
              type="button"
              style={localStyles.iconToggle(readingVisible)}
              onClick={() => setShowInlineReading((value) => !value)}
              aria-label={readingVisible ? "Hide reading line" : "Show reading line"}
              title={readingVisible ? "Hide reading line" : "Show reading line"}
            >
              <Sparkles size={16} />
            </button>

            {isMobileSheet ? (
              <button
                type="button"
                style={localStyles.focusToggleButton(false, true)}
                onClick={() => void handleCloseMobileSession()}
                aria-label="Close shadowing session"
                title="Close shadowing session"
              >
                <X size={16} />
              </button>
            ) : (
              <button
                type="button"
                style={localStyles.focusToggleButton(isFocusView, isMobile)}
                onClick={() => setFocusMode((value) => !value)}
                aria-label={focusToggleLabel}
                title={focusToggleLabel}
              >
                {isFocusView ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
          </div>
        </div>

        <div
          style={
            isMobileSheet
              ? localStyles.mobileSessionSheetHero
              : isFocusView
                ? localStyles.focusPlayerHero(isMobile)
                : isMobile
                  ? localStyles.mobilePlayerHero
                  : localStyles.playerHero
          }
        >
          {loadingStateMessage ? <div style={localStyles.infoBox}>{loadingStateMessage}</div> : null}
          {selectedDeckEmptyMessage ? <div style={localStyles.infoBox}>{selectedDeckEmptyMessage}</div> : null}
          {deckCardsError ? <div style={localStyles.errorBox}>{deckCardsError}</div> : null}
          {!selectedDeck && decks.length > 1 && !decksLoading ? (
            <div style={localStyles.infoBox}>Select a deck in Settings to load its cards.</div>
          ) : null}

          <div style={isFocusView ? localStyles.focusExpressionWrap : localStyles.expressionWrap}>
            <div style={isFocusView ? localStyles.focusExpressionText : localStyles.expressionText}>
              {currentCard?.expression ? (
                <RubyText
                  text={currentCard.expression}
                  reading={readingVisible ? currentCard?.reading || currentCard?.sentenceKana : ""}
                  rubyStyle={localStyles.rubyBase}
                  rtStyle={isFocusView ? localStyles.focusRubyRt : localStyles.rubyRt}
                />
              ) : (
                "No sentence selected yet."
              )}
            </div>

            {readingVisible &&
            (currentCard?.reading || currentCard?.sentenceKana) &&
            !hasRubyReading(currentCard?.expression, currentCard?.reading || currentCard?.sentenceKana) ? (
              <div style={isFocusView ? localStyles.focusReadingLine : localStyles.readingLine}>
                {currentCard?.reading || currentCard?.sentenceKana}
              </div>
            ) : null}

            {translationVisible && currentCard?.sentenceEnglish ? (
              <div style={isFocusView ? localStyles.focusTranslationLine : localStyles.translationLine}>
                {currentCard.sentenceEnglish}
              </div>
            ) : null}
          </div>

          {currentCard?.vocabKanji ? (
            <div style={localStyles.vocabularyChipRow}>
              <button
                type="button"
                onClick={() => setVocabularyOpen((value) => !value)}
                style={isFocusView ? localStyles.focusVocabularyChip : localStyles.vocabularyChip}
              >
                <div style={localStyles.vocabularyChipContent}>
                  <RubyText
                    text={currentCard.vocabKanji}
                    reading={currentCard.vocabFurigana || currentCard.vocabKana}
                    style={isFocusView ? localStyles.focusVocabularyChipText : localStyles.vocabularyChipText}
                    rubyStyle={localStyles.vocabularyChipRuby}
                    rtStyle={isFocusView ? localStyles.focusVocabularyChipRt : localStyles.vocabularyChipRt}
                  />
                  {currentCard.vocabEnglish ? (
                    <span style={isFocusView ? localStyles.focusVocabularyChipMeaning : localStyles.vocabularyChipMeaning}>
                      {currentCard.vocabEnglish}
                    </span>
                  ) : null}
                </div>
                <ChevronDown
                  size={14}
                  style={{
                    transform: vocabularyOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease",
                  }}
                />
              </button>
            </div>
          ) : null}

          {vocabularyOpen && currentCard ? (
            <div style={localStyles.vocabularyPanel}>
              <VocabularyRow label="Furigana" value={currentCard.vocabFurigana} />
              <VocabularyRow label="Kana" value={currentCard.vocabKana} />
              <VocabularyRow label="Meaning" value={currentCard.vocabEnglish} />
              <VocabularyRow label="POS" value={currentCard.vocabPos} />
              {currentCard.hasVocabAudio ? (
                <button
                  type="button"
                  onClick={() => void handleVocabularyAudio()}
                  style={localStyles.vocabularyAudioButton}
                >
                  <Volume2 size={15} /> Play vocabulary audio
                </button>
              ) : null}
            </div>
          ) : null}

          {sessionNotice ? <div style={localStyles.notice}>{sessionNotice}</div> : null}
          {selectedDeck?.cardsLoaded && selectedDeck?.textOnlyCount ? (
            <div style={localStyles.helperText}>
              {selectedDeck.textOnlyCount} text-only card
              {selectedDeck.textOnlyCount === 1 ? "" : "s"} imported and excluded from audio sessions.
            </div>
          ) : null}

          <div style={isFocusView ? localStyles.focusSessionFooter : localStyles.sessionFooter}>
            <div style={localStyles.progressTrack}>
              <div style={localStyles.progressFill(visibleSessionProgress)} />
            </div>

            <div style={localStyles.progressMeta}>
              <span style={localStyles.metaPill}>
                Sentence {sessionQueue.length ? currentIndex + 1 : 0}/{sessionQueue.length}
              </span>
              <span style={localStyles.metaPill}>
                Rep {currentRepetition}/{settings.repetitions}
              </span>
              {currentCard?.isAudioAvailable ? (
                <span style={localStyles.metaPill}>Audio ready</span>
              ) : currentCard ? (
                <span style={localStyles.metaPillMuted}>Text-only</span>
              ) : null}
            </div>
          </div>
        </div>

        <div
          style={
            isMobileSheet || isFocusView
              ? localStyles.focusControlsRow
              : isMobile
                ? localStyles.controlsRowMobile
                : localStyles.controlsRow
          }
        >
          <button
            type="button"
            style={isFocusView ? localStyles.focusPrimaryControl(isMobile) : isMobile ? localStyles.mobilePrimaryControl : localStyles.primaryControl}
            onClick={() => void handlePlayPause()}
            disabled={!sessionQueue.length}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            {isPlaying ? "Pause" : sessionCompleted ? "Replay session" : "Play"}
          </button>
        </div>

      </section>
    );
  };

  return (
    <div
      style={{
        ...styles.listeningMainGrid,
        gridTemplateColumns: isMobile ? "1fr" : "1.65fr 1fr",
        alignItems: "stretch",
        minHeight: 0,
        width: "100%",
        boxSizing: "border-box",
        overflow: "visible",
      }}
    >
      {isMobile ? (
        <section
          style={{
            ...styles.largeCard,
            display: "grid",
            gap: "16px",
            padding: "16px",
            border: "var(--listening-mobile-workspace-border)",
            boxShadow: "var(--listening-mobile-workspace-shadow)",
          }}
        >
          <div style={styles.sectionHeader}>
            <div style={{ minWidth: 0 }}>
              <h2 style={styles.sectionTitle}>Shadowing session</h2>
              <p style={styles.sectionText}>
                {selectedDeck?.name ? `${selectedDeck.name} ready to run.` : deckSummary}
              </p>
            </div>
          </div>

          <div style={localStyles.mobileLauncherMetaRow}>
            <div style={localStyles.mobileLauncherPill}>
              {sessionQueue.length} sentence{sessionQueue.length === 1 ? "" : "s"}
            </div>
            <div style={localStyles.mobileLauncherPill}>
              {settings.repetitions} rep{settings.repetitions === 1 ? "" : "s"}
            </div>
          </div>

          {decksError ? <div style={localStyles.errorBox}>{decksError}</div> : null}
          {emptyStateMessage ? <div style={localStyles.infoBox}>{emptyStateMessage}</div> : null}
          {loadingStateMessage && !selectedDeckId ? (
            <div style={localStyles.infoBox}>{loadingStateMessage}</div>
          ) : null}
          {deckActionStatus ? <div style={localStyles.infoBox}>{deckActionStatus}</div> : null}

          <div
            style={{
              ...localStyles.primarySettingsGrid,
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            <NumberField
              label="Sentences"
              value={settings.sentenceCount}
              onChange={(value) =>
                setSettings((currentValue) => ({
                  ...currentValue,
                  sentenceCount: Math.max(1, Math.round(value)),
                }))
              }
              step={1}
              mobileOptimized={numericFieldMobileOptimized}
            />
            <NumberField
              label="Repetitions"
              value={settings.repetitions}
              onChange={(value) =>
                setSettings((currentValue) => ({
                  ...currentValue,
                  repetitions: Math.max(1, Math.round(value)),
                }))
              }
              step={1}
              mobileOptimized={numericFieldMobileOptimized}
            />
          </div>

          {!selectedDeck && decks.length > 1 && !decksLoading ? (
            <div style={localStyles.infoBox}>Choose a deck below before starting.</div>
          ) : null}
          {!selectedDeck && !decks.length && !decksLoading ? (
            <div style={localStyles.infoBox}>Upload decks on desktop, then run your session here.</div>
          ) : null}

          <div style={localStyles.settingsActionRow}>
            <button
              type="button"
              onClick={() => setIsAdvancedSettingsOpen((currentValue) => !currentValue)}
              style={localStyles.compactSecondaryButton}
            >
              {isAdvancedSettingsOpen ? "Hide more settings" : "More settings"}
            </button>
          </div>

          {isAdvancedSettingsOpen ? (
            <div style={localStyles.advancedSettingsPanel}>
              <div style={localStyles.renameRow}>
                <label style={{ ...localStyles.fieldStackCompact, flex: 1 }}>
                  <span style={localStyles.fieldLabel}>Deck name</span>
                  <input
                    type="text"
                    value={deckNameDraft}
                    onChange={(event) => setDeckNameDraft(event.target.value)}
                    style={localStyles.textInput}
                    placeholder="Rename selected deck"
                    disabled={!selectedDeck?.id || savingDeckName}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleRenameDeck()}
                  style={localStyles.compactSecondaryButton}
                  disabled={!selectedDeck?.id || !deckNameDraft.trim() || savingDeckName}
                >
                  {savingDeckName ? "Saving..." : "Save"}
                </button>
              </div>

              <div
                style={{
                  ...localStyles.settingsGridCompact,
                  gridTemplateColumns: "1fr",
                }}
              >
                <NumberField
                  label="Rep gap (s)"
                  value={settings.repeatGapSeconds}
                  onChange={(value) =>
                    setSettings((currentValue) => ({
                      ...currentValue,
                      repeatGapSeconds: Math.max(0, value),
                    }))
                  }
                  step={0.5}
                  mobileOptimized={numericFieldMobileOptimized}
                />
                <NumberField
                  label="Sentence gap (s)"
                  value={settings.sentenceGapSeconds}
                  onChange={(value) =>
                    setSettings((currentValue) => ({
                      ...currentValue,
                      sentenceGapSeconds: Math.max(0, value),
                    }))
                  }
                  step={0.5}
                  mobileOptimized={numericFieldMobileOptimized}
                />
              </div>

              <label style={localStyles.fieldStackCompact}>
                <span style={localStyles.fieldLabel}>Sort mode</span>
                <select
                  value={settings.sortMode}
                  onChange={(event) =>
                    setSettings((currentValue) => ({
                      ...currentValue,
                      sortMode: event.target.value,
                    }))
                  }
                  style={localStyles.select}
                >
                  {SHADOWING_SORT_MODES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={localStyles.fieldStackCompact}>
                <span style={localStyles.fieldLabel}>Audio speed</span>
                <select
                  value={String(settings.playbackRate)}
                  onChange={(event) =>
                    setSettings((currentValue) => ({
                      ...currentValue,
                      playbackRate: Number(event.target.value) || 1,
                    }))
                  }
                  style={localStyles.select}
                >
                  {SHADOWING_PLAYBACK_RATE_OPTIONS.map((option) => (
                    <option key={option.value} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <button
            type="button"
            style={localStyles.mobileLauncherPlayButton(Boolean(sessionQueue.length))}
            onClick={() => void handleOpenMobileSession()}
            disabled={!sessionQueue.length}
          >
            <Play size={18} />
            {sessionCompleted ? "Replay session" : isPlaying ? "Resume session" : "Start session"}
          </button>
        </section>
      ) : (
        renderSessionSection(false)
      )}

      <div style={{ ...styles.sideColumn, minHeight: 0 }}>
        {!isMobile ? (
        <section
          style={{
            ...styles.sideCard,
            display: "grid",
            gap: "12px",
            padding: isMobile ? "16px" : styles.sideCard.padding,
          }}
        >
          <SideModuleHeader
            styles={styles}
            icon={<SlidersHorizontal size={14} color="#38bdf8" strokeWidth={2.5} />}
            eyebrow="Settings"
            action={
              !isMobile ? (
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                style={localStyles.compactActionButton}
              >
                <CloudUpload size={14} />
                Upload deck
              </button>
              ) : null
            }
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".apkg"
            onChange={(event) => {
              const nextFile = event.target.files?.[0];
              if (nextFile) {
                handleQueueUploadFile(nextFile);
              }

              event.target.value = "";
            }}
            style={{ display: "none" }}
          />

          {decksError ? <div style={localStyles.errorBox}>{decksError}</div> : null}
          {emptyStateMessage ? <div style={localStyles.infoBox}>{emptyStateMessage}</div> : null}
          {loadingStateMessage && !selectedDeckId ? (
            <div style={localStyles.infoBox}>{loadingStateMessage}</div>
          ) : null}
          {hasVisibleImportProgress ? (
            <ImportProgressPanel
              statusText={uploadStatus}
              progressValue={uploadProgress}
              progressSummary={uploadProgressSummary}
            />
          ) : null}
          {deckActionStatus ? <div style={localStyles.infoBox}>{deckActionStatus}</div> : null}

          <label style={localStyles.fieldStackCompact}>
            <span style={localStyles.fieldLabel}>Deck</span>
            <select
              value={selectedDeckId}
              onChange={(event) => {
                const nextDeckId = event.target.value;
                logShadowingDebug("deck selector onChange value", nextDeckId);
                setSelectedDeckId(nextDeckId);
              }}
              style={localStyles.select}
              disabled={decksLoading || !decks.length}
            >
              {!selectedDeckId ? <option value="">Select a deck</option> : null}
              {decks.length ? (
                decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))
              ) : (
                <option value="">No decks yet</option>
              )}
            </select>
          </label>

          {!isMobile ? (
            <div
              style={{
                ...localStyles.primarySettingsGrid,
                gridTemplateColumns: isMobile ? "1fr" : localStyles.primarySettingsGrid.gridTemplateColumns,
              }}
            >
              <NumberField
                label="Sentences"
                value={settings.sentenceCount}
                onChange={(value) =>
                  setSettings((currentValue) => ({
                    ...currentValue,
                    sentenceCount: Math.max(1, Math.round(value)),
                  }))
                }
                step={1}
                mobileOptimized={numericFieldMobileOptimized}
              />
              <NumberField
                label="Repetitions"
                value={settings.repetitions}
                onChange={(value) =>
                  setSettings((currentValue) => ({
                    ...currentValue,
                    repetitions: Math.max(1, Math.round(value)),
                  }))
                }
                step={1}
                mobileOptimized={numericFieldMobileOptimized}
              />
            </div>
          ) : null}

          <div style={localStyles.settingsActionRow}>
            <button
              type="button"
              onClick={() => setIsAdvancedSettingsOpen((currentValue) => !currentValue)}
              style={localStyles.compactSecondaryButton}
            >
              {isAdvancedSettingsOpen ? "Hide more settings" : "More settings"}
            </button>
          </div>

          {isAdvancedSettingsOpen ? (
            <div style={localStyles.advancedSettingsPanel}>
              <div style={localStyles.renameRow}>
                <label style={{ ...localStyles.fieldStackCompact, flex: 1 }}>
                  <span style={localStyles.fieldLabel}>Deck name</span>
                  <input
                    type="text"
                    value={deckNameDraft}
                    onChange={(event) => setDeckNameDraft(event.target.value)}
                    style={localStyles.textInput}
                    placeholder="Rename selected deck"
                    disabled={!selectedDeck?.id || savingDeckName}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleRenameDeck()}
                  style={localStyles.compactSecondaryButton}
                  disabled={!selectedDeck?.id || !deckNameDraft.trim() || savingDeckName}
                >
                  {savingDeckName ? "Saving..." : "Save"}
                </button>
              </div>

              <div
                style={{
                  ...localStyles.settingsGridCompact,
                  gridTemplateColumns: isMobile ? "1fr" : localStyles.settingsGridCompact.gridTemplateColumns,
                }}
              >
                <NumberField
                  label="Rep gap (s)"
                  value={settings.repeatGapSeconds}
                  onChange={(value) =>
                    setSettings((currentValue) => ({
                      ...currentValue,
                      repeatGapSeconds: Math.max(0, value),
                    }))
                  }
                  step={0.5}
                  mobileOptimized={numericFieldMobileOptimized}
                />
                <NumberField
                  label="Sentence gap (s)"
                  value={settings.sentenceGapSeconds}
                  onChange={(value) =>
                    setSettings((currentValue) => ({
                      ...currentValue,
                      sentenceGapSeconds: Math.max(0, value),
                    }))
                  }
                  step={0.5}
                  mobileOptimized={numericFieldMobileOptimized}
                />
              </div>

              <label style={localStyles.fieldStackCompact}>
                <span style={localStyles.fieldLabel}>Sort mode</span>
                <select
                  value={settings.sortMode}
                  onChange={(event) =>
                    setSettings((currentValue) => ({
                      ...currentValue,
                      sortMode: event.target.value,
                    }))
                  }
                  style={localStyles.select}
                >
                  {SHADOWING_SORT_MODES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={localStyles.fieldStackCompact}>
                <span style={localStyles.fieldLabel}>Audio speed</span>
                <select
                  value={String(settings.playbackRate)}
                  onChange={(event) =>
                    setSettings((currentValue) => ({
                      ...currentValue,
                      playbackRate: Number(event.target.value) || 1,
                    }))
                  }
                  style={localStyles.select}
                >
                  {SHADOWING_PLAYBACK_RATE_OPTIONS.map((option) => (
                    <option key={option.value} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div style={localStyles.settingsFootnote}>
            Session queue: {sessionQueue.length} playable sentence
            {sessionQueue.length === 1 ? "" : "s"} - repeat gap {formatSeconds(settings.repeatGapSeconds)}
            {" - "}sentence gap {formatSeconds(settings.sentenceGapSeconds)}
            {" - "}speed {settings.playbackRate}x
          </div>
        </section>
        ) : null}

        {isMobile ? (
          <section
            style={{
              ...styles.sideCard,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <div
              style={localStyles.mobileVisualizationValue}
              title={formatShadowingHours(shadowingHours)}
              aria-label={`Total shadowing ${formatShadowingHours(shadowingHours)}`}
            >
              {formatShadowingHours(shadowingHours)}
            </div>

            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
              <div
                style={{
                  ...styles.progressBarWrap,
                  height: "10px",
                  borderRadius: "999px",
                }}
                aria-hidden="true"
              >
                <div
                  style={{
                    ...styles.progressBarFill(goalProgress),
                    background: "#0ea5e9",
                  }}
                />
              </div>
            </div>
          </section>
        ) : (
          <section
            style={{
              ...styles.sideCard,
              display: "grid",
              gap: "14px",
              padding: isMobile ? "16px" : styles.sideCard.padding,
            }}
          >
            <SideModuleHeader
              styles={styles}
              icon={<BarChart3 size={14} color="#38bdf8" strokeWidth={2.5} />}
              eyebrow="Shadowing Stats"
              title="Shadowing progress"
            />

            <div style={localStyles.statsGrid}>
              <StatTile
                icon={<AudioLines size={16} />}
                label="Total shadowing hours"
                value={formatShadowingHours(shadowingHours)}
              />
              <StatTile
                icon={<Volume2 size={16} />}
                label="Total reps"
                value={new Intl.NumberFormat().format(totalReps)}
              />
            </div>

            <div style={localStyles.goalCard}>
              <div style={localStyles.goalHeader}>
                <div>
                  <div style={localStyles.goalLabel}>Goal setting</div>
                  <div style={localStyles.goalValue}>
                    {formatShadowingHours(shadowingHours)} / {formatShadowingHours(goalHours)}
                  </div>
                </div>

                <div style={localStyles.goalPercent}>{goalProgress.toFixed(1)}%</div>
              </div>

              <div style={localStyles.progressTrack}>
                <div style={localStyles.goalProgressFill(goalProgress)} />
              </div>

              <NumberField
                label="Goal (hours)"
                value={goalHours}
                onChange={(value) => setGoalHours(Math.max(1, Math.round(value)))}
                step={1}
                mobileOptimized={numericFieldMobileOptimized}
              />
            </div>
          </section>
        )}
      </div>

      <audio ref={audioRef} preload="auto" />
      <audio ref={vocabularyAudioRef} preload="none" />

      {hasMounted && isUploadModalOpen
        ? createPortal(
            <div style={localStyles.modalOverlay}>
              <div style={localStyles.modalBackdrop} onClick={() => setIsUploadModalOpen(false)} />
              <div style={localStyles.modalSheet}>
                <div style={localStyles.modalHeader}>
                  <SideModuleHeader
                    styles={styles}
                    icon={<CloudUpload size={14} color="#38bdf8" strokeWidth={2.5} />}
                    eyebrow="Deck Upload"
                    title="Import an Anki .apkg deck"
                  />

                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    style={localStyles.modalCloseButton}
                    aria-label="Close upload modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                <UploadDropzone
                  dragActive={dragActive}
                  uploading={uploading}
                  uploadStatus={uploadStatus}
                  pendingFileName={pendingUploadFile?.name || ""}
                  onSelectFile={() => fileInputRef.current?.click()}
                  onDropFile={handleQueueUploadFile}
                  setDragActive={setDragActive}
                />

                <div style={localStyles.modalFormGrid}>
                  <div style={localStyles.fieldStackCompact}>
                    <span style={localStyles.fieldLabel}>Import into</span>
                    <div style={localStyles.segmentedRow}>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMode("new");
                          setUploadDeckName("");
                        }}
                        style={localStyles.segmentedButton(uploadMode === "new")}
                      >
                        New deck
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMode("existing");
                          const matchedDeck = decks.find(
                            (deck) => deck.id === (uploadTargetDeckId || selectedDeck?.id || ""),
                          );
                          setUploadDeckName(matchedDeck?.name || selectedDeck?.name || "");
                        }}
                        style={localStyles.segmentedButton(uploadMode === "existing")}
                        disabled={!decks.length}
                      >
                        Existing deck
                      </button>
                    </div>
                  </div>

                  {uploadMode === "existing" ? (
                    <label style={localStyles.fieldStackCompact}>
                      <span style={localStyles.fieldLabel}>Target deck</span>
                      <select
                        value={uploadTargetDeckId}
                        onChange={(event) => {
                          const nextDeckId = event.target.value;
                          setUploadTargetDeckId(nextDeckId);
                          const matchedDeck = decks.find((deck) => deck.id === nextDeckId);
                          if (matchedDeck?.name) {
                            setUploadDeckName(matchedDeck.name);
                          }
                        }}
                        style={localStyles.select}
                        disabled={!decks.length}
                      >
                        {decks.length ? (
                          decks.map((deck) => (
                            <option key={deck.id} value={deck.id}>
                              {deck.name}
                            </option>
                          ))
                        ) : (
                          <option value="">No decks yet</option>
                        )}
                      </select>
                    </label>
                  ) : null}

                  <label style={localStyles.fieldStackCompact}>
                    <span style={localStyles.fieldLabel}>
                      {uploadMode === "existing" ? "Deck name after import" : "New deck name"}
                    </span>
                    <input
                      type="text"
                      value={uploadDeckName}
                      onChange={(event) => setUploadDeckName(event.target.value)}
                      style={localStyles.textInput}
                      placeholder="Core 6"
                    />
                  </label>
                </div>

                <div style={localStyles.modalHelperText}>
                  Sentence audio is imported when available. Cards without Sentence-Audio still import and stay visible as text-only.
                </div>

                {hasVisibleImportProgress ? (
                  <ImportProgressPanel
                    statusText={uploadStatus}
                    progressValue={uploadProgress}
                    progressSummary={uploadProgressSummary}
                  />
                ) : null}

                <div style={localStyles.modalActionRow}>
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    style={localStyles.compactSecondaryButton}
                  >
                    {uploading ? "Close" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeckImport()}
                    style={localStyles.compactActionButton}
                    disabled={!pendingUploadFile || uploading}
                  >
                    {uploading ? "Uploading..." : "Upload deck"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {focusModeEnabled
        ? createPortal(
            <div style={localStyles.focusOverlay}>
              <div style={localStyles.focusBackdrop} onClick={() => setFocusMode(false)} />
              <div style={localStyles.focusFrame}>
                {renderSessionSection(true)}
              </div>
            </div>,
            document.body,
          )
        : null}

      {hasMounted && isMobile
        ? createPortal(
            <div style={localStyles.mobileSessionOverlay(isMobileSessionOpen)}>
              <div
                style={localStyles.mobileSessionBackdrop(isMobileSessionOpen)}
                onClick={() => void handleCloseMobileSession()}
              />
              <div style={localStyles.mobileSessionSheet(isMobileSessionOpen)}>
                {renderSessionSection(false, { isMobileSheet: true })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function UploadDropzone({
  dragActive,
  uploading,
  uploadStatus,
  pendingFileName,
  onSelectFile,
  onDropFile,
  setDragActive,
}) {
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        const nextFile = event.dataTransfer.files?.[0];
        if (nextFile) {
          onDropFile(nextFile);
        }
      }}
      style={localStyles.dropzone(dragActive, uploading)}
    >
      <div style={localStyles.dropzoneIcon}>
        <CloudUpload size={18} />
      </div>
      <div style={{ display: "grid", gap: "4px" }}>
        <div style={localStyles.dropzoneTitle}>
          {pendingFileName
            ? `Ready: ${pendingFileName}`
            : uploading
              ? "Importing deck..."
              : "Choose an Anki .apkg deck"}
        </div>
        <div style={localStyles.dropzoneText}>
          Drop your sentence deck here or choose a file, then press Upload deck to start the import.
        </div>
        {uploadStatus ? <div style={localStyles.dropzoneStatus}>{uploadStatus}</div> : null}
      </div>

      <button type="button" onClick={onSelectFile} style={localStyles.dropzoneButton} disabled={uploading}>
        {pendingFileName ? "Choose different file" : "Choose file"}
      </button>
    </div>
  );
}

function ImportProgressPanel({ statusText, progressValue, progressSummary }) {
  return (
    <div style={localStyles.uploadProgressPanel}>
      <div style={localStyles.uploadProgressHeader}>
        <span>{statusText || "Preparing import..."}</span>
        <span>{progressSummary}</span>
      </div>
      <div style={localStyles.progressTrack}>
        <div style={localStyles.progressFill(progressValue)} />
      </div>
    </div>
  );
}

function SideModuleHeader({ styles, icon, eyebrow, title, action = null }) {
  return (
    <div style={localStyles.sideHeaderRow}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
        <div style={styles.progressContainer}>
          <div
            style={{
              ...styles.dictionaryIconFootprint,
              background: "rgba(56,189,248,0.14)",
              border: "1px solid rgba(56,189,248,0.2)",
            }}
          >
            {icon}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={styles.eyebrow}>{title || eyebrow}</div>
        </div>
      </div>

      {action}
    </div>
  );
}

function VocabularyRow({ label, value }) {
  if (!value) {
    return null;
  }

  return (
    <div style={localStyles.vocabularyRow}>
      <div style={localStyles.vocabularyLabel}>{label}</div>
      <div style={localStyles.vocabularyValue}>{value}</div>
    </div>
  );
}

function StatTile({ icon, label, value }) {
  return (
    <div style={localStyles.statTile}>
      <div style={localStyles.statIcon}>{icon}</div>
      <div style={{ display: "grid", gap: "3px" }}>
        <div style={localStyles.statLabel}>{label}</div>
        <div style={localStyles.statValue}>{value}</div>
      </div>
    </div>
  );
}

const localStyles = {
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
    marginBottom: "6px",
  },
  inlineToggles: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  sideHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  mobileLauncherMetaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  mobileLauncherPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "rgba(56,189,248,0.12)",
    color: "#38bdf8",
    fontSize: "12px",
    fontWeight: 700,
  },
  mobileLauncherPlayButton: (enabled) => ({
    border: "none",
    borderRadius: "16px",
    padding: "14px 16px",
    background: enabled
      ? "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)"
      : "rgba(148,163,184,0.42)",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontWeight: 700,
    cursor: enabled ? "pointer" : "not-allowed",
    minHeight: "52px",
    width: "100%",
    boxShadow: enabled ? "0 18px 36px rgba(14,165,233,0.22)" : "none",
    opacity: enabled ? 1 : 0.76,
  }),
  compactActionButton: {
    border: "1px solid rgba(56,189,248,0.2)",
    background: "rgba(56,189,248,0.1)",
    color: "#38bdf8",
    borderRadius: "12px",
    padding: "9px 12px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  compactSecondaryButton: {
    border: "1px solid var(--app-border)",
    background: "var(--app-surface-elevated)",
    color: "var(--app-text)",
    borderRadius: "12px",
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 700,
    minHeight: "44px",
    alignSelf: "end",
  },
  iconToggle: (active) => ({
    width: "36px",
    height: "36px",
    borderRadius: "12px",
    border: "1px solid var(--app-border-soft)",
    background: active ? "rgba(56,189,248,0.14)" : "var(--app-surface-elevated)",
    color: active ? "#38bdf8" : "var(--app-text-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  }),
  focusToggleButton: (active, isMobile) => ({
    minHeight: "36px",
    borderRadius: "12px",
    border: "1px solid rgba(226,232,240,0.14)",
    background: active ? "rgba(56,189,248,0.14)" : "var(--app-surface-elevated)",
    color: active ? "#38bdf8" : "var(--app-text)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: "pointer",
    fontWeight: 700,
    padding: isMobile ? "0 10px" : "0 12px",
  }),
  mobilePrimarySection: {
    padding: 0,
    border: "none",
    background: "transparent",
    boxShadow: "none",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    overflow: "visible",
  },
  focusSectionShell: (isMobile) => ({
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    gap: isMobile ? "16px" : "20px",
    width: "min(960px, 100%)",
    maxWidth: "100%",
    height: isMobile ? "100%" : "min(88vh, 860px)",
    maxHeight: "100%",
    padding: isMobile ? "18px" : "28px",
    borderRadius: isMobile ? "24px" : "30px",
    border: "1px solid rgba(148,163,184,0.18)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.94) 0%, rgba(15,23,42,0.84) 100%)",
    boxShadow: "0 28px 80px rgba(2, 6, 23, 0.48)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    overflow: "auto",
  }),
  mobileSessionSheetContent: {
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    gap: "16px",
    width: "100%",
    height: "100%",
    padding: "18px 16px calc(18px + env(safe-area-inset-bottom, 0px))",
    borderRadius: "28px 28px 0 0",
    border: "1px solid var(--app-border-strong)",
    background: "var(--app-surface-strong)",
    boxShadow: "var(--app-glass-shadow)",
    overflow: "auto",
  },
  playerHero: {
    display: "grid",
    gap: "22px",
    padding: "28px",
    borderRadius: "24px",
    border: "1px solid var(--app-border-soft)",
    background: "linear-gradient(180deg, var(--app-surface-elevated) 0%, var(--app-card) 100%)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyItems: "center",
    textAlign: "center",
  },
  focusPlayerHero: (isMobile) => ({
    display: "grid",
    gap: isMobile ? "22px" : "28px",
    padding: isMobile ? "28px 18px 22px" : "44px 56px 32px",
    borderRadius: "26px",
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "radial-gradient(circle at top, rgba(14,165,233,0.12), transparent 42%), rgba(15,23,42,0.5)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    overflow: "visible",
    alignItems: "center",
    justifyItems: "center",
    textAlign: "center",
    minHeight: isMobile ? "auto" : "100%",
  }),
  mobilePlayerHero: {
    display: "grid",
    gap: "20px",
    padding: "24px 18px",
    borderRadius: "24px",
    border: "1px solid var(--app-border-soft)",
    background: "linear-gradient(180deg, var(--app-surface-elevated) 0%, var(--app-card) 100%)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    overflow: "visible",
    alignItems: "center",
    justifyItems: "center",
    textAlign: "center",
  },
  mobileSessionSheetHero: {
    display: "grid",
    gap: "22px",
    padding: "24px 16px",
    borderRadius: "24px",
    border: "1px solid var(--app-border-soft)",
    background: "linear-gradient(180deg, var(--app-surface-elevated) 0%, var(--app-card) 100%)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    overflow: "visible",
    alignItems: "center",
    justifyItems: "center",
    textAlign: "center",
    minHeight: "calc(100dvh - 220px)",
  },
  progressMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "center",
  },
  sessionFooter: {
    display: "grid",
    gap: "12px",
    width: "100%",
    alignSelf: "end",
  },
  focusSessionFooter: {
    display: "grid",
    gap: "14px",
    width: "100%",
    alignSelf: "end",
    paddingBottom: "4px",
  },
  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    background: "rgba(56,189,248,0.14)",
    color: "#38bdf8",
    fontSize: "12px",
    fontWeight: 700,
  },
  metaPillMuted: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    background: "rgba(148,163,184,0.16)",
    color: "var(--app-text-soft)",
    fontSize: "12px",
    fontWeight: 700,
  },
  progressTrack: {
    position: "relative",
    height: "11px",
    borderRadius: "999px",
    background: "var(--app-progress-track)",
    overflow: "hidden",
  },
  progressFill: (percent) => ({
    width: `${percent}%`,
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #0ea5e9 0%, #38bdf8 100%)",
    transition: "width 220ms ease",
  }),
  goalProgressFill: (percent) => ({
    width: `${percent}%`,
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #f59e0b 0%, #facc15 100%)",
    transition: "width 220ms ease",
  }),
  expressionWrap: {
    display: "grid",
    gap: "14px",
    justifyItems: "center",
    maxWidth: "720px",
  },
  focusExpressionWrap: {
    display: "grid",
    gap: "18px",
    justifyItems: "center",
    alignContent: "center",
    width: "100%",
    maxWidth: "880px",
    minHeight: "min(42vh, 360px)",
  },
  expressionText: {
    fontSize: "clamp(24px, 3.3vw, 36px)",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    lineHeight: 1.28,
    color: "var(--app-text)",
    whiteSpace: "pre-wrap",
  },
  focusExpressionText: {
    fontSize: "clamp(30px, 4vw, 50px)",
    fontWeight: 800,
    letterSpacing: "-0.045em",
    lineHeight: 1.32,
    color: "var(--app-selected-text)",
    whiteSpace: "pre-wrap",
  },
  rubyText: {
    display: "inline",
  },
  rubyBase: {
    rubyPosition: "over",
    rubyAlign: "center",
  },
  rubyRt: {
    fontSize: "0.46em",
    fontWeight: 700,
    color: "var(--app-text-soft)",
    letterSpacing: "0.02em",
  },
  focusRubyRt: {
    fontSize: "0.5em",
    fontWeight: 700,
    color: "rgba(226,232,240,0.8)",
    letterSpacing: "0.02em",
  },
  readingLine: {
    fontSize: "clamp(15px, 1.9vw, 19px)",
    color: "var(--app-text-soft)",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    maxWidth: "680px",
  },
  focusReadingLine: {
    fontSize: "clamp(16px, 2vw, 22px)",
    color: "rgba(226,232,240,0.78)",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    maxWidth: "760px",
  },
  translationLine: {
    fontSize: "14px",
    color: "var(--app-text-muted)",
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    maxWidth: "680px",
  },
  focusTranslationLine: {
    fontSize: "clamp(15px, 1.8vw, 20px)",
    color: "rgba(226,232,240,0.62)",
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    maxWidth: "760px",
  },
  vocabularyChipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    justifyContent: "center",
  },
  focusVocabularyChip: {
    border: "1px solid rgba(251,191,36,0.24)",
    background: "rgba(251,191,36,0.12)",
    color: "var(--app-selected-text)",
    borderRadius: "20px",
    padding: "14px 18px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "12px",
    fontWeight: 700,
    cursor: "pointer",
    minWidth: "min(100%, 380px)",
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.18)",
  },
  vocabularyChip: {
    border: "1px solid rgba(245,158,11,0.25)",
    background: "rgba(251,191,36,0.16)",
    color: "var(--app-text)",
    borderRadius: "18px",
    padding: "10px 14px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "10px",
    fontWeight: 700,
    cursor: "pointer",
    minWidth: "min(100%, 320px)",
  },
  vocabularyChipContent: {
    display: "grid",
    gap: "4px",
    justifyItems: "start",
    textAlign: "left",
    minWidth: 0,
  },
  vocabularyChipText: {
    display: "inline-block",
    lineHeight: 1.15,
    fontSize: "18px",
  },
  focusVocabularyChipText: {
    display: "inline-block",
    lineHeight: 1.12,
    fontSize: "22px",
  },
  vocabularyChipRuby: {
    rubyAlign: "center",
  },
  vocabularyChipRt: {
    fontSize: "0.6em",
    fontWeight: 700,
    color: "var(--app-text-soft)",
  },
  focusVocabularyChipRt: {
    fontSize: "0.66em",
    fontWeight: 700,
    color: "rgba(226,232,240,0.74)",
  },
  vocabularyChipMeaning: {
    fontSize: "12px",
    lineHeight: 1.4,
    fontWeight: 600,
    color: "var(--app-text-muted)",
    whiteSpace: "normal",
  },
  focusVocabularyChipMeaning: {
    fontSize: "13px",
    lineHeight: 1.5,
    fontWeight: 600,
    color: "rgba(226,232,240,0.62)",
    whiteSpace: "normal",
  },
  vocabularyPanel: {
    display: "grid",
    gap: "10px",
    borderRadius: "18px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
    padding: "14px",
    width: "min(100%, 560px)",
  },
  vocabularyRow: {
    display: "grid",
    gap: "3px",
  },
  vocabularyLabel: {
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--app-text-faint)",
  },
  vocabularyValue: {
    fontSize: "14px",
    color: "var(--app-text)",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  vocabularyAudioButton: {
    border: "1px solid rgba(14,165,233,0.22)",
    background: "rgba(14,165,233,0.1)",
    color: "#38bdf8",
    borderRadius: "12px",
    padding: "9px 12px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    width: "fit-content",
  },
  helperText: {
    fontSize: "12px",
    color: "var(--app-text-muted)",
    lineHeight: 1.5,
    textAlign: "center",
    maxWidth: "620px",
  },
  notice: {
    borderRadius: "14px",
    background: "rgba(56,189,248,0.12)",
    border: "1px solid rgba(56,189,248,0.16)",
    color: "#38bdf8",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 600,
    textAlign: "center",
    width: "min(100%, 620px)",
  },
  controlsRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "4px",
    width: "100%",
  },
  controlsRowMobile: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  focusControlsRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingTop: "14px",
  },
  primaryControl: {
    border: "none",
    borderRadius: "16px",
    padding: "13px 18px",
    background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontWeight: 700,
    cursor: "pointer",
    minHeight: "48px",
    minWidth: "180px",
  },
  mobilePrimaryControl: {
    border: "none",
    borderRadius: "16px",
    padding: "13px 14px",
    background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontWeight: 700,
    cursor: "pointer",
    minHeight: "48px",
    minWidth: 0,
    width: "100%",
    maxWidth: "280px",
  },
  focusPrimaryControl: (isMobile) => ({
    border: "none",
    borderRadius: "18px",
    padding: isMobile ? "14px 18px" : "15px 24px",
    background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontWeight: 700,
    cursor: "pointer",
    minHeight: "52px",
    minWidth: isMobile ? "min(100%, 240px)" : "220px",
    boxShadow: "0 18px 36px rgba(14,165,233,0.24)",
  }),
  secondaryControl: {
    border: "1px solid var(--app-border-soft)",
    borderRadius: "16px",
    padding: "0 14px",
    minHeight: "48px",
    background: "var(--app-card)",
    color: "var(--app-text)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  mobileCompactControl: {
    border: "1px solid var(--app-border-soft)",
    borderRadius: "16px",
    padding: "0",
    minHeight: "48px",
    width: "48px",
    background: "var(--app-card)",
    color: "var(--app-text)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  secondaryControlWide: {
    border: "1px solid var(--app-border-soft)",
    borderRadius: "16px",
    padding: "0 14px",
    minHeight: "48px",
    background: "var(--app-card)",
    color: "var(--app-text)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: "pointer",
  },
  mobileRestartControl: {
    border: "1px solid var(--app-border-soft)",
    borderRadius: "16px",
    padding: "0 14px",
    minHeight: "48px",
    background: "var(--app-card)",
    color: "var(--app-text)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: "pointer",
    width: "100%",
    gridColumn: "1 / -1",
  },
  dropzone: (dragActive, uploading) => ({
    display: "grid",
    gap: "12px",
    padding: "14px",
    borderRadius: "18px",
    border: dragActive
      ? "1px solid rgba(56,189,248,0.34)"
      : "1px dashed rgba(148,163,184,0.45)",
    background: dragActive ? "rgba(56,189,248,0.08)" : "var(--app-surface-elevated)",
    opacity: uploading ? 0.8 : 1,
  }),
  dropzoneIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "14px",
    background: "rgba(56,189,248,0.12)",
    color: "#38bdf8",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  dropzoneTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--app-text)",
  },
  dropzoneText: {
    fontSize: "12px",
    lineHeight: 1.55,
    color: "var(--app-text-muted)",
  },
  dropzoneStatus: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#38bdf8",
  },
  dropzoneButton: {
    border: "1px solid rgba(14,165,233,0.22)",
    background: "rgba(14,165,233,0.1)",
    color: "#38bdf8",
    borderRadius: "12px",
    padding: "10px 12px",
    cursor: "pointer",
    width: "fit-content",
    fontWeight: 700,
  },
  errorBox: {
    borderRadius: "14px",
    padding: "10px 12px",
    background: "rgba(239,68,68,0.08)",
    color: "#fca5a5",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  infoBox: {
    borderRadius: "14px",
    padding: "10px 12px",
    background: "rgba(56,189,248,0.08)",
    color: "#38bdf8",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  fieldStack: {
    display: "grid",
    gap: "6px",
  },
  fieldStackCompact: {
    display: "grid",
    gap: "5px",
  },
  textInput: {
    width: "100%",
    minHeight: "44px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface-strong)",
    padding: "0 12px",
    color: "var(--app-text)",
    boxSizing: "border-box",
  },
  renameRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "10px",
    alignItems: "end",
  },
  fieldLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  select: {
    width: "100%",
    minHeight: "44px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface-strong)",
    padding: "0 12px",
    color: "var(--app-text)",
  },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  primarySettingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  settingsGridCompact: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  settingsActionRow: {
    display: "flex",
    justifyContent: "flex-start",
  },
  advancedSettingsPanel: {
    display: "grid",
    gap: "12px",
    padding: "12px",
    borderRadius: "16px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
  },
  settingsFootnote: {
    fontSize: "12px",
    lineHeight: 1.55,
    color: "var(--app-text-muted)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  statTile: {
    display: "grid",
    gap: "10px",
    borderRadius: "18px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
    padding: "14px",
  },
  statIcon: {
    width: "34px",
    height: "34px",
    borderRadius: "12px",
    background: "rgba(56,189,248,0.12)",
    color: "#38bdf8",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    fontSize: "12px",
    color: "var(--app-text-muted)",
  },
  statValue: {
    fontSize: "20px",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: "var(--app-text)",
  },
  mobileVisualizationValue: {
    fontSize: "18px",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: "var(--app-text)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  goalCard: {
    display: "grid",
    gap: "12px",
    borderRadius: "20px",
    border: "1px solid rgba(245,158,11,0.18)",
    background: "linear-gradient(180deg, rgba(245,158,11,0.08) 0%, var(--app-surface-elevated) 100%)",
    padding: "14px",
  },
  goalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  goalLabel: {
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#fbbf24",
  },
  goalValue: {
    marginTop: "4px",
    fontSize: "18px",
    fontWeight: 800,
    color: "var(--app-text)",
  },
  goalPercent: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#fbbf24",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  focusOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1250,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  mobileSessionOverlay: (open) => ({
    position: "fixed",
    inset: 0,
    zIndex: 1240,
    pointerEvents: open ? "auto" : "none",
  }),
  mobileSessionBackdrop: (open) => ({
    position: "absolute",
    inset: 0,
    background: open ? "rgba(148, 163, 184, 0.22)" : "rgba(148, 163, 184, 0)",
    backdropFilter: open ? "blur(10px)" : "blur(0px)",
    WebkitBackdropFilter: open ? "blur(10px)" : "blur(0px)",
    transition: "background 240ms ease, backdrop-filter 240ms ease",
  }),
  mobileSessionSheet: (open) => ({
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "100dvh",
    transform: open ? "translateY(0%)" : "translateY(100%)",
    transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
  }),
  focusBackdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(2, 6, 23, 0.78)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  focusFrame: {
    position: "relative",
    zIndex: 1,
    width: "min(1040px, 100%)",
    height: "min(100%, 900px)",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
  },
  modalBackdrop: {
    position: "absolute",
    inset: 0,
    background: "var(--app-overlay)",
    backdropFilter: "blur(6px)",
  },
  modalSheet: {
    position: "relative",
    zIndex: 1,
    width: "min(560px, 100%)",
    display: "grid",
    gap: "16px",
    padding: "18px",
    borderRadius: "24px",
    border: "1px solid var(--app-border-strong)",
    background: "var(--app-surface-strong)",
    boxShadow: "var(--app-glass-shadow)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  modalCloseButton: {
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
    color: "var(--app-text)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  modalHelperText: {
    fontSize: "12px",
    lineHeight: 1.55,
    color: "var(--app-text-muted)",
  },
  uploadProgressPanel: {
    display: "grid",
    gap: "8px",
    padding: "12px",
    borderRadius: "14px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
  },
  uploadProgressHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    fontSize: "12px",
    color: "var(--app-text-soft)",
    fontWeight: 700,
  },
  modalActionRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  modalFormGrid: {
    display: "grid",
    gap: "12px",
  },
  segmentedRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  segmentedButton: (active) => ({
    border: `1px solid ${active ? "rgba(56,189,248,0.22)" : "var(--app-border)"}`,
    background: active ? "rgba(56,189,248,0.12)" : "var(--app-surface-elevated)",
    color: active ? "#38bdf8" : "var(--app-text)",
    borderRadius: "12px",
    minHeight: "40px",
    padding: "0 12px",
    cursor: "pointer",
    fontWeight: 700,
  }),
};
