"use client";

import { useEffect } from "react";
import AudiobookCurrentlyListening from "@/components/features/listening/audiobooks/AudiobookCurrentlyListening";
import AudiobookLibrary from "@/components/features/listening/audiobooks/AudiobookLibrary";
import AudiobookPlayer from "@/components/features/listening/audiobooks/AudiobookPlayer";
import { useAudiobookPlayer } from "@/hooks/useAudiobookPlayer";

export default function AudiobookWorkspace({ onPlaybackStateChange }) {
  const {
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
  } = useAudiobookPlayer();

  const isBrowsing = playbackState === "idle" || !currentBook;

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
      {isBrowsing ? (
        <>
          <AudiobookCurrentlyListening
            book={currentlyListeningBook}
            onOpen={selectCurrentlyListening}
          />
          <AudiobookLibrary books={books} onSelect={loadBook} />
        </>
      ) : (
        <>
          <AudiobookPlayer
            book={currentBook}
            currentProgressSeconds={currentProgressSeconds}
            durationSeconds={durationSeconds}
            playbackState={playbackState}
            progressPercent={progressPercent}
            onReturnToLibrary={returnToLibrary}
            onSeekTo={seekTo}
            onSkipBy={skipBy}
            onTogglePlayback={togglePlayback}
          />

          <AudiobookLibrary
            books={books.filter((book) => book.id !== currentBook.id)}
            onSelect={loadBook}
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
