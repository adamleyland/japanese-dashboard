"use client";

import { Gamepad2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import GameArtworkImage from "@/components/features/gaming/components/GameArtworkImage";
import { useGameArtwork } from "@/hooks/useGameArtwork";
import { useAchievements } from "@/hooks/useAchievements";
import {
  formatBritishOrdinalDate,
  formatLastPlayedDate,
  formatPlaytimeCompact,
  getDeviceLabel,
  getSourceLabel,
  supportsTrackedPlaytime,
} from "@/lib/gaming/gaming-utils";

export default function CurrentlyPlayingCard({
  styles,
  currentGame,
  loading,
  isMobile = false,
  onOpenDetails,
}) {
  const artwork = useGameArtwork(currentGame);
  const { load: loadAchievements, game: achievementGame } = useAchievements(currentGame);
  const loadedAchievementGameRef = useRef("");
  const achievementGameKey = currentGame ? `${currentGame.source}:${currentGame.sourceGameId}` : "";
  useEffect(() => {
    if (!achievementGameKey || loadedAchievementGameRef.current === achievementGameKey) return;
    loadedAchievementGameRef.current = achievementGameKey;
    loadAchievements();
  }, [achievementGameKey, loadAchievements]);
  const recentAchievements = useMemo(() => (achievementGame?.achievements || []).filter((achievement) => achievement.unlocked && achievement.unlocked_at).sort((a, b) => new Date(b.unlocked_at) - new Date(a.unlocked_at)).slice(0, isMobile ? 2 : 3), [achievementGame, isMobile]);
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
            role={onOpenDetails ? "button" : undefined}
            tabIndex={onOpenDetails ? 0 : -1}
            aria-label={onOpenDetails ? `Open details for ${currentGame.title}` : currentGame.title}
            onClick={() => onOpenDetails?.(currentGame)}
            onKeyDown={(event) => {
              if (!onOpenDetails) {
                return;
              }

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenDetails(currentGame);
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
              cursor: onOpenDetails ? "pointer" : "default",
              outline: "none",
            }}
          >
            {artwork.heroArtworkUrl ? <img src={artwork.heroArtworkUrl} alt={currentGame.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <GameArtworkImage
              key={`${currentGame.source}:${currentGame.sourceGameId}`}
              game={currentGame}
              alt={currentGame.title}
              imageStyle={{ width: "100%", height: "100%", objectFit: "cover" }}
              placeholder={<div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--app-text-muted)", fontWeight:700 }}>{currentGame.title}</div>}
            />}

            <div style={{ position:"absolute", inset:"38% 0 0", background:"linear-gradient(0deg, rgba(2,6,23,.9), rgba(2,6,23,.04))", pointerEvents:"none" }}/>
            <div style={{ position:"absolute", left:"16px", right:"16px", bottom:"14px", zIndex:2 }}>
              {artwork.logoArtworkUrl ? <img src={artwork.logoArtworkUrl} alt={currentGame.title} style={{ display:"block", width:"min(320px,90%)", maxHeight:"72px", objectFit:"contain", objectPosition:"left bottom", filter:"drop-shadow(0 3px 10px rgba(0,0,0,.65))" }}/> : <h3 style={{ margin:0, color:"#fff", fontSize:"24px", lineHeight:1.05, letterSpacing:"-.035em", textShadow:"0 3px 12px rgba(0,0,0,.65)" }}>{currentGame.title}</h3>}
            </div>

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

          {recentAchievements.length ? (
            <div style={{ display: "grid", gap: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--app-text-muted)" }}>Recent achievements</div>
              <div style={{ display: "grid", gap: "7px" }}>
                {recentAchievements.map((achievement) => (
                  <div key={achievement.id} style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) auto", gap: "9px", alignItems: "center", padding: "7px 8px", borderRadius: "11px", border: "1px solid var(--app-border-soft)" }}>
                    <img src={achievement.icon_url || "/window.svg"} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover" }}/>
                    <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
                      <strong style={{ fontSize: "12px", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{achievement.name}</strong>
                      <span style={{ fontSize: "10.5px", lineHeight: 1.25, color: "var(--app-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{/^hidden achievement\.?$/i.test(achievement.description?.trim() || "") ? "Secret achievement unlocked." : achievement.description || "Achievement unlocked"}</span>
                    </div>
                    <span style={{ fontSize: "10px", color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>{formatBritishOrdinalDate(achievement.unlocked_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
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
