"use client";

import { Fragment } from "react";

export default function FuriganaText({ children, style }) {
  const value = String(children || "");
  const parts = [];
  const furiganaPattern = /([\u3400-\u9fff\u3005\u3006\u30f6]+)\[([^\]]+)\]/g;
  let cursor = 0;
  let match;

  while ((match = furiganaPattern.exec(value)) !== null) {
    if (match.index > cursor) {
      parts.push(value.slice(cursor, match.index));
    }

    parts.push(
      <ruby key={`${match.index}-${match[1]}`} style={furiganaStyles.ruby}>
        {match[1]}
        <rp>(</rp>
        <rt style={furiganaStyles.reading}>{match[2]}</rt>
        <rp>)</rp>
      </ruby>,
    );
    cursor = furiganaPattern.lastIndex;
  }

  if (cursor < value.length) {
    parts.push(value.slice(cursor));
  }

  return (
    <span lang="ja" style={style}>
      {parts.map((part, index) => (
        <Fragment key={typeof part === "string" ? `${index}-${part}` : index}>{part}</Fragment>
      ))}
    </span>
  );
}

const furiganaStyles = {
  ruby: {
    rubyPosition: "over",
    rubyAlign: "center",
  },
  reading: {
    fontSize: "0.58em",
    fontWeight: 600,
    color: "var(--app-text-muted)",
    letterSpacing: "0.02em",
  },
};
