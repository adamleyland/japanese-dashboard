"use client";

import { useMemo, useState } from "react";
import { Gamepad2, ToggleLeft, ToggleRight } from "lucide-react";
import GameArtworkImage from "@/components/features/gaming/components/GameArtworkImage";
import { openGameLauncher } from "@/lib/gaming/launchers";

export default function GamingLibraryArtworkView({
  games,
  isCompact,
  onToggleInclude,
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
          onToggleInclude={onToggleInclude}
        />
      ))}
    </div>
  );
}

function ArtworkCard({ game, onToggleInclude }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={() => openGameLauncher(game)}
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
        cursor: game.launchUrl ? "pointer" : "default",
        padding: 0,
        textAlign: "left",
        boxShadow: isHovered ? "0 18px 40px rgba(15,23,42,0.18)" : "0 8px 22px rgba(15,23,42,0.1)",
        transform: isHovered ? "translateY(-1px)" : "translateY(0)",
        transition: "all 180ms ease",
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

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleInclude(game);
        }}
        aria-label={game.includeInOverallTotal === false ? "Include in total" : "Exclude from total"}
        style={{
          position: "absolute",
          right: "10px",
          bottom: "10px",
          width: "34px",
          height: "34px",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,0.18)",
          background: isHovered ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.12)",
          color: "#f8fafc",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: isHovered ? "0 10px 22px rgba(15,23,42,0.2)" : "0 8px 18px rgba(15,23,42,0.16)",
          transition: "all 180ms ease",
        }}
      >
        {game.includeInOverallTotal === false ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
      </button>
    </button>
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
