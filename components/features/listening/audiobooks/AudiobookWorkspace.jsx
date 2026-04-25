"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { List, Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import AudiobookCurrentlyListening from "@/components/features/listening/audiobooks/AudiobookCurrentlyListening";
import AudiobookLibrary from "@/components/features/listening/audiobooks/AudiobookLibrary";
import AudiobookPlayer from "@/components/features/listening/audiobooks/AudiobookPlayer";
import { useAudiobookPlayer } from "@/hooks/useAudiobookPlayer";
import { buildJapaneseSearchIndex } from "@/lib/japaneseSearch";

export default function AudiobookWorkspace({
  authUserId,
  isMobile = false,
  onPlaybackStateChange,
  audiobooksData,
  audiobooksLoading,
  audiobooksError,
  audiobookLaunchRequest,
  onAudiobookLaunchResult,
}) {
  const {
    activeChapterIndex,
    books,
    chapters,
    currentBook,
    currentProgressSeconds,
    closePlayer,
    hasPlayableAudio,
    isPlaying,
    currentlyListeningBook,
    durationSeconds,
    loadBook,
    playbackState,
    playFromStart,
    progressPercent,
    savingProgress,
    seekTo,
    selectCurrentlyListening,
    skipBy,
    togglePlayback,
  } = useAudiobookPlayer(audiobooksData, authUserId);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isMiniChapterPickerOpen, setIsMiniChapterPickerOpen] = useState(false);
  const hasMounted = useSyncExternalStore(
    subscribeToMountState,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );
  const playbackStateRef = useRef(null);
  const audiobookLaunchHandledRef = useRef(null);

  const usingFetchedBooks = Array.isArray(audiobooksData) && audiobooksData.length > 0;
  const showMobilePlayerOverlay = Boolean(
    isMobile && isPlayerOpen && currentBook && hasMounted && !isPlayerMinimized,
  );
  const showMobileMiniPlayer = Boolean(
    isMobile && isPlayerOpen && currentBook && hasMounted && isPlayerMinimized,
  );
  const showMobileMiniChapterPicker = Boolean(
    showMobileMiniPlayer && isMiniChapterPickerOpen,
  );
  const showMobileLibraryOverlay = Boolean(isMobile && isLibraryOpen && hasMounted);

  useEffect(() => {
    if (!audiobookLaunchRequest?.id) {
      return;
    }

    if (audiobookLaunchHandledRef.current === audiobookLaunchRequest.id) {
      return;
    }

    if (audiobooksLoading && !books.length) {
      return;
    }

    const matchedBook = findAudiobookForReadingBook(books, audiobookLaunchRequest);
    if (!matchedBook) {
      audiobookLaunchHandledRef.current = audiobookLaunchRequest.id;
      onAudiobookLaunchResult?.({
        ok: false,
        requestId: audiobookLaunchRequest.id,
        requestedTitle: audiobookLaunchRequest.title,
        error: "No matching audiobook found.",
      });
      return;
    }

    const launchTimer = window.setTimeout(() => {
      if (audiobookLaunchHandledRef.current === audiobookLaunchRequest.id) {
        return;
      }

      audiobookLaunchHandledRef.current = audiobookLaunchRequest.id;
      loadBook(matchedBook, "loaded", "reading-current-book");
      setIsPlayerOpen(true);
      setIsPlayerMinimized(true);
      onAudiobookLaunchResult?.({
        ok: true,
        requestId: audiobookLaunchRequest.id,
        requestedTitle: audiobookLaunchRequest.title,
        book: matchedBook,
      });
    }, 0);

    return () => window.clearTimeout(launchTimer);
  }, [
    audiobookLaunchRequest,
    audiobooksLoading,
    books,
    loadBook,
    onAudiobookLaunchResult,
  ]);

  useEffect(() => {
    if (
      (!showMobilePlayerOverlay && !showMobileLibraryOverlay && !showMobileMiniChapterPicker) ||
      typeof document === "undefined"
    ) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showMobileLibraryOverlay, showMobileMiniChapterPicker, showMobilePlayerOverlay]);

  useEffect(() => {
    const nextSnapshot = {
      bookId: currentBook?.id || null,
      isPlaying: playbackState === "playing",
      currentTime: Math.round(Math.max(0, Number(currentProgressSeconds || 0)) * 10) / 10,
      durationSeconds: Math.round(Math.max(0, Number(durationSeconds || 0)) * 10) / 10,
      isPlayerOpen,
      isPlayerMinimized,
    };
    const previousSnapshot = playbackStateRef.current;

    if (
      previousSnapshot &&
      previousSnapshot.bookId === nextSnapshot.bookId &&
      previousSnapshot.isPlaying === nextSnapshot.isPlaying &&
      Math.abs(previousSnapshot.currentTime - nextSnapshot.currentTime) < 0.1 &&
      Math.abs(previousSnapshot.durationSeconds - nextSnapshot.durationSeconds) < 0.1 &&
      previousSnapshot.isPlayerOpen === nextSnapshot.isPlayerOpen &&
      previousSnapshot.isPlayerMinimized === nextSnapshot.isPlayerMinimized
    ) {
      return;
    }

    playbackStateRef.current = nextSnapshot;
    onPlaybackStateChange?.({
      isPlaying: nextSnapshot.isPlaying,
      playbackState,
      book: currentBook,
      currentTime: currentProgressSeconds,
      durationSeconds,
      isPlayerOpen,
      isPlayerMinimized,
    });
  }, [
    currentBook,
    currentProgressSeconds,
    durationSeconds,
    isPlayerOpen,
    isPlayerMinimized,
    onPlaybackStateChange,
    playbackState,
  ]);

  useEffect(
    () => () => {
      onPlaybackStateChange?.({
        isPlaying: false,
        playbackState: "idle",
        book: null,
        currentTime: 0,
        durationSeconds: 0,
        isPlayerOpen: false,
      });
    },
    [onPlaybackStateChange],
  );

  return (
    <div style={styles.shell}>
      {isPlayerOpen && currentBook && !isMobile ? (
        <AudiobookPlayer
          activeChapterIndex={activeChapterIndex}
          book={currentBook}
          chapters={chapters}
          currentProgressSeconds={currentProgressSeconds}
          durationSeconds={durationSeconds}
          hasPlayableAudio={hasPlayableAudio}
          isMobile={isMobile}
          isPlaying={isPlaying}
          playbackState={playbackState}
          progressPercent={progressPercent}
          onPlayFromStart={playFromStart}
          onClosePlayer={() => {
            closePlayer();
            setIsPlayerOpen(false);
            setIsPlayerMinimized(false);
          }}
          savingProgress={savingProgress}
          onSeekTo={seekTo}
          onSkipBy={skipBy}
          onTogglePlayback={togglePlayback}
        />
      ) : (
        <>
          <AudiobookCurrentlyListening
            book={currentlyListeningBook}
            isMobile={isMobile}
            libraryCount={books.length}
            onOpenLibrary={isMobile ? () => setIsLibraryOpen(true) : null}
            onOpenPlayer={() => {
              selectCurrentlyListening("loaded");
              setIsPlayerOpen(true);
              setIsPlayerMinimized(false);
            }}
            onPlayNow={() => {
              selectCurrentlyListening("playing");
              setIsPlayerOpen(true);
              setIsPlayerMinimized(false);
            }}
          />
          {isMobile ? null : (
            <AudiobookLibrary
              books={books}
              onSelect={(book) => loadBook(book, "loaded", "library")}
              hint={
                usingFetchedBooks
                  ? "Browse your audiobook library"
                  : audiobooksLoading
                    ? "Loading your audiobook shelf"
                    : audiobooksError
                      ? "Showing fallback audiobooks for now"
                      : undefined
              }
            />
          )}
        </>
      )}

      {hasMounted &&
        createPortal(
          <AnimatePresence>
            {showMobilePlayerOverlay ? (
              <motion.div
                style={styles.mobilePlayerOverlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.div
                  style={styles.mobilePlayerBackdrop}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => {
                    closePlayer();
                    setIsPlayerOpen(false);
                    setIsPlayerMinimized(false);
                  }}
                />
                <motion.div
                  style={styles.mobilePlayerSheet}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                >
                  <AudiobookPlayer
                    activeChapterIndex={activeChapterIndex}
                    book={currentBook}
                    chapters={chapters}
                    currentProgressSeconds={currentProgressSeconds}
                    durationSeconds={durationSeconds}
                    hasPlayableAudio={hasPlayableAudio}
                    isMobile
                    isPlaying={isPlaying}
                    playbackState={playbackState}
                    progressPercent={progressPercent}
                    onPlayFromStart={playFromStart}
                    onClosePlayer={() => {
                      closePlayer();
                      setIsPlayerOpen(false);
                      setIsPlayerMinimized(false);
                    }}
                    onMinimizePlayer={() => setIsPlayerMinimized(true)}
                    savingProgress={savingProgress}
                    onSeekTo={seekTo}
                    onSkipBy={skipBy}
                    onTogglePlayback={togglePlayback}
                  />
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body,
        )}

      {showMobileMiniPlayer &&
        createPortal(
          <MiniAudiobookPlayer
            book={currentBook}
            currentProgressSeconds={currentProgressSeconds}
            durationSeconds={durationSeconds}
            hasPlayableAudio={hasPlayableAudio}
            isPlaying={isPlaying}
            playbackState={playbackState}
            progressPercent={progressPercent}
            onClose={() => {
              closePlayer();
              setIsPlayerOpen(false);
              setIsPlayerMinimized(false);
              setIsMiniChapterPickerOpen(false);
            }}
            onExpand={() => setIsPlayerMinimized(false)}
            activeChapterIndex={activeChapterIndex}
            chapters={chapters}
            onOpenChapters={() => setIsMiniChapterPickerOpen(true)}
            onTogglePlayback={togglePlayback}
          />,
          document.body,
        )}

      {showMobileMiniChapterPicker &&
        createPortal(
          <MiniChapterPicker
            book={currentBook}
            chapters={chapters}
            activeChapterIndex={activeChapterIndex}
            onClose={() => setIsMiniChapterPickerOpen(false)}
            onSeekTo={(nextSeconds) => {
              seekTo(nextSeconds);
              setIsMiniChapterPickerOpen(false);
            }}
          />,
          document.body,
        )}

      {showMobileLibraryOverlay &&
        createPortal(
          <div style={styles.mobileLibraryOverlay}>
            <div style={styles.mobileLibraryBackdrop} onClick={() => setIsLibraryOpen(false)} />
            <div style={styles.mobileLibrarySheet}>
              <div style={styles.mobileLibrarySheetHeader}>
                <div style={styles.mobileLibrarySheetHeaderCopy}>
                  <div style={styles.mobileLibrarySheetEyebrow}>Library</div>
                  <h3 style={styles.mobileLibrarySheetTitle}>Audiobooks</h3>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLibraryOpen(false)}
                  style={styles.mobileLibraryCloseButton}
                  aria-label="Close library"
                >
                  <X size={18} />
                </button>
              </div>

              <AudiobookLibrary
                books={books}
                onSelect={(book) => {
                  loadBook(book, "loaded", "library");
                  setIsLibraryOpen(false);
                }}
                hint={
                  usingFetchedBooks
                    ? "Browse your audiobook library"
                    : audiobooksLoading
                      ? "Loading your audiobook shelf"
                      : audiobooksError
                        ? "Showing fallback audiobooks for now"
                        : undefined
                }
                isOverlay
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s"'`.,!?()[\]{}\-_/\\:;|~・、。]+/g, "")
    .trim();
}

function getReadingLaunchQueries(request) {
  return [request?.title, request?.titleNormalized]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function findAudiobookForReadingBook(books, request) {
  const queries = getReadingLaunchQueries(request);
  if (!queries.length) {
    return null;
  }

  const queryTokens = buildJapaneseSearchIndex(queries);
  const squeezedQueries = new Set([
    ...queries.map(normalizeComparableText),
    ...queryTokens.map(normalizeComparableText),
  ].filter(Boolean));

  return (
    books.find((book) => {
      const bookTokens = new Set([
        normalizeComparableText(book.title),
        ...(Array.isArray(book.searchIndex) ? book.searchIndex.map(normalizeComparableText) : []),
      ].filter(Boolean));

      for (const query of squeezedQueries) {
        if (bookTokens.has(query)) {
          return true;
        }
      }

      for (const query of squeezedQueries) {
        for (const candidate of bookTokens) {
          if (candidate.includes(query) || query.includes(candidate)) {
            return true;
          }
        }
      }

      return false;
    }) || null
  );
}

function MiniChapterPicker({
  activeChapterIndex,
  book,
  chapters,
  onClose,
  onSeekTo,
}) {
  const chapterCount = Array.isArray(chapters) ? chapters.length : 0;
  const activeChapter =
    chapterCount > 0 && activeChapterIndex >= 0 ? chapters[activeChapterIndex] : null;

  return (
    <div style={styles.mobileMiniChapterOverlay} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mini-audiobook-chapters-title"
        style={styles.mobileMiniChapterSheet}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.mobileMiniChapterHeader}>
          <div style={styles.mobileMiniChapterHeaderCopy}>
            <div style={styles.mobileMiniChapterEyebrow}>Chapters</div>
            <h4 id="mini-audiobook-chapters-title" style={styles.mobileMiniChapterSheetTitle}>
              {book.title}
            </h4>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.mobileMiniIconButton(false)}
            aria-label="Close chapter list"
          >
            <X size={17} />
          </button>
        </div>

        <div style={styles.mobileMiniChapterMeta}>
          <span>{chapterCount ? `${chapterCount} chapters` : "No chapters"}</span>
          {activeChapter ? <span>Current: {activeChapter.title}</span> : null}
        </div>

        {chapterCount ? (
          <div style={styles.mobileMiniChapterList}>
            {chapters.map((chapter, index) => {
              const active = index === activeChapterIndex;

              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => onSeekTo(chapter.startSeconds)}
                  style={styles.mobileMiniChapterButton(active)}
                >
                  <span style={styles.mobileMiniChapterButtonTitle}>{chapter.title}</span>
                  <span style={styles.mobileMiniChapterButtonTime(active)}>
                    {formatMiniClock(chapter.startSeconds)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={styles.mobileMiniChapterEmpty}>
            Chapter markers are not available for this audiobook.
          </div>
        )}
      </div>
    </div>
  );
}

function MiniAudiobookPlayer({
  activeChapterIndex,
  book,
  chapters,
  currentProgressSeconds,
  durationSeconds,
  hasPlayableAudio,
  isPlaying,
  playbackState,
  progressPercent,
  onClose,
  onExpand,
  onOpenChapters,
  onTogglePlayback,
}) {
  const playing = isPlaying ?? playbackState === "playing";
  const chapterCount = Array.isArray(chapters) ? chapters.length : 0;
  const activeChapter =
    chapterCount > 0 && activeChapterIndex >= 0 ? chapters[activeChapterIndex] : null;
  const nextChapter =
    activeChapterIndex >= 0 && activeChapterIndex < chapterCount - 1
      ? chapters[activeChapterIndex + 1]
      : null;
  const activeChapterStart = activeChapter?.startSeconds ?? 0;
  const activeChapterEnd = Math.max(
    activeChapterStart,
    nextChapter?.startSeconds ??
      (Number.isFinite(activeChapter?.endSeconds) ? activeChapter.endSeconds : durationSeconds),
  );
  const activeChapterDuration =
    activeChapter && activeChapterEnd > activeChapterStart
      ? activeChapterEnd - activeChapterStart
      : durationSeconds;
  const activeChapterProgressSeconds = activeChapter
    ? Math.max(0, Math.min(activeChapterDuration, currentProgressSeconds - activeChapterStart))
    : currentProgressSeconds;
  const activeChapterProgressPercent = activeChapterDuration
    ? (activeChapterProgressSeconds / activeChapterDuration) * 100
    : progressPercent || 0;
  const coverUrl = book?.coverImage || book?.cover_url || MINI_FALLBACK_COVER_URL;

  return (
    <div style={styles.mobileMiniPlayerWrap}>
      <div
        style={styles.mobileMiniPlayer}
        role="button"
        tabIndex={0}
        aria-label={`Open full player for ${book.title}`}
        onClick={() => onExpand?.()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onExpand?.();
          }
        }}
      >
        <div style={styles.mobileMiniProgressTrack} aria-hidden="true">
          <div style={styles.mobileMiniProgressFill(activeChapterProgressPercent)} />
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onExpand?.();
          }}
          style={styles.mobileMiniArtworkButton}
          aria-label="Open full player"
        >
          <img
            src={coverUrl}
            alt={`Cover artwork for ${book.title}`}
            style={styles.mobileMiniArtwork}
            onError={(event) => {
              event.currentTarget.src = MINI_FALLBACK_COVER_URL;
            }}
          />
        </button>

        <div style={styles.mobileMiniMain}>
          <div style={styles.mobileMiniTopRow}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onExpand?.();
              }}
              style={styles.mobileMiniTitleButton}
              aria-label="Open full player"
            >
              <span style={styles.mobileMiniTitle}>{book.title}</span>
            </button>

            <div style={styles.mobileMiniWindowActions}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenChapters();
                }}
                disabled={!chapterCount}
                style={styles.mobileMiniIconButton(!chapterCount)}
                aria-label="Choose chapter"
                title="Choose chapter"
              >
                <List size={17} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePlayback();
                }}
                disabled={!hasPlayableAudio}
                style={styles.mobileMiniPlayButton(!hasPlayableAudio)}
                aria-label={playing ? "Pause audiobook" : "Play audiobook"}
                title={playing ? "Pause audiobook" : "Play audiobook"}
              >
                {playing ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                style={styles.mobileMiniIconButton(false)}
                aria-label="Close player"
                title="Close player"
              >
                <X size={17} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMiniClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (!hours) {
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const MINI_FALLBACK_COVER_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <rect width="160" height="160" fill="#f8fafc"/>
      <circle cx="80" cy="66" r="30" fill="#111827"/>
      <rect x="42" y="112" width="76" height="8" rx="4" fill="#cbd5e1"/>
    </svg>
  `);

const styles = {
  shell: {
    display: "grid",
    gap: "18px",
  },
  mobilePlayerOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
  },
  mobilePlayerBackdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(2, 6, 23, 0.68)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  mobilePlayerSheet: {
    position: "absolute",
    inset: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  mobileLibraryOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10001,
  },
  mobileLibraryBackdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(2, 6, 23, 0.72)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },
  mobileLibrarySheet: {
    position: "absolute",
    inset: "10px",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    gap: "14px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-card)",
    borderRadius: "24px",
    padding: "16px",
    boxShadow: "0 24px 60px rgba(2, 6, 23, 0.32)",
  },
  mobileLibrarySheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  mobileLibrarySheetHeaderCopy: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  mobileLibrarySheetEyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  mobileLibrarySheetTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
    color: "var(--app-text)",
  },
  mobileLibraryCloseButton: {
    width: "42px",
    height: "42px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    borderRadius: "14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    flexShrink: 0,
  },
  mobileMiniPlayerWrap: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: "calc(95px + env(safe-area-inset-bottom, 0px))",
    zIndex: 10003,
    padding: "0 10px 0 10px",
    pointerEvents: "none",
  },
  mobileMiniPlayer: {
    width: "min(100%, 560px)",
    margin: "0 auto",
    border: "1px solid rgba(15,23,42,0.1)",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "10px 10px 9px 10px",
    display: "grid",
    gridTemplateColumns: "62px minmax(0, 1fr)",
    gap: "10px",
    alignItems: "center",
    boxShadow: "0 20px 56px rgba(15,23,42,0.22)",
    pointerEvents: "auto",
    position: "relative",
    overflow: "hidden",
  },
  mobileMiniArtworkButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    width: "62px",
    height: "62px",
    borderRadius: "14px",
    overflow: "hidden",
    cursor: "pointer",
    lineHeight: 0,
  },
  mobileMiniArtwork: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  },
  mobileMiniMain: {
    display: "grid",
    gap: "0",
    minWidth: 0,
  },
  mobileMiniTopRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
  mobileMiniTitleButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    display: "block",
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    textAlign: "left",
    cursor: "pointer",
  },
  mobileMiniTitle: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "var(--app-text)",
    fontSize: "13px",
    fontWeight: 800,
    lineHeight: 1.15,
  },
  mobileMiniWindowActions: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    flexShrink: 0,
  },
  mobileMiniIconButton: (disabled) => ({
    width: "30px",
    height: "30px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    borderRadius: "10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    padding: 0,
  }),
  mobileMiniPlayButton: (disabled) => ({
    border: "none",
    background: "#050505",
    color: "#ffffff",
    borderRadius: "999px",
    width: "42px",
    height: "42px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    padding: 0,
    boxShadow: "0 10px 24px rgba(15,23,42,0.2)",
  }),
  mobileMiniProgressTrack: {
    position: "absolute",
    left: "14px",
    right: "14px",
    top: 0,
    height: "3px",
    borderRadius: "999px",
    background: "rgba(15,23,42,0.08)",
    overflow: "hidden",
  },
  mobileMiniProgressFill: (progressPercent) => ({
    width: `${Math.max(0, Math.min(100, progressPercent || 0))}%`,
    height: "100%",
    background: "#050505",
  }),
  mobileMiniChapterOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10004,
    background: "rgba(2, 6, 23, 0.52)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  mobileMiniChapterSheet: {
    position: "absolute",
    left: "10px",
    right: "10px",
    bottom: "10px",
    maxHeight: "min(70svh, 520px)",
    width: "min(calc(100% - 20px), 560px)",
    margin: "0 auto",
    display: "grid",
    gridTemplateRows: "auto auto minmax(0, 1fr)",
    gap: "12px",
    border: "1px solid var(--app-border-soft)",
    background: "#ffffff",
    borderRadius: "22px",
    padding: "14px",
    boxShadow: "0 24px 60px rgba(2, 6, 23, 0.28)",
  },
  mobileMiniChapterHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  mobileMiniChapterHeaderCopy: {
    display: "grid",
    gap: "5px",
    minWidth: 0,
  },
  mobileMiniChapterEyebrow: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  mobileMiniChapterSheetTitle: {
    margin: 0,
    fontSize: "19px",
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    color: "var(--app-text)",
  },
  mobileMiniChapterMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
    color: "var(--app-text-muted)",
    fontSize: "12px",
    lineHeight: 1.3,
  },
  mobileMiniChapterList: {
    display: "grid",
    gap: "8px",
    overflowY: "auto",
    paddingRight: "2px",
  },
  mobileMiniChapterButton: (active) => ({
    border: active ? "1px solid #050505" : "1px solid var(--app-border-soft)",
    background: active ? "#050505" : "var(--app-surface)",
    color: active ? "#ffffff" : "var(--app-text)",
    borderRadius: "13px",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "12px",
    fontWeight: 700,
  }),
  mobileMiniChapterButtonTitle: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  mobileMiniChapterButtonTime: (active) => ({
    flexShrink: 0,
    color: active ? "rgba(255,255,255,0.76)" : "var(--app-text-muted)",
    fontSize: "11px",
  }),
  mobileMiniChapterEmpty: {
    border: "1px dashed var(--app-border-soft)",
    background: "var(--app-surface)",
    color: "var(--app-text-muted)",
    borderRadius: "14px",
    padding: "14px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
};

function subscribeToMountState() {
  return () => {};
}

function getMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}
