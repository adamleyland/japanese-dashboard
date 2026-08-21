"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Clock3, Lock, LockOpen, Monitor, Percent, Play, RefreshCw, Settings, Trophy, X } from "lucide-react";
import { useAchievements } from "@/hooks/useAchievements";
import { useGameArtwork } from "@/hooks/useGameArtwork";
import { formatBritishOrdinalDate, formatPlaytimeCompact, getPlatformLabel } from "@/lib/gaming/gaming-utils";
import { canLaunchGame } from "@/lib/gaming/launchers";

export default function GameAchievementsModal({ game, onClose, onUpdateLocalArtwork, onDeleteLocalGame }) {
  const data = useAchievements(game);
  const art = useGameArtwork(game);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const metadata = game.raw?.metadata || {};
  const achievements = data.game?.achievements || [];
  const unlocked = achievements.filter((item) => item.unlocked).length;
  const hero = (game.source === "local" && metadata.heroArtworkUrl) || art.heroArtworkUrl || game.headerArtworkUrl || "/window.svg";
  const logo = (game.source === "local" && metadata.logoArtworkUrl) || art.logoArtworkUrl;

  useEffect(() => {
    const handler = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="gaming-expanded-overlay" style={s.overlay}>
      <div style={s.backdrop} onClick={onClose}/>
      <section className="achievement-modal-scroll gaming-expanded-modal" style={s.modal} role="dialog" aria-modal="true">
        <header className="gaming-expanded-hero" style={s.hero}>
          <img src={hero} alt="" style={s.heroImage}/>
          <div style={s.shade}/>
          <div className="gaming-expanded-actions" style={{ ...s.top, justifyContent: "flex-end" }}>
            <div style={s.actionGroup}>
              {canLaunchGame(game) ? <a className="gaming-expanded-play-button" href={game.launchUrl} style={{ ...s.icon, ...s.play }} aria-label={`Play ${game.title} through Steam`} title="Play through Steam"><Play size={15} fill="currentColor"/>Play</a> : null}
              <button type="button" style={{ ...s.icon, opacity: data.loading ? .62 : 1 }} disabled={data.loading} aria-label="Sync achievements" title="Sync achievements" onClick={data.refresh}><RefreshCw size={16}/></button>
              {game.source === "local" ? <button type="button" style={s.icon} aria-label="Artwork settings" onClick={() => setSettingsOpen(!settingsOpen)}><Settings size={16}/></button> : null}
              <button type="button" style={s.icon} aria-label="Close" onClick={onClose}><X size={18}/></button>
            </div>
          </div>
          <div className="gaming-expanded-brand" style={s.brand}>{logo ? <img src={logo} alt={game.title} style={s.logo}/> : <h2 style={s.title}>{game.title}</h2>}</div>
        </header>
        <main className="gaming-expanded-content" style={s.content}>
          {settingsOpen ? <LocalSettings game={game} save={onUpdateLocalArtwork} remove={onDeleteLocalGame}/> : null}
          <div className="gaming-expanded-stats" style={s.stats}>
            <Stat icon={<Trophy size={14}/>} label="Achievements" value={achievements.length ? unlocked + "/" + achievements.length : "—"}/>
            <Stat icon={<Percent size={14}/>} label="Completion" value={achievements.length ? Math.round(unlocked / achievements.length * 100) + "%" : "—"}/>
            <Stat icon={<Clock3 size={14}/>} label="Hours played" value={formatPlaytimeCompact(game.minutesPlayedTotal)}/>
            <Stat icon={<Monitor size={14}/>} label="Platform" value={getPlatformLabel(game.platform)}/>
          </div>
          {data.error ? <div role="alert" style={s.errorAlert}>{data.error}</div> : null}
          {data.warning ? <div style={s.warningAlert}>{data.warning} Showing the last saved progress.</div> : null}
          {data.loading && !data.game ? <div style={{ padding: "26px 0", textAlign: "center", color: "var(--app-text-muted)", fontSize: 13 }}>Syncing achievement progress…</div> : null}
          <div style={s.collectionHeader}><h3 style={s.collectionTitle}>Achievements</h3><span style={s.collectionCount}>{unlocked} / {achievements.length}</span></div>
          <div style={s.completionTrack}><div style={{ ...s.completionFill, width: `${achievements.length ? unlocked / achievements.length * 100 : 0}%` }}/></div>
          <div style={s.grid}>{achievements.map((item) => <article key={item.id} style={{ ...s.card, opacity: item.unlocked ? 1 : .62 }}><img src={(item.unlocked ? item.icon_url : item.icon_locked_url) || item.icon_url || "/window.svg"} alt="" style={{ ...s.achievementImage, filter: item.unlocked ? "none" : "grayscale(1)" }}/><div style={s.achievementBody}><div style={s.achievementCopy}><strong style={s.achievementName}>{item.name}</strong><p style={s.achievementDescription}>{item.description || (item.metadata?.hidden ? "Hidden achievement" : "No description provided.")}</p></div><AchievementMeta item={item}/><AchievementProgress item={item}/></div></article>)}</div>
        </main>
      </section>
    </div>,
    document.body,
  );
}

function Stat({ icon, label, value }) { return <div className="gaming-expanded-stat" style={s.stat}><small style={s.statLabel}>{icon}{label}</small><strong style={s.statValue}>{value}</strong></div>; }
function AchievementMeta({ item }) {
  const unlockedAt = formatBritishOrdinalDate(item.unlocked_at);
  const statusLabel = unlockedAt ? `Unlocked ${unlockedAt}` : "Locked";

  return <small className="gaming-achievement-meta" style={s.achievementMeta} aria-label={statusLabel} title={statusLabel}>
    <span style={s.achievementMetaRow}>{unlockedAt ? <LockOpen size={12} aria-hidden="true"/> : <Lock size={12} aria-hidden="true"/>}{unlockedAt ? <span>{unlockedAt}</span> : null}</span>
    {item.rarity_percentage != null ? <span style={s.achievementMetaRow}>{Number(item.rarity_percentage).toFixed(1)}% players</span> : null}
  </small>;
}
function AchievementProgress({ item }) {
  const current = Number(item.progress_current);
  const target = Number(item.progress_target);
  if (item.unlocked || !Number.isFinite(current) || !Number.isFinite(target) || current <= 0 || target <= 1) return null;

  const safeCurrent = Math.max(0, current);
  const percent = Math.min(100, safeCurrent / target * 100);
  const valueLabel = `${formatProgressValue(safeCurrent)} / ${formatProgressValue(target)}`;

  return <div style={s.achievementProgress}>
    <div
      style={s.achievementProgressTrack}
      role="progressbar"
      aria-label={`${item.name} progress`}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.min(safeCurrent, target)}
      aria-valuetext={valueLabel}
    >
      <div style={{ ...s.achievementProgressFill, width: `${percent}%` }}/>
    </div>
    <span style={s.achievementProgressValue}>{valueLabel}</span>
  </div>;
}
function formatProgressValue(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}
function LocalSettings({ game, save, remove }) {
  const metadata = game.raw?.metadata || {};
  const artwork = useGameArtwork(game);
  const [cover, setCover] = useState(game.artworkUrl || "");
  const [heroEdit, setHeroEdit] = useState(null);
  const [logoEdit, setLogoEdit] = useState(null);
  const hero = heroEdit ?? metadata.heroArtworkUrl ?? artwork.heroArtworkUrl ?? "";
  const logo = logoEdit ?? metadata.logoArtworkUrl ?? artwork.logoArtworkUrl ?? "";

  return <div style={s.settings}>
    <strong>Artwork overrides</strong>
    <ArtworkUrlField label="Cover artwork URL" value={cover} onChange={setCover}/>
    <ArtworkUrlField label="Hero artwork URL" value={hero} onChange={setHeroEdit}/>
    <ArtworkUrlField label="Logo artwork URL" value={logo} onChange={setLogoEdit}/>
    <div><button type="button" style={s.sync} onClick={() => save(game, { coverImageUrl: cover, heroArtworkUrl: hero, logoArtworkUrl: logo })}>Save changes</button><button type="button" style={s.delete} onClick={() => { if (window.confirm("Delete this local game permanently?")) remove(game); }}>Delete game</button></div>
  </div>;
}

function ArtworkUrlField({ label, value, onChange }) {
  return <label style={{ display: "grid", gap: 6 }}>
    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--app-text-muted)" }}>{label}</span>
    <input
      type="url"
      style={{ width: "100%", minWidth: 0, padding: "10px 12px", border: "1px solid var(--app-border-strong)", borderRadius: 10, background: "var(--app-surface-strong)", color: "var(--app-text)", font: "inherit", fontSize: 13, outlineColor: "#6366f1" }}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="https://…"
    />
  </label>;
}

const s = {
  overlay: { position: "fixed", inset: 0, zIndex: 10020, padding: 20, display: "grid", placeItems: "center" },
  backdrop: { position: "absolute", inset: 0, background: "rgba(2,6,23,.72)", backdropFilter: "blur(14px)" },
  modal: { position: "relative", width: "min(940px,100%)", maxHeight: "min(760px,calc(100vh - 72px))", overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none", borderRadius: 26, border: "1px solid var(--app-border-strong)", background: "var(--app-surface-strong)", color: "var(--app-text)", fontFamily: "Inter, system-ui, -apple-system, sans-serif", boxShadow: "0 28px 80px rgba(2,6,23,.32)" },
  hero: { height: 270, position: "relative", overflow: "hidden" },
  heroImage: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
  shade: { position: "absolute", inset: 0, background: "linear-gradient(0deg,rgba(2,6,23,.78),transparent 72%)" },
  top: { position: "absolute", inset: "16px 18px auto", display: "flex", alignItems: "center", justifyContent: "space-between" },
  actionGroup: { display: "flex", alignItems: "center", gap: 8 },
  play: { width: "auto", padding: "0 13px", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 12, fontWeight: 800, textDecoration: "none" },
  icon: { width: 38, height: 38, borderRadius: 11, border: "1px solid rgba(255,255,255,.25)", background: "rgba(15,23,42,.55)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", backdropFilter: "blur(12px)" },
  brand: { position: "absolute", left: 32, bottom: 22, color: "#fff" },
  logo: { width: "min(390px,70vw)", maxHeight: 88, objectFit: "contain", objectPosition: "left" },
  title: { margin: 0, fontSize: 36 },
  content: { padding: 26, display: "grid", gap: 18, background: "var(--app-surface-strong)" },
  stats: { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 },
  stat: { padding: "15px 16px", border: "1px solid var(--app-border)", borderRadius: 16, display: "grid", gap: 9, background: "linear-gradient(135deg,var(--app-surface-elevated),var(--app-card-muted))", boxShadow: "inset 0 1px 0 rgba(148,163,184,.08),0 8px 24px rgba(2,6,23,.08)", backdropFilter: "blur(16px)" },
  statLabel: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--app-text-muted)" },
  statValue: { fontSize: 24, letterSpacing: "-.04em", lineHeight: 1.05, color: "var(--app-text)" },
  sync: { padding: "9px 12px", border: "1px solid var(--app-border)", borderRadius: 10, background: "var(--app-surface-elevated)", color: "var(--app-text)", fontWeight: 800 },
  delete: { marginLeft: 8, padding: "9px 12px", border: "1px solid rgba(239,68,68,.28)", borderRadius: 10, background: "rgba(239,68,68,.08)", color: "#ef4444", fontWeight: 800 },
  collectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "4px 2px 0" },
  collectionTitle: { margin: 0, fontSize: 16, lineHeight: 1.2, letterSpacing: "-.02em", color: "var(--app-text)" },
  collectionCount: { display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, background: "var(--app-selected-surface)", color: "var(--app-selected-text)", fontSize: 12, fontWeight: 800, lineHeight: 1 },
  completionTrack: { height: 4, overflow: "hidden", borderRadius: 999, background: "var(--app-surface-soft)", border: "1px solid var(--app-border-soft)" },
  completionFill: { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#2563eb,#60a5fa)", transition: "width .25s ease" },
  errorAlert: { padding: "12px 14px", border: "1px solid rgba(239,68,68,.24)", borderRadius: 12, background: "color-mix(in srgb,#ef4444 10%,var(--app-surface))", color: "#ef4444", fontSize: 13 },
  warningAlert: { padding: "12px 14px", border: "1px solid rgba(245,158,11,.24)", borderRadius: 12, background: "color-mix(in srgb,#f59e0b 10%,var(--app-surface))", color: "#f59e0b", fontSize: 13 },
  grid: { display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 10 },
  card: { display: "grid", gridTemplateColumns: "62px minmax(0,1fr)", alignItems: "start", gap: 11, minHeight: 84, padding: 11, border: "1px solid var(--app-border-soft)", borderRadius: 13, background: "linear-gradient(145deg,var(--app-card),var(--app-surface-soft))", boxShadow: "0 3px 12px rgba(2,6,23,.06)" },
  achievementImage: { width: 62, height: 62, objectFit: "cover", borderRadius: 9, boxShadow: "0 2px 7px rgba(2,6,23,.22)" },
  achievementBody: { minWidth: 0, display: "grid", height: "100%", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", columnGap: 18 },
  achievementCopy: { minWidth: 0, display: "grid", alignContent: "center" },
  achievementName: { gridColumn: 1, fontFamily: "inherit", fontSize: 14, lineHeight: 1.25, fontWeight: 800, letterSpacing: "-.01em", color: "var(--app-text)" },
  achievementDescription: { gridColumn: 1, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", margin: "4px 0 0", fontSize: 11.5, lineHeight: 1.4, color: "var(--app-text-muted)" },
  achievementMeta: { gridColumn: 2, alignSelf: "center", display: "grid", justifyItems: "end", gap: 5, whiteSpace: "nowrap", fontSize: 10.5, lineHeight: 1.2, color: "var(--app-text-muted)", fontWeight: 600 },
  achievementMetaRow: { display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  achievementProgress: { gridColumn: "1 / -1", width: "100%", display: "flex", alignItems: "center", gap: 8, marginTop: 7 },
  achievementProgressTrack: { flex: 1, minWidth: 36, height: 5, overflow: "hidden", borderRadius: 999, background: "var(--app-surface-soft)", border: "1px solid var(--app-border-soft)" },
  achievementProgressFill: { height: "100%", minWidth: 2, borderRadius: 999, background: "linear-gradient(90deg,#2563eb,#60a5fa)", transition: "width .25s ease" },
  achievementProgressValue: { flex: "0 0 auto", fontSize: 9.5, lineHeight: 1, color: "var(--app-text-muted)", fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  settings: { display: "grid", gap: 10, padding: 14, border: "1px solid var(--app-border)", borderRadius: 16, background: "var(--app-surface-soft)" },
};
