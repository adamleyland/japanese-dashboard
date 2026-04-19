"use client";

import { RefreshCcw, Search, ToggleLeft, ToggleRight } from "lucide-react";
import GamingSourceToggle from "@/components/features/gaming/components/GamingSourceToggle";
import LaunchGameButton from "@/components/features/gaming/components/LaunchGameButton";
import {
  formatPlaytimeCompact,
  formatPlaytimeDetailed,
  formatRelativeLastPlayed,
  GAMING_SORT_OPTIONS,
  getSourceLabel,
} from "@/lib/gaming/gaming-utils";

export default function GamingLibraryPanel({
  styles,
  games,
  loading,
  error,
  sourceFilter,
  onSourceFilterChange,
  sortKey,
  onSortKeyChange,
  onToggleInclude,
  onRefresh,
  sourceStatus,
  isCompact,
}) {
  return (
    <div style={styles.largeCard}>
      <div
        style={{
          ...styles.sectionHeader,
          flexDirection: "column",
          alignItems: "stretch",
          gap: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={styles.sectionTitle}>Gaming Library</h2>
            <p style={styles.sectionText}>
              Unified Steam and Xbox playtime, normalized for one dashboard.
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            style={{
              border: "1px solid var(--app-border-soft)",
              background: "var(--app-surface-elevated)",
              color: "var(--app-text-soft)",
              borderRadius: "12px",
              padding: "8px 12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <RefreshCcw size={13} />
            Refresh
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <GamingSourceToggle
            value={sourceFilter}
            onChange={onSourceFilterChange}
            isCompact={isCompact}
          />

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              borderRadius: "14px",
              background: "var(--app-surface-elevated)",
              border: "1px solid var(--app-border-soft)",
              minWidth: isCompact ? "100%" : "220px",
            }}
          >
            <Search size={14} color="var(--app-text-muted)" />
            <select
              value={sortKey}
              onChange={(event) => onSortKeyChange(event.target.value)}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--app-text)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {GAMING_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort by {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <SourceStatusPill label="Steam" status={sourceStatus.steam} />
          <SourceStatusPill label="Xbox" status={sourceStatus.xbox} />
        </div>
      </div>

      <div style={{ display: "grid", gap: "10px" }}>
        {loading ? <EmptyState label="Loading your gaming library..." /> : null}
        {!loading && error ? <EmptyState label={error} tone="error" /> : null}

        {!loading && !error && !games.length ? (
          <EmptyState label="No games found yet. Add Steam config or an Xbox endpoint to populate this library." />
        ) : null}

        {!loading && !error && games.length ? (
          <div
            style={{
              display: "grid",
              gap: "10px",
              maxHeight: "760px",
              overflowY: "auto",
              paddingRight: "4px",
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isCompact ? "64px 1fr" : "88px 1fr auto",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <ArtworkCell game={game} compact={isCompact} />

                  <div style={{ minWidth: 0, display: "grid", gap: "6px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          minWidth: 0,
                        }}
                      >
                        {game.title}
                      </div>
                      <SourceTag source={game.source} />
                    </div>

                    <div style={{ ...styles.playerSub, margin: 0 }}>
                      {game.platform} | {formatPlaytimeCompact(game.minutesPlayedTotal)} total
                      {game.minutesPlayedRecent ? ` | ${formatPlaytimeDetailed(game.minutesPlayedRecent)} recent` : ""}
                    </div>

                    <div style={{ ...styles.playerSub, margin: 0 }}>
                      {formatRelativeLastPlayed(game.lastPlayedAt)}
                    </div>
                  </div>

                  {!isCompact ? <LaunchGameButton game={game} compact /> : null}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onToggleInclude(game)}
                    style={{
                      border: "1px solid var(--app-border-soft)",
                      background:
                        game.includeInOverallTotal === false
                          ? "var(--app-surface-elevated)"
                          : "rgba(139,92,246,0.1)",
                      color:
                        game.includeInOverallTotal === false
                          ? "var(--app-text-muted)"
                          : "#7c3aed",
                      borderRadius: "999px",
                      padding: "8px 12px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {game.includeInOverallTotal === false ? (
                      <ToggleLeft size={15} />
                    ) : (
                      <ToggleRight size={15} />
                    )}
                    {game.includeInOverallTotal === false
                      ? "Excluded from total"
                      : "Included in total"}
                  </button>

                  {isCompact ? <LaunchGameButton game={game} compact /> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ArtworkCell({ game, compact }) {
  return (
    <div
      style={{
        width: compact ? "64px" : "88px",
        height: compact ? "64px" : "88px",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid var(--app-border-soft)",
        background:
          "linear-gradient(135deg, rgba(139,92,246,0.18), rgba(15,23,42,0.08))",
        flexShrink: 0,
      }}
    >
      {game.artworkUrl ? (
        <img
          src={game.artworkUrl}
          alt={game.title}
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
            textAlign: "center",
            padding: "6px",
            fontSize: "11px",
            fontWeight: 800,
            color: "var(--app-text-muted)",
          }}
        >
          {game.title}
        </div>
      )}
    </div>
  );
}

function SourceTag({ source }) {
  const label = getSourceLabel(source);
  const tone =
    source === "steam"
      ? {
          background: "rgba(59,130,246,0.1)",
          color: "#2563eb",
        }
      : {
          background: "rgba(16,185,129,0.12)",
          color: "#059669",
        };

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
        ...tone,
      }}
    >
      {label}
    </span>
  );
}

function SourceStatusPill({ label, status }) {
  const tone = status.configured
    ? status.error
      ? {
          background: "rgba(239,68,68,0.1)",
          color: "#dc2626",
        }
      : {
          background: "rgba(16,185,129,0.12)",
          color: "#059669",
        }
    : {
        background: "var(--app-surface-soft)",
        color: "var(--app-text-muted)",
      };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "7px 10px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        ...tone,
      }}
    >
      <span>{label}</span>
      <span>
        {status.loading
          ? "Loading"
          : status.configured
          ? status.error
            ? "Issue"
            : "Connected"
          : "Not configured"}
      </span>
    </div>
  );
}

function EmptyState({ label, tone = "default" }) {
  return (
    <div
      style={{
        borderRadius: "18px",
        border:
          tone === "error"
            ? "1px solid rgba(239,68,68,0.22)"
            : "1px dashed var(--app-border-soft)",
        background: tone === "error" ? "rgba(239,68,68,0.06)" : "var(--app-surface-soft)",
        color: tone === "error" ? "#dc2626" : "var(--app-text-muted)",
        padding: "16px",
        fontSize: "13px",
      }}
    >
      {label}
    </div>
  );
}
