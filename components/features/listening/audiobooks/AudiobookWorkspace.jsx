"use client";

import { useEffect, useState } from "react";
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
    progressPercent,
    savingProgress,
    seekTo,
    selectCurrentlyListening,
    skipBy,
    togglePlayback,
  } = useAudiobookPlayer(audiobooksData, authUserId);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  const usingFetchedBooks = Array.isArray(audiobooksData) && audiobooksData.length > 0;

  useEffect(() => {
    onPlaybackStateChange?.({
      isPlaying: playbackState === "playing",
      playbackState,
      book: currentBook,
      progressSeconds: currentProgressSeconds,
      durationSeconds,
    });
  }, [
    currentBook,
    currentProgressSeconds,
    durationSeconds,
    onPlaybackStateChange,
    playbackState,
  ]);

  useEffect(
    () => () => {
      onPlaybackStateChange?.({
        isPlaying: false,
        playbackState: "idle",
        book: null,
        progressSeconds: 0,
        durationSeconds: 0,
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
            onPlay={() => {
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
