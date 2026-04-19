"use client";

import { ExternalLink, PlayCircle } from "lucide-react";
import {
  canLaunchGame,
  getLaunchAriaLabel,
  openGameLauncher,
} from "@/lib/gaming/launchers";

export default function LaunchGameButton({ game, compact = false, label = "Launch" }) {
  const launchSupported = canLaunchGame(game);

  return (
    <button
      type="button"
      disabled={!launchSupported}
      onClick={() => openGameLauncher(game)}
      aria-label={getLaunchAriaLabel(game)}
      style={{
        border: launchSupported
          ? "1px solid rgba(59,130,246,0.18)"
          : "1px solid var(--app-border-soft)",
        background: launchSupported ? "rgba(59,130,246,0.1)" : "var(--app-surface-soft)",
        color: launchSupported ? "#5579d9" : "var(--app-text-muted)",
        borderRadius: compact ? "10px" : "12px",
        padding: compact ? "7px 10px" : "9px 12px",
        fontSize: compact ? "11px" : "12px",
        fontWeight: 700,
        cursor: launchSupported ? "pointer" : "not-allowed",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        opacity: launchSupported ? 1 : 0.7,
        whiteSpace: "nowrap",
      }}
    >
      {compact ? <ExternalLink size={12} /> : <PlayCircle size={13} />}
      {label}
    </button>
  );
}
