"use client";

import { Gamepad2, Play, Sparkles } from "lucide-react";
import GameArtworkImage from "@/components/features/gaming/components/GameArtworkImage";
import { openGameLauncher } from "@/lib/gaming/launchers";
import {
  formatLastPlayedDate,
  formatPlaytimeCompact,
  getDeviceLabel,
  getSourceLabel,
  supportsTrackedPlaytime,
} from "@/lib/gaming/gaming-utils";

export default function CurrentlyPlayingCard({ styles, currentGame, loading, isMobile = false }) {
  const canShowTrackedPlaytime = supportsTrackedPlaytime(currentGame);
  const cardStyle = {
    ...styles.sideCard,
    border: isMobile ? "var(--gaming-mobile-top-card-border)" : styles.sideCard.border,
    boxShadow: isMobile ? "var(--gaming-mobile-top-card-shadow)" : styles.sideCard.boxShadow,
  };

  if (!currentGame && !loading) {
    return (
      <div style={cardStyle}>
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
    <div style={cardStyle}>
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
              
            </div>
          </div>

      </div>

      {loading && !currentGame ? (
        <div style={{ ...styles.playerSub, padding: "8px 0" }}>Loading your latest games...</div>
      ) : null}

      {currentGame ? (
        <div style={{ display: "grid", gap: "14px" }}>
          <div
            role={currentGame.launchUrl ? "button" : undefined}
            tabIndex={currentGame.launchUrl ? 0 : -1}
            aria-label={currentGame.launchUrl ? `Launch ${currentGame.title}` : currentGame.title}
            onClick={() => {
              if (currentGame.launchUrl) {
                openGameLauncher(currentGame);
              }
            }}
            onKeyDown={(event) => {
              if (!currentGame.launchUrl) {
                return;
              }

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openGameLauncher(currentGame);
              }
            }}
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: "18px",
              overflow: "hidden",
              background:
                "linear-gradient(135deg, rgba(76,29,149,0.18), rgba(15,23,42,0.08))",
              border: "1px solid var(--app-border-soft)",
              position: "relative",
              cursor: currentGame.launchUrl ? "pointer" : "default",
              outline: "none",
            }}
          >
            <GameArtworkImage
              key={`${currentGame.source}:${currentGame.sourceGameId}`}
              game={currentGame}
              alt={currentGame.title}
              imageStyle={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              placeholder={
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
              }
            />

            {currentGame.launchUrl ? (
              <div
                style={{
                  position: "absolute",
                  left: "12px",
                  bottom: "12px",
                  width: "32px",
                  height: "32px",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.16)",
                  color: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  boxShadow: "0 10px 20px rgba(15,23,42,0.18)",
                  pointerEvents: "none",
                }}
              >
                <Play size={13} fill="currentColor" />
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "22px", letterSpacing: "-0.03em" }}>
              {currentGame.title}
            </h3>
            <p style={{ ...styles.playerSub, margin: 0 }}>
              {getSourceLabel(currentGame.source)} | {getDeviceLabel(currentGame)}
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
              value={
                canShowTrackedPlaytime
                  ? formatPlaytimeCompact(currentGame.minutesPlayedTotal)
                  : "Activity only"
              }
            />
            <StatCard
              label="Last played"
              value={formatLastPlayedDate(currentGame.lastPlayedAt)}
            />
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
