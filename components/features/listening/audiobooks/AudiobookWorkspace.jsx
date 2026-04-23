"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { List, X } from "lucide-react";
import AudiobookCurrentlyListening from "@/components/features/listening/audiobooks/AudiobookCurrentlyListening";
import AudiobookLibrary from "@/components/features/listening/audiobooks/AudiobookLibrary";
import AudiobookPlayer from "@/components/features/listening/audiobooks/AudiobookPlayer";
import { useAudiobookPlayer } from "@/hooks/useAudiobookPlayer";

export default function AudiobookWorkspace({
  authUserId,
  isMobile = false,
  onPlaybackStateChange,
  audiobooksData,
  audiobooksLoading,
  audiobooksError,
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
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const hasMounted = useSyncExternalStore(
    subscribeToMountState,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );
  const playbackStateRef = useRef(null);

  const usingFetchedBooks = Array.isArray(audiobooksData) && audiobooksData.length > 0;
  const showMobilePlayerOverlay = Boolean(isMobile && isPlayerOpen && currentBook && hasMounted);
  const showMobileLibraryOverlay = Boolean(isMobile && isLibraryOpen && hasMounted);

  useEffect(() => {
    if ((!showMobilePlayerOverlay && !showMobileLibraryOverlay) || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showMobileLibraryOverlay, showMobilePlayerOverlay]);

  useEffect(() => {
    const nextSnapshot = {
      bookId: currentBook?.id || null,
      isPlaying: playbackState === "playing",
      currentTime: Math.round(Math.max(0, Number(currentProgressSeconds || 0)) * 10) / 10,
      durationSeconds: Math.round(Math.max(0, Number(durationSeconds || 0)) * 10) / 10,
      isPlayerOpen,
    };
    const previousSnapshot = playbackStateRef.current;

    if (
      previousSnapshot &&
      previousSnapshot.bookId === nextSnapshot.bookId &&
      previousSnapshot.isPlaying === nextSnapshot.isPlaying &&
      Math.abs(previousSnapshot.currentTime - nextSnapshot.currentTime) < 0.1 &&
      Math.abs(previousSnapshot.durationSeconds - nextSnapshot.durationSeconds) < 0.1 &&
      previousSnapshot.isPlayerOpen === nextSnapshot.isPlayerOpen
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
    });
  }, [
    currentBook,
    currentProgressSeconds,
    durationSeconds,
    isPlayerOpen,
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
            onOpenPlayer={() => {
              selectCurrentlyListening("loaded");
              setIsPlayerOpen(true);
            }}
            onPlayNow={() => {
              selectCurrentlyListening("playing");
              setIsPlayerOpen(true);
            }}
          />
          {isMobile ? (
            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              style={styles.mobileLibraryLauncher}
            >
              <span style={styles.mobileLibraryLauncherLabel}>Library</span>

              <div style={styles.mobileLibraryLauncherMeta}>
                <span style={styles.mobileLibraryLauncherCount}>{books.length} books</span>
                <span style={styles.mobileLibraryLauncherIconWrap}>
                  <List size={18} />
                </span>
              </div>
            </button>
          ) : (
            <AudiobookLibrary
              books={books}
              onSelect={loadBook}
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

      {showMobilePlayerOverlay &&
        createPortal(
          <div style={styles.mobilePlayerOverlay}>
            <div
              style={styles.mobilePlayerBackdrop}
              onClick={() => {
                closePlayer();
                setIsPlayerOpen(false);
              }}
            />
            <div style={styles.mobilePlayerSheet}>
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
                }}
                savingProgress={savingProgress}
                onSeekTo={seekTo}
                onSkipBy={skipBy}
                onTogglePlayback={togglePlayback}
              />
            </div>
          </div>,
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
                  loadBook(book);
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
    inset: "max(env(safe-area-inset-top), 10px) 10px max(env(safe-area-inset-bottom), 10px) 10px",
    display: "flex",
    justifyContent: "center",
    overflowY: "auto",
  },
  mobileLibraryLauncher: {
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-card)",
    borderRadius: "18px",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    textAlign: "left",
    boxShadow: "0 16px 36px rgba(15,23,42,0.08)",
    cursor: "pointer",
  },
  mobileLibraryLauncherLabel: {
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.2,
    color: "var(--app-text)",
    minWidth: 0,
  },
  mobileLibraryLauncherMeta: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  mobileLibraryLauncherCount: {
    fontSize: "12px",
    color: "var(--app-text-muted)",
  },
  mobileLibraryLauncherIconWrap: {
    width: "34px",
    height: "34px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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
    inset: "max(env(safe-area-inset-top), 10px) 10px max(env(safe-area-inset-bottom), 10px) 10px",
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
