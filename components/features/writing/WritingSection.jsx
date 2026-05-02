"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import WritingEditorModule from "@/components/features/writing/components/WritingEditorModule";
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
  const filteredEntries = useMemo(
    () => filterWritingEntries(entries, libraryFilter),
    [entries, libraryFilter],
  );
  const activeEntryDateLabel = useMemo(
    () => buildWritingJapaneseTitle(selectedEntry?.entryLocalDate || new Date()),
    [selectedEntry],
  );

  const handleSelectEntry = useCallback(
    async (entry) => {
      if (entry.id === selectedEntryId) {
        setSelectedEntryId(null);
        setEntryBody("");
        setStatusMessage("Entry closed.");
        return;
      }

      setSelectedEntryId(entry.id);
      setEntryBody(entry.body || "");

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
    [authUserId, selectedEntryId],
  );

  const handleNewEntry = useCallback(() => {
    setSelectedEntryId(null);
    setEntryBody("");
    setStatusMessage("Ready for a new entry.");
  }, []);

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
    setSavingEntry(false);

    if (error || !persistedEntry) {
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
  }, [authUserId, entries, entryBody, onWritingTotalsRefresh, selectedEntryId, setWordsWritten]);

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
          onContentChange={(nextValue) => {
            setEntryBody(nextValue);
            if (!loadError) {
              setStatusMessage("");
            }
          }}
          onSave={handleSaveEntry}
          onNewEntry={handleNewEntry}
          onDelete={handleDeleteEntry}
        />
      </div>

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

      <WritingVisualisationModule
        styles={styles}
        isMobile={isMobile}
        summary={writingSummary}
      />
    </div>
  );
}
