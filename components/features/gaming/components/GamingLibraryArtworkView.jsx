"use client";

import { useMemo, useState } from "react";
import { Gamepad2 } from "lucide-react";
import GameArtworkImage from "@/components/features/gaming/components/GameArtworkImage";
import { formatPlaytimeCompact } from "@/lib/gaming/gaming-utils";

export default function GamingLibraryArtworkView({
  games,
  isCompact,
  onOpenAchievements,
}) {
  const columns = useMemo(() => {
    if (isCompact) {
      return "repeat(2, minmax(0, 1fr))";
    }

    return "repeat(auto-fill, minmax(150px, 1fr))";
  }, [isCompact]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns,
        gap: "12px",
      }}
    >
      {games.map((game) => (
        <ArtworkCard
          key={`${game.source}:${game.sourceGameId}`}
          game={game}
          onOpenAchievements={onOpenAchievements}
        />
      ))}
    </div>
  );
}

function ArtworkCard({ game, onOpenAchievements }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View ${game.title} achievements`}
      onClick={() => {
        onOpenAchievements(game);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenAchievements(game);
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "2 / 3",
        borderRadius: "20px",
        overflow: "hidden",
        border:
          game.includeInOverallTotal === false
            ? "1px solid rgba(148,163,184,0.32)"
            : "1px solid var(--app-border-soft)",
        background: "linear-gradient(180deg, rgba(139,92,246,0.16), rgba(15,23,42,0.06))",
        cursor: "pointer",
        padding: 0,
        textAlign: "left",
        boxShadow: isHovered ? "0 18px 40px rgba(15,23,42,0.18)" : "0 8px 22px rgba(15,23,42,0.1)",
        transform: isHovered ? "translateY(-1px)" : "translateY(0)",
        transition: "all 180ms ease",
        outline: "none",
      }}
    >
      <GameArtworkImage
        key={`${game.source}:${game.sourceGameId}`}
        game={game}
        alt={game.title}
        variant="portrait"
        imageStyle={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
        placeholder={<ArtworkPlaceholder title={game.title} />}
      />

      <span style={{ position:"absolute", left:"10px", bottom:"10px", border:"1px solid rgba(255,255,255,.2)", borderRadius:"999px", background:"rgba(15,23,42,.58)", color:"#fff", padding:"6px 9px", fontSize:"11px", fontWeight:800, backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)" }}>
        {formatPlaytimeCompact(game.minutesPlayedTotal)}
      </span>
    </div>
  );
}

function ArtworkPlaceholder({ title }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        padding: "16px",
        background: "linear-gradient(180deg, rgba(139,92,246,0.22), rgba(15,23,42,0.12))",
        color: "var(--app-text-muted)",
        textAlign: "center",
      }}
    >
      <div style={{ display: "grid", gap: "10px", justifyItems: "center" }}>
        <Gamepad2 size={24} color="rgba(255,255,255,0.82)" />
        <div
          style={{
            fontSize: "13px",
            fontWeight: 800,
            lineHeight: 1.25,
            color: "#f8fafc",
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}
