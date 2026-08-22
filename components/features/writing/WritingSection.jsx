"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenCheck, PenLine } from "lucide-react";
import WritingEditorModule from "@/components/features/writing/components/WritingEditorModule";
import GrammarLibraryModule from "@/components/features/writing/components/GrammarLibraryModule";
import GrammarExplanationModal from "@/components/features/writing/components/GrammarExplanationModal";
import WritingCompletionModal from "@/components/features/writing/components/WritingCompletionModal";
import WritingLibraryModule from "@/components/features/writing/components/WritingLibraryModule";
import WritingVisualisationModule from "@/components/features/writing/components/WritingVisualisationModule";
import {
  buildWritingJapaneseTitle,
  buildWritingMetrics,
  buildWritingSummary,
  filterWritingEntries,
  getEntryPreview,
} from "@/components/features/writing/utils/writingStats";
import {
  createWritingEntryId,
  deleteWritingEntry,
  readWritingEntry,
  readWritingEntries,
  persistWritingEntry,
  removeWritingEntry,
  upsertWritingEntry,
} from "@/components/features/writing/utils/writingStorage";
import {
  deleteGrammarAttemptsForEntry,
  persistGrammarAttempt,
  readGrammarAttempts,
} from "@/components/features/writing/utils/grammarStorage";
import {
  buildGrammarProgress,
  chooseAdaptiveGrammar,
  findGrammarCandidates,
} from "@/components/features/writing/utils/grammarProgress";

const WRITING_PROMPT_CACHE_KEY = "jp-writing-coach-prompt-v4";

export default function WritingSection({
  styles,
  setWordsWritten,
  onWritingTotalsRefresh,
  isCompact = false,
  isMobile = false,
  authUserId = "",
}) {
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(Boolean(authUserId));
  const [savingEntry, setSavingEntry] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [entryBody, setEntryBody] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("all");
  const [statusMessage, setStatusMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [coachPrompt, setCoachPrompt] = useState(null);
  const [coachFeedback, setCoachFeedback] = useState(null);
  const [coachError, setCoachError] = useState("");
  const [coachNotice, setCoachNotice] = useState("");
  const [loadingCoachPrompt, setLoadingCoachPrompt] = useState(false);
  const [loadingCoachFeedback, setLoadingCoachFeedback] = useState(false);
  const [grammarLevel, setGrammarLevel] = useState("N4");
  const [grammarExplanation, setGrammarExplanation] = useState(null);
  const [grammarExplanationError, setGrammarExplanationError] = useState("");
  const [loadingGrammarExplanation, setLoadingGrammarExplanation] = useState(false);
  const [isGrammarExplanationOpen, setIsGrammarExplanationOpen] = useState(false);
  const [writingCompletion, setWritingCompletion] = useState(null);
  const [writingView, setWritingView] = useState("write");
  const [grammarAttempts, setGrammarAttempts] = useState([]);
  const [loadingGrammarAttempts, setLoadingGrammarAttempts] = useState(Boolean(authUserId));
  const [grammarSyncNotice, setGrammarSyncNotice] = useState("");

  useEffect(() => {
    const savedLevel = window.localStorage.getItem("writing-coach-jlpt-level");
    if (["N5", "N4", "N3", "N2", "N1"].includes(savedLevel)) {
      setGrammarLevel(savedLevel);
    }
  }, []);

  useEffect(() => {
    try {
      const cachedPrompt = JSON.parse(
        window.localStorage.getItem(getPromptCacheKey(authUserId)) || "null",
      );
      const validCachedPrompt =
        cachedPrompt &&
        typeof cachedPrompt === "object" &&
        cachedPrompt.grammarPointId &&
        cachedPrompt.grammarHintJapanese &&
        cachedPrompt.grammarHintJapaneseFurigana;
      setCoachPrompt(validCachedPrompt ? cachedPrompt : null);
    } catch {
      setCoachPrompt(null);
    }
  }, [authUserId]);

  useEffect(() => {
    let isActive = true;

    const loadEntries = async () => {
      if (!authUserId) {
        if (!isActive) {
          return;
        }

        setEntries([]);
        setLoadingEntries(false);
        setLoadError("");
        setSelectedEntryId(null);
        setEntryBody("");
        return;
      }

      setLoadingEntries(true);
      setLoadError("");

      const { entries: nextEntries, fromCache, error } = await readWritingEntries(authUserId);

      if (!isActive) {
        return;
      }

      setEntries(nextEntries);
      setLoadingEntries(false);
      setLoadError(error?.message || "");

      if (fromCache && error) {
        setStatusMessage("Supabase is currently unavailable. Showing cached writing entries.");
      } else if (error) {
        setStatusMessage(error.message || "Failed to load writing entries.");
      } else {
        setStatusMessage("");
      }
    };

    void loadEntries();

    return () => {
      isActive = false;
    };
  }, [authUserId]);

  useEffect(() => {
    let isActive = true;

    const loadAttempts = async () => {
      if (!authUserId) {
        if (isActive) {
          setGrammarAttempts([]);
          setLoadingGrammarAttempts(false);
        }
        return;
      }

      setLoadingGrammarAttempts(true);
      const { attempts, error, fromCache } = await readGrammarAttempts(authUserId);
      if (!isActive) return;

      setGrammarAttempts(attempts);
      setLoadingGrammarAttempts(false);
      setGrammarSyncNotice(error
        ? fromCache
          ? "Showing locally cached grammar progress while Supabase is unavailable."
          : "Apply the grammar progress Supabase migration to sync progress between devices."
        : "");
    };

    void loadAttempts();
    return () => {
      isActive = false;
    };
  }, [authUserId]);

  useEffect(() => {
    if (!statusMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setStatusMessage("");
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [statusMessage]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) || null,
    [entries, selectedEntryId],
  );
  const draftMetrics = useMemo(() => buildWritingMetrics(entryBody), [entryBody]);
  const writingSummary = useMemo(() => buildWritingSummary(entries), [entries]);
  const grammarProgress = useMemo(
    () => buildGrammarProgress(grammarAttempts),
    [grammarAttempts],
  );
  const filteredEntries = useMemo(
    () => filterWritingEntries(entries, libraryFilter),
    [entries, libraryFilter],
  );
  const activeEntryDateLabel = useMemo(
    () => buildWritingJapaneseTitle(selectedEntry?.entryLocalDate || new Date()),
    [selectedEntry],
  );

  const resetCoachFeedback = useCallback(() => {
    setCoachFeedback(null);
    setCoachError("");
    setCoachNotice("");
  }, []);

  const handleSelectEntry = useCallback(
    async (entry) => {
      if (entry.id === selectedEntryId) {
        setSelectedEntryId(null);
        setEntryBody("");
        setStatusMessage("Entry closed.");
        resetCoachFeedback();
        return;
      }

      setSelectedEntryId(entry.id);
      setEntryBody(entry.body || "");
      resetCoachFeedback();

      if (entry.body) {
        setStatusMessage("Loaded entry into the editor.");
        return;
      }

      setStatusMessage("Loading entry...");

      const { entry: fullEntry, error } = await readWritingEntry(entry.id, authUserId);
      if (error || !fullEntry) {
        setStatusMessage(error?.message || "Failed to load writing entry.");
        return;
      }

      setEntries((currentEntries) => upsertWritingEntry(currentEntries, fullEntry));
      setEntryBody(fullEntry.body || "");
      setStatusMessage("Loaded entry into the editor.");
    },
    [authUserId, resetCoachFeedback, selectedEntryId],
  );

  const handleNewEntry = useCallback(() => {
    setSelectedEntryId(null);
    setEntryBody("");
    setStatusMessage("Ready for a new entry.");
    resetCoachFeedback();
  }, [resetCoachFeedback]);

  const handleGenerateCoachPrompt = useCallback(async (requestedPoint = null) => {
    setLoadingCoachPrompt(true);
    setCoachError("");
    setCoachNotice("");

    try {
      const targetLevel = requestedPoint?.id ? requestedPoint.level : grammarLevel;
      const grammarTarget = requestedPoint?.id
        ? requestedPoint
        : chooseAdaptiveGrammar(grammarProgress, targetLevel, coachPrompt?.grammarPointId);
      const response = await fetch("/api/writing/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "prompt",
          jlptLevel: targetLevel,
          grammarTarget: grammarTarget
            ? {
                id: grammarTarget.id,
                level: grammarTarget.level,
                japanese: grammarTarget.japanese,
                meaning: grammarTarget.meaning,
              }
            : null,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.prompt) {
        throw new Error(payload?.error || "Unable to generate a writing prompt.");
      }

      const nextPrompt = {
        ...payload.prompt,
        grammarPointId: grammarTarget?.id || "",
        grammarPoint: grammarTarget?.japanese || payload.prompt.grammarPoint,
        grammarMeaning: grammarTarget?.meaning || payload.prompt.grammarHint,
        source: payload?.fallback ? "fallback" : "ai",
        model: payload?.model || "",
        jlptLevel: targetLevel,
      };
      setCoachPrompt(nextPrompt);
      window.localStorage.setItem(getPromptCacheKey(authUserId), JSON.stringify(nextPrompt));
    } catch (error) {
      setCoachError(error?.message || "Unable to generate a writing prompt.");
    } finally {
      setLoadingCoachPrompt(false);
    }
  }, [authUserId, coachPrompt?.grammarPointId, grammarLevel, grammarProgress]);

  const handleGrammarLevelChange = useCallback((nextLevel) => {
    setGrammarLevel(nextLevel);
    window.localStorage.setItem("writing-coach-jlpt-level", nextLevel);
  }, []);

  const openGrammarExplanation = useCallback(async (point) => {
    const grammarPoint = point?.grammarPoint || point?.japanese;
    const level = point?.jlptLevel || point?.level || grammarLevel;
    if (!grammarPoint) {
      return;
    }

    setIsGrammarExplanationOpen(true);
    setGrammarExplanationError("");

    if (
      grammarExplanation?.grammarPoint === grammarPoint &&
      grammarExplanation?.level === level
    ) {
      return;
    }

    setGrammarExplanation(null);
    setLoadingGrammarExplanation(true);

    try {
      const response = await fetch("/api/writing/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "explanation",
          grammarPoint,
          jlptLevel: level,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.explanation) {
        throw new Error(payload?.error || "Unable to explain this grammar point.");
      }

      setGrammarExplanation(payload.explanation);
    } catch (error) {
      setGrammarExplanationError(error?.message || "Unable to explain this grammar point.");
    } finally {
      setLoadingGrammarExplanation(false);
    }
  }, [grammarExplanation, grammarLevel]);

  const handleExplainGrammar = useCallback(
    () => openGrammarExplanation(coachPrompt),
    [coachPrompt, openGrammarExplanation],
  );

  const handlePractiseGrammar = useCallback((point) => {
    setWritingView("write");
    setGrammarLevel(point.level);
    window.localStorage.setItem("writing-coach-jlpt-level", point.level);
    window.setTimeout(() => void handleGenerateCoachPrompt(point), 0);
  }, [handleGenerateCoachPrompt]);

  const handleGetCoachFeedback = useCallback(async () => {
    const nextBody = entryBody.trim();

    if (!nextBody) {
      setCoachError("Write a little first, then ask for feedback.");
      setCoachFeedback(null);
      setCoachNotice("");
      return;
    }

    setLoadingCoachFeedback(true);
    setCoachError("");
    setCoachNotice("");

    try {
      const response = await fetch("/api/writing/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "feedback",
          body: nextBody,
          coachPrompt,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload?.feedback) {
        throw new Error(payload?.error || "Unable to generate writing feedback.");
      }

      setCoachFeedback({
        ...payload.feedback,
        source: payload?.fallback ? "fallback" : "ai",
        model: payload?.model || "",
      });
      setCoachNotice(payload?.notice || "");
    } catch (error) {
      setCoachError(error?.message || "Unable to generate writing feedback.");
      setCoachFeedback(null);
      setCoachNotice("");
    } finally {
      setLoadingCoachFeedback(false);
    }
  }, [coachPrompt, entryBody]);

  const handleSaveEntry = useCallback(async () => {
    const nextBody = entryBody;
    const nextMetrics = buildWritingMetrics(nextBody);

    if (!nextMetrics.characterCount) {
      setStatusMessage("Add some writing before saving.");
      return;
    }

    if (!authUserId) {
      setStatusMessage("Sign in to save writing entries to Supabase.");
      return;
    }

    const existingEntry = entries.find((entry) => entry.id === selectedEntryId) || null;
    const now = new Date().toISOString();
    const entryLocalDate = existingEntry?.entryLocalDate || now.slice(0, 10);
    const nextEntry = {
      id: existingEntry?.id || createWritingEntryId(),
      title: buildWritingJapaneseTitle(entryLocalDate),
      body: nextBody,
      preview: getEntryPreview(nextBody),
      characterCount: nextMetrics.characterCount,
      estimatedWords: nextMetrics.estimatedWords,
      estimatedMinutes: nextMetrics.estimatedMinutes,
      entryLocalDate,
      createdAt: existingEntry?.createdAt || now,
      updatedAt: now,
    };
    const previousWords = Number(existingEntry?.estimatedWords || 0);
    const metricDelta = nextEntry.estimatedWords - previousWords;
    const mode = existingEntry ? "update" : "insert";

    setSavingEntry(true);
    const { entry: persistedEntry, error } = await persistWritingEntry(nextEntry, authUserId, mode);

    if (error || !persistedEntry) {
      setSavingEntry(false);
      setStatusMessage(error?.message || "Failed to save writing entry.");
      return;
    }

    const nextEntries = upsertWritingEntry(entries, persistedEntry);

    setEntries(nextEntries);
    setSelectedEntryId(persistedEntry.id);
    setStatusMessage(existingEntry ? "Entry updated." : "Entry saved.");
    onWritingTotalsRefresh?.();

    if (metricDelta) {
      setWordsWritten?.(
        (currentWords) => Math.max(0, currentWords + metricDelta),
        {
          kind: metricDelta > 0 ? "session" : "adjustment",
          source: existingEntry ? "writing-edit" : "writing",
          note: persistedEntry.title || "Journal entry",
        },
      );
    }

    let assessment = null;
    try {
      const grammarCandidates = findGrammarCandidates(
        nextBody,
        coachPrompt?.grammarPointId,
      );
      const assessmentResponse = await fetch("/api/writing/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assessment",
          body: nextBody,
          coachPrompt,
          grammarCandidates: grammarCandidates.map((point) => ({
            id: point.id,
            level: point.level,
            japanese: point.japanese,
            meaning: point.meaning,
          })),
        }),
      });
      const assessmentPayload = await assessmentResponse.json();
      if (assessmentResponse.ok && assessmentPayload?.assessment) {
        assessment = assessmentPayload.assessment;
        const targetPoint = grammarProgress.points.find(
          (point) => point.id === coachPrompt?.grammarPointId,
        );
        const trackedAssessments = [];
        if (targetPoint && assessment.grammarAssessment) {
          trackedAssessments.push({
            grammarPoint: targetPoint,
            grammarAssessment: assessment.grammarAssessment,
            source: "prompted",
          });
        }

        (assessment.detectedGrammar || []).forEach((detected) => {
          const grammarPoint = grammarProgress.points.find(
            (point) => point.id === detected.grammarPointId,
          );
          if (grammarPoint && grammarPoint.id !== targetPoint?.id) {
            trackedAssessments.push({ grammarPoint, grammarAssessment: detected, source: "detected" });
          }
        });

        const progressResults = await Promise.all(trackedAssessments.map((item) =>
          persistGrammarAttempt({
            userId: authUserId,
            entryId: persistedEntry.id,
            grammarPoint: item.grammarPoint,
            assessment: item.grammarAssessment,
            source: item.source,
          })));
        const savedAttempts = progressResults.map((result) => result.attempt).filter(Boolean);

        if (savedAttempts.length) {
          setGrammarAttempts((current) => [
            ...savedAttempts,
            ...current.filter((item) => !savedAttempts.some((saved) => (
              item.entryId === saved.entryId && item.grammarPointId === saved.grammarPointId
            ))),
          ]);
        }

        if (progressResults.some((result) => result.error)) {
          setGrammarSyncNotice("Grammar progress is cached locally. Apply the Supabase migration to sync it between devices.");
        }
      }
    } catch {
      assessment = null;
    }

    setSavingEntry(false);
    const nextWritingSummary = buildWritingSummary(nextEntries);
    setWritingCompletion({
      assessment,
      estimatedWords: persistedEntry.estimatedWords,
      characterCount: persistedEntry.characterCount,
      streak: nextWritingSummary.currentStreak,
      preview: persistedEntry.preview,
    });
    playWritingCompletionJingle();
  }, [authUserId, coachPrompt, entries, entryBody, grammarProgress.points, onWritingTotalsRefresh, selectedEntryId, setWordsWritten]);

  const handleDeleteEntry = useCallback(async () => {
    if (!selectedEntry) {
      return;
    }

    const shouldDelete = typeof window === "undefined"
      ? true
      : window.confirm("Delete this writing entry? This will also subtract its tracked words.");

    if (!shouldDelete) {
      return;
    }

    setDeletingEntry(true);
    const { ok, error } = await deleteWritingEntry(selectedEntry.id, authUserId);
    setDeletingEntry(false);

    if (!ok) {
      setStatusMessage(error?.message || "Failed to delete writing entry.");
      return;
    }

    setEntries((currentEntries) => removeWritingEntry(currentEntries, selectedEntry.id));
    setGrammarAttempts((current) => current.filter((attempt) => attempt.entryId !== selectedEntry.id));
    void deleteGrammarAttemptsForEntry(authUserId, selectedEntry.id);
    setSelectedEntryId(null);
    setEntryBody("");
    setStatusMessage("Entry deleted.");
    onWritingTotalsRefresh?.();

    if (selectedEntry.estimatedWords) {
      setWordsWritten?.(
        (currentWords) => Math.max(0, currentWords - selectedEntry.estimatedWords),
        {
          kind: "adjustment",
          source: "writing",
          note: selectedEntry.title || "Deleted journal entry",
        },
      );
    }
  }, [authUserId, onWritingTotalsRefresh, selectedEntry, setWordsWritten]);

  return (
    <>
      <div style={viewStyles.switcherWrap}>
        <div style={viewStyles.switcher}>
          <button
            type="button"
            onClick={() => setWritingView("write")}
            style={viewStyles.switchButton(writingView === "write")}
          >
            <PenLine size={15} /> Write
          </button>
          <button
            type="button"
            onClick={() => setWritingView("grammar")}
            style={viewStyles.switchButton(writingView === "grammar")}
          >
            <BookOpenCheck size={15} /> Grammar library
            <span style={viewStyles.count}>{grammarProgress.practiced}/{grammarProgress.total}</span>
          </button>
        </div>
      </div>

      {writingView === "grammar" ? (
        <GrammarLibraryModule
          progress={grammarProgress}
          attemptsLoading={loadingGrammarAttempts}
          syncNotice={grammarSyncNotice}
          isMobile={isMobile}
          onExplain={openGrammarExplanation}
          onPractise={handlePractiseGrammar}
        />
      ) : (
      <div
      style={{
        ...styles.listeningMainGrid,
        gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.55fr) minmax(320px, 1fr)",
        alignItems: "start",
        minHeight: 0,
      }}
    >
      <div style={isMobile ? null : { gridRow: "1 / span 2", minHeight: 0, height: "100%" }}>
        <WritingEditorModule
          styles={styles}
          isCompact={isCompact}
          isMobile={isMobile}
          content={entryBody}
          metrics={draftMetrics}
          entryDateLabel={activeEntryDateLabel}
          selectedEntry={selectedEntry}
          statusMessage={statusMessage}
          isSaving={savingEntry}
          isDeleting={deletingEntry}
          coachPrompt={coachPrompt}
          grammarPointProgress={grammarProgress.points.find(
            (point) => point.id === coachPrompt?.grammarPointId,
          ) || null}
          coachFeedback={coachFeedback}
          coachError={coachError}
          coachNotice={coachNotice}
          grammarLevel={grammarLevel}
          isGeneratingPrompt={loadingCoachPrompt}
          isGeneratingFeedback={loadingCoachFeedback}
          isExplainingGrammar={loadingGrammarExplanation}
          onContentChange={(nextValue) => {
            setEntryBody(nextValue);
            setCoachFeedback(null);
            setCoachError("");
            setCoachNotice("");
            if (!loadError) {
              setStatusMessage("");
            }
          }}
          onSave={handleSaveEntry}
          onNewEntry={handleNewEntry}
          onDelete={handleDeleteEntry}
          onGeneratePrompt={handleGenerateCoachPrompt}
          onGetFeedback={handleGetCoachFeedback}
          onGrammarLevelChange={handleGrammarLevelChange}
          onExplainGrammar={handleExplainGrammar}
        />
      </div>

      {isMobile ? (
        <WritingVisualisationModule
          styles={styles}
          isMobile
          summary={writingSummary}
        />
      ) : null}

      {!isMobile ? (
        <WritingLibraryModule
          styles={styles}
          isCompact={isCompact}
          isMobile={isMobile}
          entries={filteredEntries}
          loading={loadingEntries}
          error={loadError}
          selectedEntryId={selectedEntryId}
          activeFilter={libraryFilter}
          onFilterChange={setLibraryFilter}
          onSelectEntry={handleSelectEntry}
        />
      ) : null}

      {!isMobile ? (
        <WritingVisualisationModule
          styles={styles}
          isMobile={isMobile}
          summary={writingSummary}
        />
      ) : null}
      </div>
      )}

      <GrammarExplanationModal
        open={isGrammarExplanationOpen}
        explanation={grammarExplanation}
        loading={loadingGrammarExplanation}
        error={grammarExplanationError}
        onClose={() => setIsGrammarExplanationOpen(false)}
      />

      <WritingCompletionModal
        completion={writingCompletion}
        onClose={() => setWritingCompletion(null)}
      />
    </>
  );
}

const viewStyles = {
  switcherWrap: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "14px",
  },
  switcher: {
    display: "inline-flex",
    gap: "5px",
    padding: "5px",
    borderRadius: "999px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-pill-track)",
  },
  switchButton: (active) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    minHeight: "38px",
    padding: "0 13px",
    border: 0,
    borderRadius: "999px",
    background: active ? "var(--app-selected-surface)" : "transparent",
    color: active ? "var(--app-selected-text)" : "var(--app-text-muted)",
    boxShadow: active ? "0 7px 18px rgba(15,23,42,.08)" : "none",
    fontSize: "12px",
    fontWeight: 750,
    cursor: "pointer",
  }),
  count: {
    padding: "3px 6px",
    borderRadius: "999px",
    background: "rgba(16,185,129,.1)",
    color: "#047857",
    fontSize: "9px",
  },
};

function getPromptCacheKey(userId = "") {
  return `${WRITING_PROMPT_CACHE_KEY}:${userId || "local"}`;
}

function playWritingCompletionJingle() {
  if (typeof window === "undefined") {
    return;
  }

  const completionAudio = new Audio("/sounds/shadowing-session-complete.mp3");
  completionAudio.volume = 0.65;
  completionAudio.play().catch(() => playSynthesizedWritingJingle());
}

function playSynthesizedWritingJingle() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }

  const context = new AudioContext();
  const startAt = context.currentTime + 0.03;
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startAt + index * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.1, startAt + index * 0.12 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + index * 0.12 + 0.22);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt + index * 0.12);
    oscillator.stop(startAt + index * 0.12 + 0.24);
  });
  window.setTimeout(() => void context.close(), 700);
}
