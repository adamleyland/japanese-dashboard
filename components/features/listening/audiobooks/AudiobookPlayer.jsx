"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  List,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { stripHtml } from "@/lib/stripHtml";

const FALLBACK_COVER_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#334155"/>
        </linearGradient>
      </defs>
      <rect width="320" height="400" fill="url(#g)"/>
      <circle cx="160" cy="144" r="54" fill="rgba(255,255,255,0.14)"/>
      <rect x="88" y="232" width="144" height="14" rx="7" fill="rgba(255,255,255,0.2)"/>
      <rect x="110" y="260" width="100" height="12" rx="6" fill="rgba(255,255,255,0.14)"/>
    </svg>
  `);

export default function AudiobookPlayer({
  activeChapterIndex = -1,
  book,
  chapters = [],
  currentProgressSeconds,
  durationSeconds,
  hasPlayableAudio,
  isMobile = false,
  desktopVariant = "default",
  isPlaying,
  playbackState,
  progressPercent,
  onClosePlayer,
  onMinimizePlayer,
  onSeekTo,
  onSkipBy,
  onTogglePlayback,
  savingProgress = false,
}) {
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [isMobileChapterPickerOpen, setIsMobileChapterPickerOpen] = useState(false);

  if (!book) {
    return null;
  }

  const playing = isPlaying ?? playbackState === "playing";
  const chapterCount = Array.isArray(chapters) ? chapters.length : 0;
  const shouldRenderChapters = chapterCount > 0;
  const activeChapter =
    shouldRenderChapters && activeChapterIndex >= 0 ? chapters[activeChapterIndex] : null;
  const nextChapter =
    activeChapterIndex >= 0 && activeChapterIndex < chapterCount - 1
      ? chapters[activeChapterIndex + 1]
      : null;
  const fullDescription = stripHtml(book.description);
  const hasDescription = Boolean(fullDescription);
  const coverUrl = book.coverImage || book.cover_url || FALLBACK_COVER_URL;
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
    : 0;
  const timelineMax = Math.max(0, activeChapterDuration || durationSeconds);
  const timelineValue = Math.max(0, Math.min(timelineMax, activeChapterProgressSeconds));
  const metadataLine = buildMetadataLine(book, durationSeconds);
  const isDesktopModal = !isMobile && desktopVariant === "modal";
  const shellStyle = isMobile
    ? {
        ...styles.shell,
        gap: "22px",
        padding: "max(16px, env(safe-area-inset-top, 0px)) 30px calc(28px + env(safe-area-inset-bottom, 0px))",
        borderRadius: 0,
        background: "#ffffff",
        width: "100%",
        maxWidth: "100%",
        minHeight: "100dvh",
        alignContent: "start",
        boxSizing: "border-box",
      }
    : isDesktopModal
      ? {
          ...styles.shell,
          ...styles.desktopModalShell,
        }
    : styles.shell;
  const playerHeaderStyle = isMobile
    ? {
        ...styles.playerHeader,
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "nowrap",
      }
    : isDesktopModal
      ? {
          ...styles.playerHeader,
          ...styles.desktopModalHeader,
        }
    : styles.playerHeader;
  const headerActionsStyle = isDesktopModal
    ? {
        ...styles.headerActions,
        ...styles.desktopModalHeaderActions,
      }
    : {
        ...styles.headerActions,
        alignSelf: "flex-start",
        marginLeft: isMobile ? 0 : "auto",
      };
  const titleStyle = isMobile
    ? {
        ...styles.title,
        fontSize: "20px",
        lineHeight: 1.15,
      }
    : isDesktopModal
      ? {
          ...styles.title,
          ...styles.desktopModalTitle,
        }
    : styles.title;
  const metaStyle = isMobile
    ? {
        ...styles.meta,
        fontSize: "12px",
        lineHeight: 1.5,
      }
    : isDesktopModal
      ? {
          ...styles.meta,
          ...styles.desktopModalMeta,
        }
    : styles.meta;
  const iconButtonStyle = isMobile
    ? {
        ...styles.iconButton(false),
        width: "42px",
        height: "42px",
        borderRadius: "12px",
      }
    : isDesktopModal
      ? {
          ...styles.iconButton(false),
        ...styles.desktopModalIconButton,
        }
    : styles.iconButton(false);
  const plainDesktopIconButtonStyle = styles.desktopModalPlainIconButton(false);
  const desktopChapterTriggerButtonStyle = styles.desktopModalPlainIconButton(!shouldRenderChapters);
  const playerGridStyle = isMobile
    ? {
        ...styles.playerGrid,
        gridTemplateColumns: "1fr",
        gap: "22px",
      }
    : isDesktopModal
      ? {
          ...styles.playerGrid,
          ...styles.desktopModalPlayerGrid,
        }
    : styles.playerGrid;
  const coverWrapStyle = isDesktopModal
    ? {
        ...styles.coverWrap,
        ...styles.desktopModalCoverWrap,
      }
    : styles.coverWrap;
  const coverStyle = isDesktopModal
    ? {
        ...styles.cover(book.coverGradient),
        ...styles.desktopModalCover,
      }
    : styles.cover(book.coverGradient);
  const controlsColumnStyle = isMobile
    ? {
        ...styles.controlsColumn,
        gap: "14px",
      }
    : isDesktopModal
      ? {
          ...styles.controlsColumn,
          ...styles.desktopModalControlsColumn,
        }
    : styles.controlsColumn;
  const infoBlockStyle = isMobile
    ? undefined
    : isDesktopModal
      ? {
          ...styles.infoBlock,
          ...styles.desktopModalInfoBlock,
        }
    : styles.infoBlock;
  const timelineWrapStyle = isMobile
    ? {
        ...styles.timelineWrap,
        padding: "0",
        border: "none",
        background: "transparent",
        gap: "8px",
      }
    : isDesktopModal
      ? {
          ...styles.timelineWrap,
          ...styles.desktopModalTimelineWrap,
        }
    : styles.timelineWrap;
  const actionRowStyle = isMobile
    ? {
        ...styles.actionRow,
        gap: "14px",
        flexWrap: "nowrap",
        justifyContent: "space-between",
      }
    : isDesktopModal
      ? {
          ...styles.actionRow,
          ...styles.desktopModalActionRow,
        }
    : styles.actionRow;
  const primaryButtonStyle = isMobile
    ? styles.mobilePrimaryControlButton(!hasPlayableAudio)
    : isDesktopModal
      ? styles.desktopModalPrimaryButton(!hasPlayableAudio)
    : styles.primaryButton(!hasPlayableAudio);
  const jumpControlButtonStyle = isMobile
    ? styles.mobileInlineControlButton(!hasPlayableAudio)
    : isDesktopModal
      ? styles.desktopModalSecondaryControlButton(!hasPlayableAudio)
    : {
        ...styles.secondaryIconControlButton(!hasPlayableAudio, false),
        flex: "1 1 0",
        width: "auto",
        minWidth: 0,
        padding: "0 16px",
      };
  const chapterBlockStyle = isMobile
    ? {
        ...styles.chapterBlock,
        padding: "12px",
      }
    : isDesktopModal
      ? {
          ...styles.chapterBlock,
          ...styles.desktopModalChapterBlock,
        }
    : styles.chapterBlock;
  const chapterListStyle = isMobile
    ? {
        ...styles.chapterList,
        maxHeight: "min(220px, 32svh)",
      }
    : isDesktopModal
      ? {
          ...styles.chapterList,
          ...styles.desktopModalChapterList,
        }
    : styles.chapterList;
  const progressSummaryStyle = isDesktopModal
    ? {
        ...styles.progressSummary,
        ...styles.desktopModalProgressSummary,
      }
    : styles.progressSummary;
  const progressBadgeStyle = isDesktopModal
    ? {
        ...styles.progressBadge,
        ...styles.desktopModalProgressBadge,
      }
    : styles.progressBadge;
  const progressRemainingStyle = isDesktopModal
    ? {
        ...styles.progressRemaining,
        ...styles.desktopModalProgressRemaining,
      }
    : styles.progressRemaining;
  const descriptionButtonStyle = isDesktopModal
    ? {
        ...styles.descriptionPillButton,
        ...styles.desktopModalDescriptionPillButton,
      }
    : styles.descriptionPillButton;
  const overallProgressBarStyle = isDesktopModal
    ? {
        ...styles.overallProgressBar,
        ...styles.desktopModalOverallProgressBar,
      }
    : styles.overallProgressBar;
  const timelineStyle = isMobile
    ? { ...styles.timeline, ...styles.mobileTimeline }
    : isDesktopModal
      ? {
          ...styles.timeline,
          ...styles.desktopModalTimeline,
        }
      : styles.timeline;
  const timelineMetaStyle = isMobile
    ? styles.mobileTimelineMeta
    : isDesktopModal
      ? {
          ...styles.timelineMeta,
          ...styles.desktopModalTimelineMeta,
        }
      : styles.timelineMeta;
  const audioHintStyle = isDesktopModal
    ? {
        ...styles.audioHint,
        ...styles.desktopModalAudioHint,
      }
    : styles.audioHint;
  const mobileChapterButtonLabel = activeChapter?.title || "Browse chapters";
  const previousChapter =
    activeChapterIndex > 0 && activeChapterIndex < chapterCount ? chapters[activeChapterIndex - 1] : null;
  const nextChapterForSkip =
    activeChapterIndex >= 0 && activeChapterIndex < chapterCount - 1
      ? chapters[activeChapterIndex + 1]
      : null;
  const canSkipToPreviousChapter = Boolean(previousChapter);
  const canSkipToNextChapter = Boolean(nextChapterForSkip);

  const handleSkipToPreviousChapter = () => {
    if (!previousChapter) {
      return;
    }

    onSeekTo(previousChapter.startSeconds);
  };

  const handleSkipToNextChapter = () => {
    if (!nextChapterForSkip) {
      return;
    }

    onSeekTo(nextChapterForSkip.startSeconds);
  };

  return (
    <section style={shellStyle}>
      <div style={playerHeaderStyle}>
        {isMobile ? (
          <>
            {onMinimizePlayer ? (
              <button
                type="button"
                onClick={onMinimizePlayer}
                style={iconButtonStyle}
                aria-label="Minimize player"
                title="Minimize player"
              >
                <ChevronDown size={18} />
              </button>
            ) : (
              <div style={styles.mobileHeaderSpacer} />
            )}
          </>
        ) : isDesktopModal ? (
          <button
            type="button"
            onClick={onClosePlayer}
            style={plainDesktopIconButtonStyle}
            aria-label="Close player"
            title="Close player"
          >
            <X size={22} />
          </button>
        ) : (
          <div style={styles.headerLabelWrap}>
            <div
              style={
                isDesktopModal
                  ? {
                      ...styles.eyebrow,
                      ...styles.desktopModalEyebrow,
                    }
                  : styles.eyebrow
              }
            >
              Audiobook Player
            </div>
          </div>
        )}

        <div style={headerActionsStyle}>
          <div style={styles.mobileHeaderActionGroup}>
            {isDesktopModal && shouldRenderChapters ? (
              <button
                type="button"
                onClick={() => setIsMobileChapterPickerOpen(true)}
                disabled={!shouldRenderChapters}
                style={desktopChapterTriggerButtonStyle}
                aria-label="Open chapter list"
                title="Open chapter list"
              >
                <List size={20} />
              </button>
            ) : null}
            {(isMobile || isDesktopModal) && hasDescription ? (
              <button
                type="button"
                onClick={() => setIsDescriptionOpen(true)}
                style={isDesktopModal ? plainDesktopIconButtonStyle : iconButtonStyle}
                aria-label="About this book"
                title="About this book"
              >
                <CircleHelp size={isDesktopModal ? 20 : 18} />
              </button>
            ) : null}
            {isDesktopModal ? null : (
              <button type="button" onClick={onClosePlayer} style={iconButtonStyle} aria-label="Close player">
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={playerGridStyle}>
        {isMobile ? (
          <div style={styles.mobileHeroSection}>
            <div style={styles.mobileCoverCard}>
              <img
                key={`${book.id}-${coverUrl}`}
                src={coverUrl}
                alt={`Cover artwork for ${book.title}`}
                style={styles.mobileCoverImage}
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_COVER_URL;
                }}
              />
              <div style={styles.mobileCoverFade} aria-hidden="true" />
            </div>
            <div style={styles.mobileArtworkTitlePill}>
              <AutoScrollingPlayerTitle text={book.title} />
            </div>
          </div>
        ) : (
          <div style={coverWrapStyle}>
            <div style={coverStyle}>
              <img
                key={`${book.id}-${coverUrl}`}
                src={coverUrl}
                alt={`Cover artwork for ${book.title}`}
                style={styles.coverImage}
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_COVER_URL;
                }}
              />
            </div>
          </div>
        )}

        <div style={controlsColumnStyle}>
          {!isMobile ? (
            <div style={infoBlockStyle}>
              <h3 style={titleStyle}>{book.title}</h3>
              {isDesktopModal ? (
                activeChapter ? (
                  <div style={styles.desktopModalNowPlayingMeta}>
                    <span style={styles.desktopModalNowPlayingLabel}>Chapter</span>
                    <span style={styles.desktopModalNowPlayingValue}>{activeChapter.title}</span>
                  </div>
                ) : null
              ) : (
                <p style={metaStyle}>{buildMetadataLine(book, durationSeconds)}</p>
              )}
              {!isDesktopModal && hasDescription ? (
                <button
                  type="button"
                  onClick={() => setIsDescriptionOpen(true)}
                  style={descriptionButtonStyle}
                >
                  Read description
                </button>
              ) : null}
            </div>
          ) : null}

          <div style={overallProgressBarStyle} aria-label={`Overall book progress ${progressPercent.toFixed(0)}%`}>
            <div style={styles.overallProgressFill(progressPercent, book.accentColor)} />
          </div>

          {!isMobile ? (
            <div style={progressSummaryStyle}>
              <span style={progressBadgeStyle}>{progressPercent.toFixed(0)}% complete</span>
              <span style={progressRemainingStyle}>
                {formatClock(currentProgressSeconds)} / {formatClock(durationSeconds)}
                {savingProgress ? " · Saving progress" : ""}
              </span>
            </div>
          ) : null}

          <div style={timelineWrapStyle}>
            <input
              type="range"
              min={0}
              max={timelineMax}
              value={timelineValue}
              onChange={(event) =>
                onSeekTo(
                  activeChapter
                    ? activeChapterStart + Number(event.target.value)
                    : Number(event.target.value),
                )
              }
              disabled={!hasPlayableAudio}
              style={timelineStyle}
              className={isMobile ? "audiobook-mobile-timeline" : undefined}
            />

            <div style={timelineMetaStyle}>
              <span>{formatClock(timelineValue)}</span>
              {!isMobile ? <span>{activeChapterProgressPercent.toFixed(1)}%</span> : null}
              <span>{formatClock(timelineMax)}</span>
            </div>

            {!hasPlayableAudio && (
              <div style={audioHintStyle}>Audio source unavailable for this audiobook.</div>
            )}
          </div>

          {isMobile ? (
            <div style={actionRowStyle}>
              <button
                type="button"
                onClick={handleSkipToPreviousChapter}
                disabled={!hasPlayableAudio || !canSkipToPreviousChapter}
                style={styles.mobileInlineControlButton(!hasPlayableAudio || !canSkipToPreviousChapter)}
                aria-label="Go to previous chapter"
                title="Go to previous chapter"
              >
                <SkipBack size={18} />
              </button>

              <button
                type="button"
                onClick={() => onSkipBy(-10)}
                disabled={!hasPlayableAudio}
                style={jumpControlButtonStyle}
                aria-label="Skip back 10 seconds"
                title="Skip back 10 seconds"
              >
                <RotateCcw size={18} />
              </button>

              <button
                type="button"
                onClick={onTogglePlayback}
                disabled={!hasPlayableAudio}
                style={primaryButtonStyle}
                aria-label={playing ? "Pause audiobook" : "Play audiobook"}
                title={playing ? "Pause audiobook" : "Play audiobook"}
              >
                {playing ? <FilledPauseIcon size={45} /> : <FilledPlayIcon size={45} />}
              </button>

              <button
                type="button"
                onClick={() => onSkipBy(10)}
                disabled={!hasPlayableAudio}
                style={jumpControlButtonStyle}
                aria-label="Skip forward 10 seconds"
                title="Skip forward 10 seconds"
              >
                <RotateCw size={18} />
              </button>

              <button
                type="button"
                onClick={handleSkipToNextChapter}
                disabled={!hasPlayableAudio || !canSkipToNextChapter}
                style={styles.mobileInlineControlButton(!hasPlayableAudio || !canSkipToNextChapter)}
                aria-label="Go to next chapter"
                title="Go to next chapter"
              >
                <SkipForward size={18} />
              </button>
            </div>
          ) : (
            <div style={isDesktopModal ? styles.desktopModalControlsStack : styles.controlsStack}>
              <div style={actionRowStyle}>
                {isDesktopModal ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSkipToPreviousChapter}
                      disabled={!hasPlayableAudio || !canSkipToPreviousChapter}
                      style={styles.desktopModalControlIconButton(!hasPlayableAudio || !canSkipToPreviousChapter)}
                      aria-label="Go to previous chapter"
                      title="Go to previous chapter"
                    >
                      <SkipBack size={22} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSkipBy(-10)}
                      disabled={!hasPlayableAudio}
                      style={styles.desktopModalControlIconButton(!hasPlayableAudio)}
                      aria-label="Skip back 10 seconds"
                      title="Skip back 10 seconds"
                    >
                      <RotateCcw size={22} />
                    </button>
                    <button
                      type="button"
                      onClick={onTogglePlayback}
                      disabled={!hasPlayableAudio}
                      style={primaryButtonStyle}
                      aria-label={playing ? "Pause audiobook" : "Play audiobook"}
                      title={playing ? "Pause audiobook" : "Play audiobook"}
                    >
                      {playing ? <FilledPauseIcon size={35} /> : <FilledPlayIcon size={35} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSkipBy(10)}
                      disabled={!hasPlayableAudio}
                      style={styles.desktopModalControlIconButton(!hasPlayableAudio)}
                      aria-label="Skip forward 10 seconds"
                      title="Skip forward 10 seconds"
                    >
                      <RotateCw size={22} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipToNextChapter}
                      disabled={!hasPlayableAudio || !canSkipToNextChapter}
                      style={styles.desktopModalControlIconButton(!hasPlayableAudio || !canSkipToNextChapter)}
                      aria-label="Go to next chapter"
                      title="Go to next chapter"
                    >
                      <SkipForward size={22} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSkipBy(-10)}
                      disabled={!hasPlayableAudio}
                      style={jumpControlButtonStyle}
                      aria-label="Skip back 10 seconds"
                      title="Skip back 10 seconds"
                    >
                      <RotateCcw size={16} />
                      -10 sec
                    </button>

                    <button
                      type="button"
                      onClick={onTogglePlayback}
                      disabled={!hasPlayableAudio}
                      style={primaryButtonStyle}
                      aria-label={playing ? "Pause audiobook" : "Play audiobook"}
                      title={playing ? "Pause audiobook" : "Play audiobook"}
                    >
                      {playing ? <Pause size={18} /> : <Play size={18} />}
                      {playing ? "Pause" : "Play"}
                    </button>

                    <button
                      type="button"
                      onClick={() => onSkipBy(10)}
                      disabled={!hasPlayableAudio}
                      style={jumpControlButtonStyle}
                      aria-label="Skip forward 10 seconds"
                      title="Skip forward 10 seconds"
                    >
                      <RotateCw size={16} />
                      +10 sec
                    </button>
                  </>
                )}
              </div>

              {isDesktopModal ? null : (
                <div style={styles.chapterActionRow(false)}>
                  <button
                    type="button"
                    onClick={handleSkipToPreviousChapter}
                    disabled={!hasPlayableAudio || !canSkipToPreviousChapter}
                    style={
                      isDesktopModal
                        ? {
                            ...styles.chapterNavButton(!hasPlayableAudio || !canSkipToPreviousChapter, false),
                            ...styles.desktopModalChapterNavButton(!hasPlayableAudio || !canSkipToPreviousChapter),
                          }
                        : styles.chapterNavButton(!hasPlayableAudio || !canSkipToPreviousChapter, false)
                    }
                    aria-label="Go to previous chapter"
                    title="Go to previous chapter"
                  >
                    <SkipBack size={16} />
                    Previous chapter
                  </button>

                  <button
                    type="button"
                    onClick={handleSkipToNextChapter}
                    disabled={!hasPlayableAudio || !canSkipToNextChapter}
                    style={
                      isDesktopModal
                        ? {
                            ...styles.chapterNavButton(!hasPlayableAudio || !canSkipToNextChapter, false),
                            ...styles.desktopModalChapterNavButton(!hasPlayableAudio || !canSkipToNextChapter),
                          }
                        : styles.chapterNavButton(!hasPlayableAudio || !canSkipToNextChapter, false)
                    }
                    aria-label="Go to next chapter"
                    title="Go to next chapter"
                  >
                    Next chapter
                    <SkipForward size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {isMobile ? (
            <button
              type="button"
              onClick={() => {
                if (shouldRenderChapters) {
                  setIsMobileChapterPickerOpen(true);
                }
              }}
              disabled={!shouldRenderChapters}
              style={styles.mobileChapterLauncher(!shouldRenderChapters)}
            >
              <div style={styles.mobileChapterLauncherMain}>
                <div style={styles.mobileChapterLauncherTopRow}>
                  <span style={styles.chapterEyebrow}>Chapters</span>
                  <span style={styles.chapterCount}>
                    {shouldRenderChapters ? `${chapterCount} items` : "Unavailable"}
                  </span>
                </div>
                <div style={styles.mobileChapterLauncherBottomRow}>
                  <MobileChapterLauncherTitle text={mobileChapterButtonLabel} />
                  <span style={styles.mobileChapterLauncherIconWrap}>
                    <List size={18} />
                  </span>
                </div>
              </div>
            </button>
          ) : isDesktopModal ? null : (
            <div style={chapterBlockStyle}>
              <div style={styles.chapterHeader}>
                <div style={styles.chapterEyebrow}>Chapters</div>
                <div style={styles.chapterCount}>
                  {shouldRenderChapters ? `${chapterCount} items` : "Unavailable"}
                </div>
              </div>

              {shouldRenderChapters ? (
                <div style={chapterListStyle}>
                  {chapters.map((chapter, index) => {
                    const isActiveChapter = index === activeChapterIndex;

                    return (
                      <button
                        key={chapter.id}
                        type="button"
                        onClick={() => onSeekTo(chapter.startSeconds)}
                        style={
                          isDesktopModal
                            ? {
                                ...styles.chapterButton(isActiveChapter),
                                ...styles.desktopModalChapterButton(isActiveChapter),
                              }
                            : styles.chapterButton(isActiveChapter)
                        }
                      >
                        <span style={styles.chapterTitle}>{chapter.title}</span>
                        <span
                          style={
                            isDesktopModal
                              ? {
                                  ...styles.chapterTime(isActiveChapter),
                                  ...styles.desktopModalChapterTime(isActiveChapter),
                                }
                              : styles.chapterTime(isActiveChapter)
                          }
                        >
                          {formatClock(chapter.startSeconds)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={
                    isDesktopModal
                      ? {
                          ...styles.chapterEmptyState,
                          ...styles.desktopModalChapterEmptyState,
                        }
                      : styles.chapterEmptyState
                  }
                >
                  Chapter markers are not available in the player yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {(isMobile || isDesktopModal) && isMobileChapterPickerOpen ? (
          <motion.div
            style={isDesktopModal ? styles.desktopChapterOverlay : styles.mobileChapterOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => setIsMobileChapterPickerOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={isDesktopModal ? "audiobook-desktop-chapters-title" : "audiobook-mobile-chapters-title"}
              style={isDesktopModal ? styles.desktopChapterSheet : styles.mobileChapterSheet}
              initial={isDesktopModal ? { y: 16, opacity: 0, scale: 0.98 } : { y: "100%" }}
              animate={isDesktopModal ? { y: 0, opacity: 1, scale: 1 } : { y: 0 }}
              exit={isDesktopModal ? { y: 16, opacity: 0, scale: 0.98 } : { y: "100%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <div style={isDesktopModal ? styles.desktopChapterSheetHeader : styles.mobileChapterSheetHeader}>
                <div style={isDesktopModal ? styles.desktopChapterSheetHeaderCopy : styles.mobileChapterSheetHeaderCopy}>
                  <div style={isDesktopModal ? styles.desktopChapterSheetEyebrow : styles.mobileChapterSheetEyebrow}>Chapter Selector</div>
                  <h4
                    id={isDesktopModal ? "audiobook-desktop-chapters-title" : "audiobook-mobile-chapters-title"}
                    style={isDesktopModal ? styles.desktopChapterSheetTitle : styles.mobileChapterSheetTitle}
                  >
                    {book.title}
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMobileChapterPickerOpen(false)}
                  style={isDesktopModal ? styles.desktopChapterCloseButton : styles.mobileChapterCloseButton}
                  aria-label="Close chapter list"
                >
                  <X size={18} />
                </button>
              </div>

              <div style={isDesktopModal ? styles.desktopChapterSheetMeta : styles.mobileChapterSheetMeta}>
                <span>{shouldRenderChapters ? `${chapterCount} chapters` : "No chapters"}</span>
                {activeChapter ? <span>Current: {activeChapter.title}</span> : null}
              </div>

              {shouldRenderChapters ? (
                <div style={isDesktopModal ? styles.desktopChapterSheetList : styles.mobileChapterSheetList}>
                  {chapters.map((chapter, index) => {
                    const isActiveChapter = index === activeChapterIndex;

                    return (
                      <button
                        key={chapter.id}
                        type="button"
                        onClick={() => {
                          onSeekTo(chapter.startSeconds);
                          setIsMobileChapterPickerOpen(false);
                        }}
                        style={isDesktopModal ? styles.desktopChapterSheetButton(isActiveChapter) : styles.mobileChapterSheetButton(isActiveChapter)}
                      >
                        <span style={styles.mobileChapterSheetTitleText}>{chapter.title}</span>
                        <span style={isDesktopModal ? styles.desktopChapterSheetTime(isActiveChapter) : styles.mobileChapterSheetTime(isActiveChapter)}>
                          {formatClock(chapter.startSeconds)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={isDesktopModal ? styles.desktopChapterEmptyState : styles.mobileChapterEmptyState}>
                  Chapter markers are not available in the player yet.
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isDescriptionOpen ? (
        <div style={styles.descriptionModalOverlay} onClick={() => setIsDescriptionOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="audiobook-description-title"
            style={styles.descriptionModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={styles.descriptionModalHeader}>
              <div style={styles.descriptionModalHeaderCopy}>
                <div style={styles.descriptionModalEyebrow}>Audiobook Description</div>
                <h4 id="audiobook-description-title" style={styles.descriptionModalTitle}>
                  {book.title}
                </h4>
                {book.author ? <p style={styles.descriptionModalMeta}>{book.author}</p> : null}
              </div>

              <button
                type="button"
                onClick={() => setIsDescriptionOpen(false)}
                style={styles.descriptionModalCloseButton}
                aria-label="Close description"
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.descriptionModalBody}>
              <p style={styles.descriptionModalText}>{fullDescription}</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FilledPlayIcon({ size = 45 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l10.5-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function FilledPauseIcon({ size = 45 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <rect x="6" y="5" width="4.5" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" />
    </svg>
  );
}

function AutoScrollingPlayerTitle({ text }) {
  const viewportRef = useRef(null);
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    const viewportNode = viewportRef.current;
    const textNode = textRef.current;

    if (!viewportNode || !textNode) {
      return undefined;
    }

    const updateOverflow = () => {
      const nextDistance = Math.ceil(textNode.scrollWidth);
      const nextOverflow = nextDistance - viewportNode.clientWidth > 6;
      setIsOverflowing(nextOverflow);
      setScrollDistance(nextOverflow ? nextDistance + 28 : 0);
    };

    updateOverflow();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateOverflow);
      return () => window.removeEventListener("resize", updateOverflow);
    }

    const resizeObserver = new ResizeObserver(() => {
      updateOverflow();
    });

    resizeObserver.observe(viewportNode);
    resizeObserver.observe(textNode);

    return () => resizeObserver.disconnect();
  }, [text]);

  if (!isOverflowing) {
    return (
      <div ref={viewportRef} style={styles.mobileArtworkTitleViewport}>
        <span ref={textRef} style={styles.mobileArtworkTitleStatic}>
          {text}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="audiobook-title-marquee"
      style={{
        ...styles.mobileArtworkTitleViewport,
        "--audiobook-title-distance": `-${scrollDistance}px`,
        "--audiobook-title-duration": `${Math.max(8, Math.min(18, text.length * 0.38))}s`,
      }}
    >
      <div className="audiobook-title-marquee-track" style={styles.mobileArtworkTitleTrack}>
        <span ref={textRef} style={styles.mobileArtworkTitleText}>
          {text}
        </span>
        <span aria-hidden="true" style={styles.mobileArtworkTitleText}>
          {text}
        </span>
      </div>
    </div>
  );
}

function MobileChapterLauncherTitle({ text }) {
  const viewportRef = useRef(null);
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    const viewportNode = viewportRef.current;
    const textNode = textRef.current;

    if (!viewportNode || !textNode) {
      return undefined;
    }

    const updateOverflow = () => {
      const nextDistance = Math.ceil(textNode.scrollWidth);
      const nextOverflow = nextDistance - viewportNode.clientWidth > 6;
      setIsOverflowing(nextOverflow);
      setScrollDistance(nextOverflow ? nextDistance + 24 : 0);
    };

    updateOverflow();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateOverflow);
      return () => window.removeEventListener("resize", updateOverflow);
    }

    const resizeObserver = new ResizeObserver(() => {
      updateOverflow();
    });

    resizeObserver.observe(viewportNode);
    resizeObserver.observe(textNode);

    return () => resizeObserver.disconnect();
  }, [text]);

  if (!isOverflowing) {
    return (
      <div ref={viewportRef} style={styles.mobileChapterLauncherViewport}>
        <span ref={textRef} style={styles.mobileChapterLauncherStatic}>
          {text}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="audiobook-title-marquee"
      style={{
        ...styles.mobileChapterLauncherViewport,
        "--audiobook-title-distance": `-${scrollDistance}px`,
        "--audiobook-title-duration": `${Math.max(8, Math.min(18, text.length * 0.34))}s`,
      }}
    >
      <div className="audiobook-title-marquee-track" style={styles.mobileChapterLauncherTrack}>
        <span ref={textRef} style={styles.mobileChapterLauncherText}>
          {text}
        </span>
        <span aria-hidden="true" style={styles.mobileChapterLauncherText}>
          {text}
        </span>
      </div>
    </div>
  );
}

function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (!hours) {
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
}

function formatDurationCompact(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (!hours) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function buildMetadataLine(book, durationSeconds) {
  return [
    book.author,
    book.narrator ? `Narrated by ${book.narrator}` : "",
    durationSeconds ? formatDurationCompact(durationSeconds) : "",
  ]
    .filter(Boolean)
    .join(" • ");
}

const styles = {
  shell: {
    display: "grid",
    gap: "20px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-card)",
    borderRadius: "22px",
    padding: "20px",
    boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
  },
  desktopModalShell: {
    gap: "24px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(15,23,42,0.92) 100%)",
    borderRadius: "30px",
    padding: "28px 28px 70px 28px",
    boxShadow: "0 32px 90px rgba(2, 6, 23, 0.42)",
    color: "#f8fafc",
  },
  playerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    flexWrap: "wrap",
  },
  desktopModalHeader: {
    alignItems: "center",
    gap: "16px",
    justifyContent: "space-between",
  },
  headerCopy: {
    minWidth: 0,
    display: "grid",
    gap: "8px",
    flex: "1 1 320px",
  },
  headerLabelWrap: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  mobileHeaderSpacer: {
    width: "40px",
    height: "40px",
    flexShrink: 0,
  },
  mobileHeaderActionGroup: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  desktopModalEyebrow: {
    color: "rgba(226,232,240,0.68)",
  },
  title: {
    margin: 0,
    fontSize: "26px",
    fontWeight: 700,
    lineHeight: 1.08,
    letterSpacing: "-0.04em",
    color: "var(--app-text)",
  },
  desktopModalTitle: {
    fontSize: "32px",
    lineHeight: 1.02,
    color: "#f8fafc",
  },
  meta: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.5,
    color: "var(--app-text-soft)",
  },
  desktopModalMeta: {
    color: "rgba(226,232,240,0.74)",
  },
  descriptionPillButton: {
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    borderRadius: "999px",
    padding: "8px 14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.1,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
  },
  desktopModalDescriptionPillButton: {
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.06)",
    color: "#f8fafc",
    boxShadow: "none",
  },
  headerActions: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  desktopModalHeaderActions: {
    marginLeft: "auto",
    alignSelf: "center",
  },
  iconButton: (disabled) => ({
    width: "40px",
    height: "40px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    borderRadius: "14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    flexShrink: 0,
  }),
  desktopModalIconButton: {
    border: "none",
    background: "transparent",
    color: "#f8fafc",
    boxShadow: "none",
    width: "38px",
    height: "38px",
    borderRadius: "999px",
  },
  desktopModalPlainIconButton: (disabled) => ({
    border: "none",
    background: "transparent",
    color: "#f8fafc",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "38px",
    height: "38px",
    padding: 0,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.38 : 0.92,
    flexShrink: 0,
  }),
  playerGrid: {
    display: "grid",
    gridTemplateColumns: "244px minmax(0, 1fr)",
    gap: "28px",
  },
  desktopModalPlayerGrid: {
    gridTemplateColumns: "minmax(250px, 300px) minmax(320px, 420px)",
    gap: "85px",
    alignItems: "start",
    justifyContent: "center",
  },
  mobileCoverCard: {
    width: "min(100%, 268px)",
    aspectRatio: "1 / 1",
    margin: "0 auto",
    borderRadius: "24px",
    overflow: "hidden",
    background: "var(--app-surface)",
    boxShadow: "0 18px 46px rgba(15,23,42,0.14)",
    lineHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    zIndex: 1,
  },
  mobileHeroSection: {
    position: "relative",
    display: "grid",
    gap: "12px",
    paddingTop: "30px",
    paddingBottom: "25px",
  },
  mobileCoverFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "25%",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(15,23,42,0.06) 100%)",
    pointerEvents: "none",
  },
  mobileArtworkTitlePill: {
    width: "min(100%, 268px)",
    minWidth: 0,
    margin: "0 auto",
    borderRadius: "999px",
    border: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(255,255,255,0.78)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    padding: "10px 14px",
    position: "relative",
    zIndex: 1,
  },
  mobileArtworkTitleViewport: {
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
    whiteSpace: "nowrap",
  },
  mobileArtworkTitleStatic: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "var(--app-text)",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.01em",
  },
  mobileArtworkTitleTrack: {
    display: "inline-flex",
    alignItems: "center",
    gap: "28px",
    minWidth: "max-content",
  },
  mobileArtworkTitleText: {
    color: "var(--app-text)",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  mobileCoverImage: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
    objectPosition: "center",
  },
  coverWrap: {
    width: "244px",
  },
  desktopModalCoverWrap: {
    width: "100%",
    maxWidth: "300px",
    padding: "6px",
    boxSizing: "border-box",
  },
  cover: (coverGradient) => ({
    position: "relative",
    borderRadius: "20px",
    background: coverGradient,
    overflow: "hidden",
    aspectRatio: "1 / 1",
    boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
  }),
  desktopModalCover: {
    borderRadius: "28px",
    border: "none",
    boxShadow: "0 24px 60px rgba(2, 6, 23, 0.28)",
  },
  coverImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  controlsColumn: {
    display: "grid",
    gap: "18px",
    alignContent: "start",
  },
  desktopModalControlsColumn: {
    gap: "18px",
    width: "100%",
    maxWidth: "420px",
    justifySelf: "start",
  },
  overallProgressBar: {
    height: "6px",
    borderRadius: "999px",
    background: "var(--app-progress-track)",
    border: "1px solid var(--app-border-soft)",
    overflow: "hidden",
  },
  desktopModalOverallProgressBar: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  overallProgressFill: (progressPercent, accentColor) => ({
    width: `${Math.max(0, Math.min(100, progressPercent || 0))}%`,
    height: "100%",
    borderRadius: "inherit",
    background: accentColor || "#38bdf8",
  }),
  infoBlock: {
    display: "grid",
    gap: "10px",
    alignContent: "start",
    paddingTop: "2px",
  },
  desktopModalInfoBlock: {
    gap: "12px",
    paddingTop: 0,
  },
  descriptionModalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10001,
    background: "rgba(248, 250, 252, 0.56)",
    backdropFilter: "blur(22px) saturate(1.05)",
    WebkitBackdropFilter: "blur(22px) saturate(1.05)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 16px calc(20px + env(safe-area-inset-bottom, 0px))",
  },
  descriptionModal: {
    width: "min(100%, 460px)",
    maxHeight: "min(78svh, 640px)",
    display: "grid",
    gap: "14px",
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(15,23,42,0.92) 100%)",
    borderRadius: "24px",
    padding: "18px",
    boxShadow: "0 28px 80px rgba(2, 6, 23, 0.34)",
    color: "#f8fafc",
  },
  descriptionModalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
  },
  descriptionModalHeaderCopy: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  descriptionModalEyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "rgba(226, 232, 240, 0.72)",
  },
  descriptionModalTitle: {
    margin: 0,
    fontSize: "22px",
    lineHeight: 1.16,
    letterSpacing: "-0.03em",
    color: "#f8fafc",
  },
  descriptionModalCloseButton: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.06)",
    color: "#f8fafc",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  descriptionModalMeta: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.5,
    color: "rgba(226, 232, 240, 0.78)",
  },
  descriptionModalBody: {
    overflowY: "auto",
    paddingRight: "4px",
  },
  descriptionModalText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.75,
    color: "rgba(248, 250, 252, 0.92)",
    whiteSpace: "pre-wrap",
  },
  timelineWrap: {
    display: "grid",
    gap: "12px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-soft)",
    borderRadius: "18px",
    padding: "16px 18px",
  },
  desktopModalTimelineWrap: {
    border: "none",
    background: "transparent",
    padding: 0,
    gap: "8px",
  },
  progressSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  progressBadge: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--app-text)",
  },
  desktopModalProgressSummary: {
    color: "rgba(226,232,240,0.82)",
  },
  desktopModalProgressBadge: {
    color: "#f8fafc",
  },
  progressRemaining: {
    fontSize: "12px",
    color: "var(--app-text-muted)",
  },
  desktopModalProgressRemaining: {
    color: "rgba(226,232,240,0.68)",
  },
  timeline: {
    width: "100%",
    cursor: "pointer",
  },
  mobileTimeline: {
    accentColor: "#050505",
  },
  audioHint: {
    fontSize: "12px",
    color: "var(--app-text-faint)",
  },
  desktopModalAudioHint: {
    color: "rgba(226,232,240,0.62)",
  },
  timelineMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    fontSize: "12px",
    color: "var(--app-text-muted)",
  },
  desktopModalTimeline: {
    accentColor: "#f8fafc",
  },
  desktopModalTimelineMeta: {
    color: "rgba(226,232,240,0.68)",
  },
  mobileTimelineMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    fontSize: "12px",
    color: "var(--app-text-muted)",
    fontVariantNumeric: "tabular-nums",
  },
  actionRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "nowrap",
  },
  desktopModalActionRow: {
    justifyContent: "center",
    gap: "28px",
  },
  controlsStack: {
    display: "grid",
    gap: "12px",
  },
  desktopModalControlsStack: {
    display: "grid",
    gap: "14px",
  },
  primaryButton: (disabled) => ({
    border: "1px solid var(--app-border)",
    background: "var(--app-selected-surface)",
    color: "var(--app-selected-text)",
    borderRadius: "14px",
    padding: "12px 22px",
    minWidth: "156px",
    justifyContent: "center",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontSize: "13px",
    fontWeight: 700,
  }),
  desktopModalPrimaryButton: (disabled) => ({
    background: "#f8fafc",
    color: "#0f172a",
    borderRadius: "999px",
    border: "none",
    padding: 0,
    width: "84px",
    height: "84px",
    minWidth: 0,
    justifyContent: "center",
    display: "inline-flex",
    alignItems: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    boxShadow: "0 14px 30px rgba(2, 6, 23, 0.22)",
  }),
  mobilePrimaryControlButton: (disabled) => ({
    border: "none",
    background: "#050505",
    color: "#ffffff",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    width: "74px",
    height: "74px",
    padding: 0,
    flexShrink: 0,
    boxShadow: "0 16px 34px rgba(15,23,42,0.22)",
  }),
  mobileInlineControlButton: (disabled) => ({
    border: "none",
    background: "transparent",
    color: "var(--app-text-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    width: "32px",
    height: "32px",
    padding: 0,
    flexShrink: 0,
  }),
  secondaryIconControlButton: (disabled, mobile) => ({
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    borderRadius: mobile ? "16px" : "14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    width: mobile ? "56px" : "48px",
    height: mobile ? "48px" : "48px",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    flexShrink: 0,
    fontSize: "12px",
    fontWeight: 700,
  }),
  desktopModalSecondaryControlButton: (disabled) => ({
    border: "none",
    background: "transparent",
    color: "#f8fafc",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    width: "38px",
    height: "38px",
    padding: 0,
    boxShadow: "none",
    flexShrink: 0,
  }),
  desktopModalControlIconButton: (disabled) => ({
    border: "none",
    background: "transparent",
    color: "#f8fafc",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "38px",
    height: "38px",
    padding: 0,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.35 : 0.92,
    flexShrink: 0,
  }),
  chapterActionRow: (mobile) => ({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: mobile ? "10px" : "12px",
  }),
  chapterNavButton: (disabled, mobile) => ({
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    borderRadius: mobile ? "16px" : "14px",
    minHeight: mobile ? "46px" : "44px",
    padding: mobile ? "0 14px" : "0 16px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontSize: "12px",
    fontWeight: 700,
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    width: "100%",
  }),
  desktopModalChapterNavButton: (disabled) => ({
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.06)",
    color: "#f8fafc",
    boxShadow: "none",
    opacity: disabled ? 0.5 : 1,
  }),
  chapterBlock: {
    display: "grid",
    gap: "12px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-soft)",
    borderRadius: "18px",
    padding: "16px 18px",
  },
  desktopModalChapterBlock: {
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
  },
  desktopModalChapterList: {
    maxHeight: "260px",
  },
  chapterHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  chapterEyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  chapterCount: {
    fontSize: "11px",
    color: "var(--app-text-faint)",
  },
  mobileChapterLauncher: (disabled) => ({
    marginTop: "25px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-soft)",
    borderRadius: "18px",
    padding: "16px",
    display: "block",
    textAlign: "left",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  }),
  mobileChapterLauncherMain: {
    display: "grid",
    gap: "8px",
    minWidth: 0,
  },
  mobileChapterLauncherTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    minWidth: 0,
  },
  mobileChapterLauncherBottomRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    minWidth: 0,
  },
  mobileChapterLauncherViewport: {
    minWidth: 0,
    flex: "1 1 auto",
    overflow: "hidden",
    whiteSpace: "nowrap",
  },
  mobileChapterLauncherStatic: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.25,
    color: "var(--app-text)",
  },
  mobileChapterLauncherTrack: {
    display: "inline-flex",
    alignItems: "center",
    gap: "24px",
    minWidth: "max-content",
  },
  mobileChapterLauncherText: {
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.25,
    color: "var(--app-text)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  mobileChapterLauncherIconWrap: {
    width: "36px",
    height: "36px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileChapterOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10002,
    background: "rgba(248, 250, 252, 0.56)",
    backdropFilter: "blur(22px) saturate(1.05)",
    WebkitBackdropFilter: "blur(22px) saturate(1.05)",
  },
  mobileChapterSheet: {
    position: "absolute",
    left: "16px",
    right: "16px",
    bottom: "max(16px, env(safe-area-inset-bottom, 0px))",
    maxHeight: "min(76svh, 640px)",
    display: "grid",
    gridTemplateRows: "auto auto minmax(0, 1fr)",
    gap: "14px",
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(15,23,42,0.92) 100%)",
    borderRadius: "24px",
    padding: "18px",
    boxShadow: "0 28px 80px rgba(2, 6, 23, 0.34)",
    color: "#f8fafc",
  },
  mobileChapterSheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  mobileChapterSheetHeaderCopy: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  mobileChapterSheetEyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "rgba(226, 232, 240, 0.72)",
  },
  mobileChapterSheetTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
    color: "#f8fafc",
  },
  mobileChapterCloseButton: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.06)",
    color: "#f8fafc",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  mobileChapterSheetMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    fontSize: "12px",
    color: "rgba(226, 232, 240, 0.78)",
  },
  mobileChapterSheetList: {
    display: "grid",
    gap: "10px",
    overflowY: "auto",
    paddingRight: "4px",
  },
  mobileChapterSheetButton: (active) => ({
    border: active
      ? "1px solid rgba(255,255,255,0.18)"
      : "1px solid rgba(255,255,255,0.08)",
    background: active
      ? "rgba(255,255,255,0.12)"
      : "rgba(255,255,255,0.04)",
    color: "#f8fafc",
    borderRadius: "12px",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
    textAlign: "left",
    transition: "background 160ms ease, border-color 160ms ease, color 160ms ease",
  }),
  mobileChapterSheetTitleText: {
    minWidth: 0,
    flex: "1 1 auto",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    lineHeight: 1.35,
  },
  mobileChapterSheetTime: (active) => ({
    color: active ? "rgba(248, 250, 252, 0.92)" : "rgba(226, 232, 240, 0.72)",
    flexShrink: 0,
    paddingTop: "1px",
  }),
  mobileChapterEmptyState: {
    border: "1px dashed rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(226, 232, 240, 0.78)",
    borderRadius: "14px",
    padding: "14px 12px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  chapterList: {
    display: "grid",
    gap: "8px",
    maxHeight: "240px",
    overflowY: "auto",
    paddingRight: "4px",
  },
  chapterEmptyState: {
    border: "1px dashed var(--app-border-soft)",
    background: "rgba(255, 255, 255, 0.58)",
    color: "var(--app-text-muted)",
    borderRadius: "14px",
    padding: "14px 12px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  desktopModalChapterEmptyState: {
    border: "1px dashed rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(226,232,240,0.68)",
  },
  chapterButton: (active) => ({
    border: active ? "1px solid var(--app-selected-border)" : "1px solid var(--app-border-soft)",
    background: active ? "var(--app-selected-surface)" : "var(--app-surface)",
    color: active ? "var(--app-selected-text)" : "var(--app-text)",
    borderRadius: "12px",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
    textAlign: "left",
    transition: "background 160ms ease, border-color 160ms ease, color 160ms ease",
  }),
  desktopModalChapterButton: (active) => ({
    border: active ? "1px solid rgba(248,250,252,0.9)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "#f8fafc" : "rgba(255,255,255,0.04)",
    color: active ? "#0f172a" : "#f8fafc",
  }),
  chapterTitle: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  chapterTime: (active) => ({
    color: active ? "rgba(248, 250, 252, 0.82)" : "var(--app-text-muted)",
    flexShrink: 0,
  }),
  desktopModalChapterTime: (active) => ({
    color: active ? "rgba(15,23,42,0.72)" : "rgba(226,232,240,0.64)",
  }),
  desktopModalNowPlayingMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "8px",
    textAlign: "left",
    color: "rgba(226,232,240,0.68)",
    flexWrap: "nowrap",
    minWidth: 0,
  },
  desktopModalNowPlayingLabel: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    flexShrink: 0,
  },
  desktopModalNowPlayingValue: {
    fontSize: "13px",
    lineHeight: 1.4,
    color: "#f8fafc",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  desktopChapterOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10002,
    background: "rgba(2, 6, 23, 0.22)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  },
  desktopChapterSheet: {
    width: "min(100%, 520px)",
    maxHeight: "min(70vh, 620px)",
    display: "grid",
    gridTemplateRows: "auto auto minmax(0, 1fr)",
    gap: "14px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.94) 100%)",
    borderRadius: "24px",
    padding: "20px",
    boxShadow: "0 30px 80px rgba(2, 6, 23, 0.4)",
    color: "#f8fafc",
  },
  desktopChapterSheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
  },
  desktopChapterSheetHeaderCopy: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  desktopChapterSheetEyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "rgba(226, 232, 240, 0.68)",
  },
  desktopChapterSheetTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: "-0.03em",
    color: "#f8fafc",
  },
  desktopChapterCloseButton: {
    border: "none",
    background: "transparent",
    color: "#f8fafc",
    width: "38px",
    height: "38px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
  },
  desktopChapterSheetMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    fontSize: "12px",
    color: "rgba(226, 232, 240, 0.74)",
  },
  desktopChapterSheetList: {
    display: "grid",
    gap: "10px",
    overflowY: "auto",
    paddingRight: "4px",
  },
  desktopChapterSheetButton: (active) => ({
    border: active ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
    color: "#f8fafc",
    borderRadius: "14px",
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
    textAlign: "left",
    transition: "background 160ms ease, border-color 160ms ease, color 160ms ease",
  }),
  desktopChapterSheetTime: (active) => ({
    color: active ? "rgba(248, 250, 252, 0.92)" : "rgba(226, 232, 240, 0.72)",
    flexShrink: 0,
    paddingTop: "1px",
  }),
  desktopChapterEmptyState: {
    border: "1px dashed rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(226, 232, 240, 0.78)",
    borderRadius: "14px",
    padding: "14px 12px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
};
