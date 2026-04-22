"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
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
    books,
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
  const hasMounted = useSyncExternalStore(
    subscribeToMountState,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );
  const playbackStateRef = useRef(null);

  const usingFetchedBooks = Array.isArray(audiobooksData) && audiobooksData.length > 0;
  const showMobilePlayerOverlay = Boolean(isMobile && isPlayerOpen && currentBook && hasMounted);

  useEffect(() => {
    if (!showMobilePlayerOverlay || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showMobilePlayerOverlay]);

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
          book={currentBook}
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
                book={currentBook}
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
