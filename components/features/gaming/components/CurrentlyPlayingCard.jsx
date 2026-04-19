"use client";

import { Clock3, Gamepad2, Sparkles } from "lucide-react";
import LaunchGameButton from "@/components/features/gaming/components/LaunchGameButton";
import {
  formatPlaytimeCompact,
  formatPlaytimeDetailed,
  formatRelativeLastPlayed,
  getSourceLabel,
} from "@/lib/gaming/gaming-utils";

export default function CurrentlyPlayingCard({ styles, currentGame, loading }) {
  if (!currentGame && !loading) {
    return (
      <div style={styles.sideCard}>
        <div style={styles.wordCardHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={styles.progressContainer}>
              <div
                style={{
                  ...styles.dictionaryIconFootprint,
                  background: "rgba(139, 92, 246, 0.16)",
                  border: "1px solid rgba(139, 92, 246, 0.18)",
                }}
              >
                <Gamepad2 size={14} color="#8b5cf6" strokeWidth={2.5} />
              </div>
            </div>
            <div style={{ display: "grid", gap: "3px" }}>
              <div style={styles.eyebrow}>Currently Playing</div>
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: "18px",
            border: "1px dashed var(--app-border-soft)",
            background: "var(--app-surface-soft)",
            padding: "18px",
            color: "var(--app-text-muted)",
            fontSize: "13px",
            textAlign: "center",
          }}
        >
          Connect Steam or Xbox to surface your latest game here.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.sideCard}>
      <div
        style={{
          ...styles.wordCardHeader,
          marginBottom: "8px",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div style={styles.progressContainer}>
            <div
              style={{
                ...styles.dictionaryIconFootprint,
                background: "rgba(139, 92, 246, 0.16)",
                border: "1px solid rgba(139, 92, 246, 0.18)",
              }}
            >
              <Sparkles size={14} color="#8b5cf6" strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
            <div style={styles.eyebrow}>Currently Playing</div>
            <div style={{ fontSize: "12px", color: "var(--app-text-muted)" }}>
              Freshest session across connected sources
            </div>
          </div>
        </div>

        {currentGame ? <LaunchGameButton game={currentGame} label="Play now" /> : null}
      </div>

      {loading && !currentGame ? (
        <div style={{ ...styles.playerSub, padding: "8px 0" }}>Loading your latest games...</div>
      ) : null}

      {currentGame ? (
        <div style={{ display: "grid", gap: "14px" }}>
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: "18px",
              overflow: "hidden",
              background:
                "linear-gradient(135deg, rgba(76,29,149,0.18), rgba(15,23,42,0.08))",
              border: "1px solid var(--app-border-soft)",
            }}
          >
            {currentGame.artworkUrl ? (
              <img
                src={currentGame.artworkUrl}
                alt={currentGame.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--app-text-muted)",
                  fontWeight: 700,
                }}
              >
                {currentGame.title}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "22px", letterSpacing: "-0.03em" }}>
              {currentGame.title}
            </h3>
            <p style={{ ...styles.playerSub, margin: 0 }}>
              {getSourceLabel(currentGame.source)} | {currentGame.platform}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "10px",
            }}
          >
            <StatCard
              label="Total"
              value={formatPlaytimeCompact(currentGame.minutesPlayedTotal)}
            />
            <StatCard
              label="Recent"
              value={formatPlaytimeDetailed(currentGame.minutesPlayedRecent)}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--app-text-muted)",
              fontSize: "12px",
            }}
          >
            <Clock3 size={14} />
            <span>{formatRelativeLastPlayed(currentGame.lastPlayedAt)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div
      style={{
        borderRadius: "16px",
        border: "1px solid var(--app-border-soft)",
        background: "var(--app-surface-elevated)",
        padding: "12px",
        display: "grid",
        gap: "4px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--app-text-muted)",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}
