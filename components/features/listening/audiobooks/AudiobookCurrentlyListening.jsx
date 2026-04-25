"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, List, Play, X } from "lucide-react";
import { clampWords, stripHtml } from "@/lib/stripHtml";

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

export default function AudiobookCurrentlyListening({
  book,
  isMobile = false,
  libraryCount = 0,
  onOpenLibrary,
  onOpenPlayer,
  onPlayNow,
}) {
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);

  if (!book) {
    return null;
  }

  const fullDescription = stripHtml(book.description);
  const plainDescription = clampWords(fullDescription, 50);
  const hasDescription = Boolean(fullDescription);
  const coverUrl = book.cover_url || FALLBACK_COVER_URL;
  const cardStyle = isMobile
    ? {
        ...styles.card,
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "start",
        gap: "14px",
        padding: "14px",
      }
    : styles.card;
  const coverStyle = isMobile
    ? {
        ...styles.cover(book.coverGradient),
        width: "min(100%, 164px)",
        aspectRatio: "1 / 1",
        borderRadius: "18px",
      }
    : styles.cover(book.coverGradient);
  const coverImageStyle = isMobile
    ? {
        ...styles.coverImage,
      }
    : styles.coverImage;
  const metaStyle = isMobile
    ? {
        ...styles.meta,
        gap: "10px",
        alignContent: "start",
      }
    : styles.meta;
  const titleStyle = isMobile
    ? {
        ...styles.title,
        fontSize: "18px",
        lineHeight: 1.15,
      }
    : styles.title;
  const authorStyle = isMobile
    ? {
        ...styles.author,
        fontSize: "12px",
        lineHeight: 1.3,
      }
    : styles.author;
  const descriptionStyle = isMobile
    ? {
        ...styles.description,
        fontSize: "12px",
        lineHeight: 1.55,
        WebkitLineClamp: 3,
      }
    : styles.description;
  const iconButtonStyle = isMobile
    ? {
        ...styles.iconButton,
        width: "42px",
        height: "42px",
        borderRadius: "12px",
      }
    : styles.iconButton;

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionEyebrow}>Currently Listening</div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={onOpenPlayer}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenPlayer?.();
          }
        }}
        style={styles.cardButton}
        aria-label={`Open player for ${book.title}`}
      >
        <div style={cardStyle}>
          <div
            style={
              isMobile
                ? {
                    ...styles.mobileCoverWrap,
                    gridColumn: "1 / -1",
                  }
                : undefined
            }
          >
            <div style={coverStyle}>
              {isMobile ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onPlayNow?.();
                  }}
                  style={styles.mobileArtworkButton}
                  aria-label={`Play ${book.title} and open player`}
                >
                  <img
                    key={`${book.id}-${coverUrl}`}
                    src={coverUrl}
                    alt=""
                    style={coverImageStyle}
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_COVER_URL;
                    }}
                  />
                </button>
              ) : (
                <img
                  key={`${book.id}-${coverUrl}`}
                  src={coverUrl}
                  alt=""
                  style={coverImageStyle}
                  onError={(event) => {
                    event.currentTarget.src = FALLBACK_COVER_URL;
                  }}
                />
              )}
            </div>
          </div>

          <div style={isMobile ? { ...metaStyle, minWidth: 0 } : metaStyle}>
            {isMobile ? (
              <>
                <div style={styles.mobileTitleWrap}>
                  <AutoScrollingTitle text={book.title} />
                </div>
                {book.author ? <div style={authorStyle}>{book.author}</div> : null}
              </>
            ) : (
              <>
                <div style={styles.metaTopRow}>
                  <div style={titleStyle}>{book.title}</div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onPlayNow?.();
                    }}
                    style={iconButtonStyle}
                    aria-label={`Play ${book.title}`}
                  >
                    <Play size={18} />
                  </button>
                </div>
                <div style={authorStyle}>{book.author}</div>
                <div style={descriptionStyle}>{plainDescription}</div>
              </>
            )}

            <div style={styles.progressMeta}>
              <span style={styles.progressLabel}>{book.progressPercent.toFixed(0)}% complete</span>
              <span style={styles.progressLabel}>
                {formatClock(book.progressSeconds)} / {formatClock(book.durationSeconds)}
              </span>
            </div>

            <div style={styles.progressTrack}>
              <div style={styles.progressFill(book.progressPercent, book.accentColor)} />
            </div>
          </div>

          {isMobile ? (
            <div style={styles.mobileActionRail}>
              {onOpenLibrary ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenLibrary?.();
                  }}
                  style={styles.mobileUtilityButton}
                  aria-label={`Open audiobook library${libraryCount ? ` with ${libraryCount} books` : ""}`}
                  title={`Open audiobook library${libraryCount ? ` (${libraryCount} books)` : ""}`}
                >
                  <List size={18} />
                </button>
              ) : null}
              {hasDescription ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsDescriptionOpen(true);
                  }}
                  style={styles.mobileUtilityButton}
                  aria-label={`About ${book.title}`}
                  title={`About ${book.title}`}
                >
                  <CircleHelp size={18} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {isMobile && isDescriptionOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              style={styles.descriptionModalOverlay}
              onClick={() => setIsDescriptionOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="currently-listening-description-title"
                style={styles.descriptionModal}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={styles.descriptionModalHeader}>
                  <div style={styles.descriptionModalHeaderCopy}>
                    <div style={styles.descriptionModalEyebrow}>Audiobook Description</div>
                    <h4
                      id="currently-listening-description-title"
                      style={styles.descriptionModalTitle}
                    >
                      {book.title}
                    </h4>
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
                  {book.author ? (
                    <div style={styles.descriptionModalAuthor}>{book.author}</div>
                  ) : null}
                  <p style={styles.descriptionModalText}>{fullDescription}</p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

function AutoScrollingTitle({ text }) {
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
      <div ref={viewportRef} style={styles.mobileTitleViewport}>
        <span ref={textRef} style={styles.mobileTitleStatic}>
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
        ...styles.mobileTitleViewport,
        "--audiobook-title-distance": `-${scrollDistance}px`,
        "--audiobook-title-duration": `${Math.max(8, Math.min(18, text.length * 0.38))}s`,
      }}
    >
      <div className="audiobook-title-marquee-track" style={styles.mobileTitleTrack}>
        <span ref={textRef} style={styles.mobileTitleText}>
          {text}
        </span>
        <span aria-hidden="true" style={styles.mobileTitleText}>
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

const styles = {
  section: {
    display: "grid",
    gap: "12px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  sectionEyebrow: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  sectionHint: {
    fontSize: "12px",
    color: "var(--app-text-faint)",
  },
  iconButton: {
    width: "40px",
    height: "40px",
    borderRadius: "14px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    flexShrink: 0,
    cursor: "pointer",
  },
  cardButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    display: "block",
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
  },
  card: {
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-card)",
    borderRadius: "20px",
    padding: "16px",
    display: "grid",
    gridTemplateColumns: "220px minmax(0, 1fr)",
    gap: "16px",
    textAlign: "left",
    boxShadow: "0 16px 36px rgba(15,23,42,0.08)",
  },
  mobileCoverWrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
  },
  cover: (coverGradient) => ({
    position: "relative",
    borderRadius: "18px",
    background: coverGradient,
    overflow: "hidden",
    width: "100%",
    aspectRatio: "1 / 1",
    boxShadow: "0 12px 28px rgba(15,23,42,0.12)",
  }),
  coverImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  mobileArtworkButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    width: "100%",
    height: "100%",
    cursor: "pointer",
    lineHeight: 0,
    display: "block",
  },
  meta: {
    display: "grid",
    gap: "10px",
    alignContent: "center",
    minWidth: 0,
  },
  mobileTitleWrap: {
    minWidth: 0,
  },
  mobileTitleViewport: {
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
    whiteSpace: "nowrap",
  },
  mobileTitleStatic: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "var(--app-text)",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
  },
  mobileTitleTrack: {
    display: "inline-flex",
    alignItems: "center",
    gap: "28px",
    minWidth: "max-content",
  },
  mobileTitleText: {
    color: "var(--app-text)",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  metaTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    color: "var(--app-text)",
    minWidth: 0,
    flex: 1,
  },
  author: {
    fontSize: "14px",
    color: "var(--app-text-soft)",
  },
  description: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "var(--app-text-muted)",
    display: "-webkit-box",
    WebkitLineClamp: 4,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
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
  mobileActionRail: {
    display: "grid",
    gap: "10px",
    alignContent: "start",
    justifyItems: "end",
  },
  mobileUtilityButton: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    cursor: "pointer",
    flexShrink: 0,
  },
  descriptionModalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10050,
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
  descriptionModalBody: {
    overflowY: "auto",
    paddingRight: "4px",
    display: "grid",
    gap: "12px",
  },
  descriptionModalAuthor: {
    fontSize: "13px",
    lineHeight: 1.4,
    color: "rgba(226, 232, 240, 0.78)",
  },
  descriptionModalText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.75,
    color: "rgba(248, 250, 252, 0.92)",
    whiteSpace: "pre-wrap",
  },
  progressMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
    fontSize: "12px",
    color: "var(--app-text-muted)",
  },
  progressLabel: {
    fontWeight: 700,
  },
  progressTrack: {
    height: "8px",
    borderRadius: "999px",
    background: "var(--app-progress-track)",
    border: "1px solid var(--app-border-soft)",
    overflow: "hidden",
  },
  progressFill: (progressPercent, accentColor) => ({
    width: `${progressPercent}%`,
    height: "100%",
    borderRadius: "inherit",
    background: accentColor,
  }),
};
