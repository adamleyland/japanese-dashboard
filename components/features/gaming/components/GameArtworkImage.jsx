"use client";

import { useMemo, useState } from "react";
import { getArtworkCandidates } from "@/lib/gaming/gaming-utils";

export default function GameArtworkImage({
  game,
  alt,
  imageStyle,
  placeholder,
  variant = "default",
}) {
  const candidates = useMemo(
    () => getArtworkCandidates(game, { variant }),
    [game, variant],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  const activeSrc = candidates[candidateIndex] || null;

  if (!activeSrc) {
    return placeholder;
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      style={imageStyle}
      onError={() => {
        setCandidateIndex((currentIndex) =>
          currentIndex + 1 <= candidates.length ? currentIndex + 1 : currentIndex,
        );
      }}
    />
  );
}
