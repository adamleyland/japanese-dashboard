"use client";

import { useEffect, useRef, useState } from "react";
import AudiobookCurrentlyListening from "@/components/features/listening/audiobooks/AudiobookCurrentlyListening";
import AudiobookLibrary from "@/components/features/listening/audiobooks/AudiobookLibrary";
import AudiobookPlayer from "@/components/features/listening/audiobooks/AudiobookPlayer";
import { useAudiobookPlayer } from "@/hooks/useAudiobookPlayer";

export default function AudiobookWorkspace({
  authUserId,
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
  const playbackStateRef = useRef(null);

  const usingFetchedBooks = Array.isArray(audiobooksData) && audiobooksData.length > 0;

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
      {isPlayerOpen && currentBook ? (
        <AudiobookPlayer
          book={currentBook}
          currentProgressSeconds={currentProgressSeconds}
          durationSeconds={durationSeconds}
          hasPlayableAudio={hasPlayableAudio}
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
    </div>
  );
}

const styles = {
  shell: {
    display: "grid",
    gap: "18px",
  },
};
