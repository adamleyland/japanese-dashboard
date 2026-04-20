"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { BookOpenText } from "lucide-react";

export default function ReadingCoverArtwork({
  item,
  width = 72,
  aspectRatio = "2 / 3",
  borderRadius = 16,
}) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidates = item?.coverCandidates || [];
  const activeSource = candidates[candidateIndex] || item?.coverUrl || null;

  if (!activeSource) {
    return (
      <ReadingCoverPlaceholder
        item={item}
        width={width}
        aspectRatio={aspectRatio}
        borderRadius={borderRadius}
      />
    );
  }

  return (
    <img
      src={activeSource}
      alt={item?.title || "Book cover"}
      style={{
        width: `${width}px`,
        aspectRatio,
        borderRadius: `${borderRadius}px`,
        objectFit: "cover",
        background: "var(--app-surface-soft)",
        border: "1px solid var(--app-border-soft)",
        flexShrink: 0,
      }}
      onError={() => {
        setCandidateIndex((currentValue) =>
          currentValue + 1 <= candidates.length ? currentValue + 1 : currentValue,
        );
      }}
    />
  );
}

function ReadingCoverPlaceholder({ item, width, aspectRatio, borderRadius }) {
  return (
    <div
      style={{
        width: `${width}px`,
        aspectRatio,
        borderRadius: `${borderRadius}px`,
        border: "1px dashed var(--app-border-soft)",
        background:
          "linear-gradient(145deg, rgba(59,130,246,0.12), rgba(15,23,42,0.05))",
        display: "grid",
        placeItems: "center",
        color: "#3b82f6",
        flexShrink: 0,
        overflow: "hidden",
      }}
      aria-label={`Missing cover art for ${item?.title || "book"}`}
      title={item?.title || "Book"}
    >
      <div
        style={{
          display: "grid",
          gap: "8px",
          justifyItems: "center",
          padding: "8px",
          textAlign: "center",
        }}
      >
        <BookOpenText size={18} strokeWidth={2.3} />
        <span
          style={{
            fontSize: "10px",
            lineHeight: 1.3,
            color: "var(--app-text-soft)",
            fontWeight: 700,
          }}
        >
          No cover
        </span>
      </div>
    </div>
  );
}
