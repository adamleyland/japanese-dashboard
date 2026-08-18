"use client";

import { useState } from "react";
import { ToggleLeft, ToggleRight, Trophy } from "lucide-react";
import GameArtworkImage from "@/components/features/gaming/components/GameArtworkImage";
import {
  getDeviceLabel,
  formatPlaytimeHours,
  formatRelativeLastPlayed,
  getSourceLabel,
  supportsTrackedPlaytime,
} from "@/lib/gaming/gaming-utils";

export default function GamingLibraryListView({
  styles,
  games,
  isCompact,
  onToggleInclude,
  achievementSummaries,
  onOpenAchievements,
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "10px",
      }}
    >
      {games.map((game) => (
        <div
          key={`${game.source}:${game.sourceGameId}`}
          style={{
            borderRadius: "18px",
            border:
              game.includeInOverallTotal === false
                ? "1px solid rgba(148,163,184,0.32)"
                : "1px solid var(--app-border-soft)",
            background:
              game.includeInOverallTotal === false
                ? "rgba(148,163,184,0.08)"
                : "var(--app-card)",
            padding: "12px",
            display: "grid",
            gap: "12px",
          }}
        >
          {isCompact ? (
            <CompactRow styles={styles} game={game} onToggleInclude={onToggleInclude} achievementSummary={achievementSummaries[`${game.source}:${game.sourceGameId}`]} onOpenAchievements={onOpenAchievements} />
          ) : (
            <DesktopRow styles={styles} game={game} onToggleInclude={onToggleInclude} achievementSummary={achievementSummaries[`${game.source}:${game.sourceGameId}`]} onOpenAchievements={onOpenAchievements} />
          )}
        </div>
      ))}
    </div>
  );
}

function DesktopRow({ styles, game, onToggleInclude, achievementSummary, onOpenAchievements }) {
  const canShowTrackedHours = supportsTrackedPlaytime(game);
  const playtimeLabel = canShowTrackedHours ? formatPlaytimeHours(game.minutesPlayedTotal) : "0h";

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "140px minmax(0, 1fr) auto",
          gap: "14px",
          alignItems: "start",
        }}
      >
        <ArtworkCell game={game} compact={false} onOpenAchievements={onOpenAchievements} />

        <div style={{ minWidth: 0, display: "grid", gap: "8px", paddingTop: "2px" }}>
          <div
            style={{
              fontSize: "15px",
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
            }}
          >
            {game.title}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <IncludeToggleButton game={game} onClick={() => onToggleInclude(game)} />
            {game.source !== "local" ? <MetaBadge label={getDeviceLabel(game)} tone="neutral" /> : null}
            <MetaBadge label={getSourceLabel(game.source)} tone={game.source} />
            <AchievementButton summary={achievementSummary} onClick={() => onOpenAchievements(game)} />
          </div>

          <div style={{ ...styles.playerSub, margin: 0 }}>
            {formatRelativeLastPlayed(game.lastPlayedAt)}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            justifyItems: "end",
            gap: "8px",
            minWidth: "110px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0",
            }}
          >
            <div
              style={{
                fontSize: "24px",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                color: "var(--app-text)",
              }}
            >
              {playtimeLabel}
            </div>
          </div>
          <div style={{ fontSize: "11px", color: "var(--app-text-muted)", fontWeight: 700 }}>
            Tracked hours
          </div>
        </div>
      </div>
    </>
  );
}

function CompactRow({ styles, game, onToggleInclude, achievementSummary, onOpenAchievements }) {
  const canShowTrackedHours = supportsTrackedPlaytime(game);
  const playtimeLabel = canShowTrackedHours ? formatPlaytimeHours(game.minutesPlayedTotal) : "0h";

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "96px minmax(0, 1fr)",
          gap: "16px",
          alignItems: "start",
        }}
      >
        <ArtworkCell game={game} compact onOpenAchievements={onOpenAchievements} />

        <div style={{ minWidth: 0, display: "grid", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div
              style={{
                minWidth: 0,
                fontSize: "14px",
                fontWeight: 800,
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
              }}
            >
              {game.title}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0",
                marginLeft: "auto",
              }}
            >
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: "-0.03em",
                  whiteSpace: "nowrap",
                  color: "var(--app-text)",
                }}
              >
                {playtimeLabel}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <IncludeToggleButton game={game} onClick={() => onToggleInclude(game)} />
            {game.source !== "local" ? <MetaBadge label={getDeviceLabel(game)} tone="neutral" /> : null}
            <MetaBadge label={getSourceLabel(game.source)} tone={game.source} />
            <AchievementButton summary={achievementSummary} onClick={() => onOpenAchievements(game)} />
          </div>

          <div style={{ ...styles.playerSub, margin: 0 }}>
            {formatRelativeLastPlayed(game.lastPlayedAt)}
          </div>
        </div>
      </div>

    </>
  );
}

function AchievementButton({ summary, onClick }) {
  return <button type="button" onClick={onClick} title="View achievements" style={{ border:"1px solid rgba(202,138,4,.24)", borderRadius:"999px", background:"rgba(202,138,4,.1)", color:"#a16207", padding:"4px 8px", fontSize:"10px", fontWeight:800, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:"5px" }}><Trophy size={12}/>{summary ? `${summary.unlocked}/${summary.total}` : "Achievements"}</button>;
}

function ArtworkCell({ game, compact, onOpenAchievements }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
        role="button"
        tabIndex={0}
        aria-label={`View ${game.title} achievements`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        onClick={() => {
          onOpenAchievements(game);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenAchievements(game);
          }
        }}
        style={{
          width: compact ? "96px" : "140px",
          height: compact ? "56px" : "80px",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1px solid var(--app-border-soft)",
          background: "linear-gradient(135deg, rgba(139,92,246,0.18), rgba(15,23,42,0.08))",
          flexShrink: 0,
          position: "relative",
          cursor: "pointer",
          boxShadow: isHovered ? "0 14px 28px rgba(15,23,42,0.18)" : "0 8px 18px rgba(15,23,42,0.08)",
          transform: isHovered ? "translateY(-1px)" : "translateY(0)",
          transition: "transform 180ms ease, box-shadow 180ms ease",
          outline: "none",
        }}
      >
      <GameArtworkImage
        key={`${game.source}:${game.sourceGameId}`}
        game={game}
        alt={game.title}
        imageStyle={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
        placeholder={<ArtworkPlaceholder title={game.title} />}
      />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: game.launchUrl
              ? isHovered
                ? "linear-gradient(180deg, rgba(15,23,42,0.08) 24%, rgba(15,23,42,0.34) 100%)"
                : "linear-gradient(180deg, rgba(15,23,42,0.02) 34%, rgba(15,23,42,0.24) 100%)"
              : "transparent",
            pointerEvents: "none",
            transition: "background 180ms ease",
          }}
        />

        {!compact ? (
          <div
            style={{
              position: "absolute",
              left: "8px",
              bottom: "8px",
              width: compact ? "24px" : "28px",
              height: compact ? "24px" : "28px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.16)",
              color: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              boxShadow: isHovered
                ? "0 10px 20px rgba(15,23,42,0.22)"
                : "0 8px 18px rgba(15,23,42,0.16)",
              pointerEvents: "none",
              transform: isHovered ? "scale(1.05)" : "scale(1)",
              transition: "transform 180ms ease, box-shadow 180ms ease",
            }}
          >
              <Trophy size={14} />
          </div>
        ) : null}
    </div>
  );
}

function ArtworkPlaceholder({ title }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "6px",
        fontSize: "11px",
        fontWeight: 800,
        color: "var(--app-text-muted)",
      }}
    >
      {title}
    </div>
  );
}

function MetaBadge({ label, tone }) {
  const styleMap = {
    neutral: {
      background: "var(--app-surface-elevated)",
      color: "var(--app-text-soft)",
      border: "1px solid var(--app-border-soft)",
    },
    steam: {
      background: "rgba(59,130,246,0.1)",
      color: "#2563eb",
      border: "1px solid rgba(59,130,246,0.14)",
    },
    xbox: {
      background: "rgba(16,185,129,0.12)",
      color: "#059669",
      border: "1px solid rgba(16,185,129,0.16)",
    },
    local: {
      background: "rgba(139,92,246,0.1)",
      color: "#7c3aed",
      border: "1px solid rgba(139,92,246,0.16)",
    },
  };

  const toneStyle = styleMap[tone] || styleMap.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        padding: "4px 8px",
        fontSize: "10px",
        fontWeight: 800,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        ...toneStyle,
      }}
    >
      {label}
    </span>
  );
}

function IncludeToggleButton({ game, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        game.includeInOverallTotal === false ? "Include in total" : "Exclude from total"
      }
      title={game.includeInOverallTotal === false ? "Include in total" : "Exclude from total"}
      style={{
        minWidth: "42px",
        height: "26px",
        border: "1px solid var(--app-border-soft)",
        background:
          game.includeInOverallTotal === false
            ? "var(--app-surface-elevated)"
            : "rgba(139,92,246,0.1)",
        color: game.includeInOverallTotal === false ? "var(--app-text-muted)" : "#7c3aed",
        borderRadius: "999px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        padding: "0 8px",
      }}
    >
      {game.includeInOverallTotal === false ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
    </button>
  );
}
