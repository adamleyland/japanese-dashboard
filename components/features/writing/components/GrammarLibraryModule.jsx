"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenText,
  Check,
  ChevronDown,
  LibraryBig,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

const LEVELS = ["All", "N5", "N4", "N3", "N2", "N1"];
const STATUSES = [
  { key: "all", label: "All" },
  { key: "unseen", label: "Unseen" },
  { key: "learning", label: "Learning" },
  { key: "improving", label: "Improving" },
  { key: "strong", label: "Strong" },
  { key: "mastered", label: "Mastered" },
];
const LEVEL_OPTIONS = LEVELS.map((value) => ({
  value,
  label: value === "All" ? "All levels" : value,
  shortLabel: value === "All" ? "All" : value,
}));
const STATUS_OPTIONS = STATUSES.map((item) => ({
  value: item.key,
  label: item.key === "all" ? "All progress" : item.label,
  shortLabel: item.key === "all" ? "All" : item.label,
}));
const SORT_OPTIONS = [
  { value: "priority", label: "Practice priority", shortLabel: "Priority" },
  { value: "weakest", label: "Weakest first", shortLabel: "Weakest" },
  { value: "mastery", label: "Strongest first", shortLabel: "Strongest" },
  { value: "level", label: "JLPT order", shortLabel: "JLPT" },
];

export default function GrammarLibraryModule({
  progress,
  attemptsLoading = false,
  syncNotice = "",
  isMobile = false,
  onExplain,
  onPractise,
}) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("All");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("priority");
  const [expandedId, setExpandedId] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);

  const visiblePoints = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = progress.points.filter((point) => {
      const matchesLevel = level === "All" || point.level === level;
      const matchesStatus = status === "all" || point.status === status;
      const matchesQuery = !normalizedQuery || [point.japanese, point.romaji, point.meaning]
        .some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
      return matchesLevel && matchesStatus && matchesQuery;
    });

    return [...filtered].sort((left, right) => {
      if (sort === "mastery") return right.masteryScore - left.masteryScore;
      if (sort === "weakest") {
        if (left.entryCount === 0 && right.entryCount > 0) return 1;
        if (right.entryCount === 0 && left.entryCount > 0) return -1;
        return left.masteryScore - right.masteryScore;
      }
      if (sort === "level") return levelRank(left.level) - levelRank(right.level) || left.number - right.number;
      return priorityRank(left) - priorityRank(right) || left.number - right.number;
    });
  }, [level, progress.points, query, sort, status]);

  return (
    <div style={styles.shell}>
      <section style={styles.hero(isMobile)}>
        <div style={styles.heroCopy}>
          <div style={styles.eyebrow}><LibraryBig size={14} /> Grammar progress</div>
          <h2 style={styles.title}>Your JLPT grammar library</h2>
          <p style={styles.subtitle}>
            Every saved, marked entry strengthens the grammar points you actually use.
          </p>
        </div>

        <div style={styles.overallRing(progress.mastery)}>
          <div style={styles.ringInner}>
            <strong style={styles.ringScore}>{progress.mastery}%</strong>
            <span style={styles.ringLabel}>overall</span>
          </div>
        </div>
      </section>

      <div style={styles.metricGrid(isMobile)}>
        <MetricCard icon={Target} label="Coverage" value={`${progress.coverage}%`} detail={`${progress.practiced} of ${progress.total} practised`} />
        <MetricCard icon={Sparkles} label="Mastered" value={progress.mastered} detail="5 strong uses required" />
        <MetricCard icon={TrendingUp} label="Practised quality" value={`${progress.practicedMastery}%`} detail="Average across attempted points" />
      </div>

      <div style={styles.levelGrid(isMobile)}>
        {Object.entries(progress.levelSummaries).map(([jlptLevel, summary]) => (
          <button
            key={jlptLevel}
            type="button"
            onClick={() => setLevel(jlptLevel)}
            style={styles.levelCard(level === jlptLevel)}
          >
            <div style={styles.levelTop}><strong>{jlptLevel}</strong><span>{summary.mastery}%</span></div>
            <div style={styles.progressTrack}><span style={styles.progressFill(summary.mastery)} /></div>
            <div style={styles.levelDetail}>{summary.practiced}/{summary.total} practised · {summary.mastered} mastered</div>
          </button>
        ))}
      </div>

      <section style={styles.libraryPanel}>
        <div style={styles.toolbar(isMobile)}>
          <label style={styles.searchWrap(isMobile)}>
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search grammar, meaning or romaji"
              style={styles.searchInput}
            />
          </label>

          <div style={styles.selectRow(isMobile)}>
            <FilterMenu value={level} options={LEVEL_OPTIONS} onChange={setLevel} label="JLPT level" compact={isMobile} />
            <FilterMenu value={status} options={STATUS_OPTIONS} onChange={setStatus} label="Grammar progress" compact={isMobile} />
            <FilterMenu value={sort} options={SORT_OPTIONS} onChange={setSort} label="Practice priority" compact={isMobile} align="right" />
          </div>
        </div>

        {syncNotice ? <div style={styles.notice}>{syncNotice}</div> : null}
        {attemptsLoading ? <div style={styles.empty}>Loading grammar progress…</div> : null}

        <div style={styles.resultsHeader}>
          <span>{visiblePoints.length} grammar points</span>
          <span>Mastered points return occasionally for spaced review.</span>
        </div>

        <div style={styles.cardGrid(isMobile)}>
          {visiblePoints.slice(0, visibleCount).map((point) => {
            const expanded = expandedId === point.id;
            return (
              <article key={point.id} style={styles.card(expanded)}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? "" : point.id)}
                  style={styles.cardButton}
                  aria-expanded={expanded}
                >
                  <div style={styles.cardHeading}>
                    <div style={styles.pointIdentity}>
                      <span style={styles.levelPill(point.level)}>{point.level}</span>
                      <div>
                        <div lang="ja" style={styles.japanese}>{point.japanese}</div>
                        <div style={styles.meaning}>{point.meaning}</div>
                      </div>
                    </div>
                    <ChevronDown size={17} style={styles.chevron(expanded)} />
                  </div>

                  <div style={styles.cardProgressRow}>
                    <div style={styles.progressTrack}><span style={styles.progressFill(point.masteryScore)} /></div>
                    <strong style={styles.masteryNumber}>{point.masteryScore}%</strong>
                  </div>
                  <div style={styles.cardMeta}>
                    <span style={styles.statusPill(point.status)}>{statusLabel(point.status)}</span>
                    <span>{point.entryCount} {point.entryCount === 1 ? "entry" : "entries"}</span>
                    <span>{point.successfulUses} successful uses</span>
                  </div>
                </button>

                {expanded ? (
                  <div style={styles.expandedBody}>
                    <div style={styles.expandedStats(isMobile)}>
                      <Snapshot label="Average quality" value={`${point.qualityAverage}%`} />
                      <Snapshot label="Recent average" value={`${point.recentAverage}%`} />
                      <Snapshot label="Last practised" value={formatDate(point.lastPracticedAt)} />
                    </div>

                    {point.latestEvidence ? (
                      <div style={styles.evidence}>
                        <span style={styles.detailLabel}>Latest use</span>
                        <span lang="ja">{point.latestEvidence}</span>
                      </div>
                    ) : null}
                    {point.latestFeedback ? <div style={styles.feedback}>{point.latestFeedback}</div> : null}

                    <div style={styles.expandedActions}>
                      <button type="button" onClick={() => onExplain(point)} style={styles.secondaryAction}>
                        <BookOpenText size={15} /> Explanation
                      </button>
                      <button type="button" onClick={() => onPractise(point)} style={styles.primaryAction}>
                        <Sparkles size={15} /> Practise this
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        {visibleCount < visiblePoints.length ? (
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + 60)}
            style={styles.loadMore}
          >
            Show 60 more
          </button>
        ) : null}
      </section>
    </div>
  );
}

function FilterMenu({ value, options, onChange, label, compact = false, align = "left" }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [open]);

  return (
    <div ref={menuRef} style={styles.filterMenuWrap(open)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected.label}`}
        title={`${label}: ${selected.label}`}
        style={styles.filterMenuButton(open)}
      >
        <span style={styles.filterMenuText}>{compact ? selected.shortLabel : selected.label}</span>
        <ChevronDown size={13} style={styles.filterMenuChevron(open)} />
      </button>

      {open ? (
        <div role="listbox" aria-label={label} style={styles.filterMenuPopover(align)}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={styles.filterMenuOption(active)}
              >
                <span>{option.label}</span>
                {active ? <Check size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }) {
  return <div style={styles.metricCard}><Icon size={17} /><div><span style={styles.metricLabel}>{label}</span><strong style={styles.metricValue}>{value}</strong><span style={styles.metricDetail}>{detail}</span></div></div>;
}

function Snapshot({ label, value }) {
  return <div style={styles.snapshot}><span>{label}</span><strong>{value}</strong></div>;
}

function priorityRank(point) {
  return { learning: 0, improving: 1, unseen: 2, strong: 3, mastered: 4 }[point.status] ?? 5;
}

function levelRank(level) {
  return { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 }[level] ?? 5;
}

function statusLabel(status) {
  return { unseen: "Unseen", learning: "Learning", improving: "Improving", strong: "Strong", mastered: "Mastered" }[status] || status;
}

function formatDate(value) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

const styles = {
  shell: { display: "grid", gap: "16px", minWidth: 0 },
  hero: (mobile) => ({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "18px", padding: mobile ? "18px" : "24px", borderRadius: "24px", border: "1px solid rgba(16,185,129,0.18)", background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(20,184,166,0.04) 60%, var(--app-card))" }),
  heroCopy: { minWidth: 0 },
  eyebrow: { display: "inline-flex", alignItems: "center", gap: "7px", color: "#059669", fontSize: "11px", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" },
  title: { margin: "8px 0 4px", color: "var(--app-text)", fontSize: "clamp(22px, 3vw, 32px)", lineHeight: 1.15, letterSpacing: "-.03em" },
  subtitle: { margin: 0, maxWidth: "580px", color: "var(--app-text-muted)", fontSize: "13px", lineHeight: 1.55 },
  overallRing: (score) => ({ width: "96px", height: "96px", flex: "0 0 96px", padding: "8px", borderRadius: "50%", background: `conic-gradient(#10b981 ${score * 3.6}deg, var(--app-pill-track) 0)` }),
  ringInner: { width: "100%", height: "100%", borderRadius: "50%", display: "grid", placeContent: "center", textAlign: "center", background: "var(--app-card)" },
  ringScore: { color: "var(--app-text)", fontSize: "21px", lineHeight: 1 },
  ringLabel: { marginTop: "4px", color: "var(--app-text-muted)", fontSize: "9px", textTransform: "uppercase", letterSpacing: ".08em" },
  metricGrid: (mobile) => ({ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3, minmax(0,1fr))", gap: "10px" }),
  metricCard: { display: "flex", alignItems: "flex-start", gap: "11px", padding: "15px", borderRadius: "18px", border: "1px solid var(--app-border-soft)", background: "var(--app-card)", color: "#059669" },
  metricLabel: { display: "block", color: "var(--app-text-muted)", fontSize: "10px", fontWeight: 750, textTransform: "uppercase", letterSpacing: ".06em" },
  metricValue: { display: "block", marginTop: "3px", color: "var(--app-text)", fontSize: "22px", lineHeight: 1.15 },
  metricDetail: { display: "block", marginTop: "4px", color: "var(--app-text-muted)", fontSize: "11px" },
  levelGrid: (mobile) => ({ display: "grid", gridTemplateColumns: mobile ? "repeat(2, minmax(0,1fr))" : "repeat(5, minmax(0,1fr))", gap: "8px" }),
  levelCard: (active) => ({ border: active ? "1px solid rgba(16,185,129,.35)" : "1px solid var(--app-border-soft)", borderRadius: "16px", background: active ? "rgba(16,185,129,.1)" : "var(--app-card)", padding: "12px", textAlign: "left", color: "var(--app-text)", cursor: "pointer" }),
  levelTop: { display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px" },
  levelDetail: { marginTop: "7px", color: "var(--app-text-muted)", fontSize: "9px", lineHeight: 1.4 },
  progressTrack: { height: "6px", minWidth: 0, flex: 1, overflow: "hidden", borderRadius: "999px", background: "var(--app-pill-track)" },
  progressFill: (score) => ({ display: "block", width: `${Math.max(0, Math.min(100, score))}%`, height: "100%", borderRadius: "inherit", background: "linear-gradient(90deg,#10b981,#14b8a6)", transition: "width 240ms ease" }),
  libraryPanel: { display: "grid", gap: "12px", padding: "16px", borderRadius: "24px", border: "1px solid var(--app-border-soft)", background: "var(--app-card)", minWidth: 0 },
  toolbar: (mobile) => ({ display: "flex", flexDirection: mobile ? "column" : "row", justifyContent: "space-between", gap: "10px" }),
  searchWrap: (mobile) => ({ minHeight: "40px", width: mobile ? "100%" : "auto", minWidth: mobile ? 0 : "min(100%, 300px)", flex: mobile ? "0 0 40px" : "1 1 300px", boxSizing: "border-box", display: "flex", alignItems: "center", gap: "8px", padding: "0 12px", border: "1px solid var(--app-border-soft)", borderRadius: "999px", background: "var(--app-surface-elevated)", color: "var(--app-text-muted)" }),
  searchInput: { width: "100%", border: 0, outline: 0, background: "transparent", color: "var(--app-text)", fontSize: "12px" },
  selectRow: (mobile) => ({ width: mobile ? "100%" : "auto", display: mobile ? "grid" : "flex", gridTemplateColumns: mobile ? "minmax(0,.8fr) minmax(0,1fr) minmax(0,1.25fr)" : undefined, gap: "7px", flexWrap: "nowrap" }),
  filterMenuWrap: (open) => ({ position: "relative", minWidth: 0, zIndex: open ? 40 : 1 }),
  filterMenuButton: (open) => ({ width: "100%", minWidth: 0, minHeight: "40px", display: "grid", gridTemplateColumns: "minmax(0,1fr) 15px", alignItems: "center", gap: "4px", padding: "0 9px 0 11px", border: open ? "1px solid var(--app-selected-border)" : "1px solid var(--app-border-soft)", borderRadius: "999px", background: "var(--app-pill-track)", color: "var(--app-text)", cursor: "pointer", textAlign: "left" }),
  filterMenuText: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "10px", fontWeight: 650 },
  filterMenuChevron: (open) => ({ color: "var(--app-text-muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }),
  filterMenuPopover: (align) => ({ position: "absolute", top: "calc(100% + 7px)", left: align === "right" ? "auto" : 0, right: align === "right" ? 0 : "auto", minWidth: "160px", padding: "7px", border: "1px solid var(--app-border-soft)", borderRadius: "18px", background: "color-mix(in srgb, var(--app-card) 94%, transparent)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: "0 18px 42px rgba(15,23,42,.16)", overflow: "hidden" }),
  filterMenuOption: (active) => ({ width: "100%", minHeight: "36px", display: "grid", gridTemplateColumns: "minmax(0,1fr) 18px", alignItems: "center", gap: "8px", padding: "0 10px", border: 0, borderRadius: "10px", background: active ? "var(--app-selected-surface)" : "transparent", color: active ? "var(--app-selected-text)" : "var(--app-text-soft)", cursor: "pointer", textAlign: "left", fontSize: "11px", fontWeight: active ? 700 : 600 }),
  notice: { padding: "10px 12px", borderRadius: "12px", background: "rgba(245,158,11,.1)", color: "#b45309", fontSize: "11px" },
  resultsHeader: { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", color: "var(--app-text-muted)", fontSize: "10px" },
  cardGrid: (mobile) => ({ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(2, minmax(0,1fr))", gap: "8px" }),
  card: (expanded) => ({ minWidth: 0, alignSelf: "start", border: expanded ? "1px solid rgba(16,185,129,.28)" : "1px solid var(--app-border-soft)", borderRadius: "17px", background: expanded ? "linear-gradient(180deg,rgba(16,185,129,.07),var(--app-surface-elevated))" : "var(--app-surface-elevated)", overflow: "hidden" }),
  cardButton: { width: "100%", padding: "13px", border: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer" },
  cardHeading: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" },
  pointIdentity: { display: "flex", alignItems: "flex-start", gap: "9px", minWidth: 0 },
  levelPill: () => ({ flex: "0 0 auto", padding: "4px 6px", borderRadius: "8px", background: "rgba(20,184,166,.12)", color: "#0f766e", fontSize: "9px", fontWeight: 800 }),
  japanese: { color: "var(--app-text)", fontSize: "16px", fontWeight: 750, lineHeight: 1.35 },
  meaning: { marginTop: "3px", color: "var(--app-text-muted)", fontSize: "10px", lineHeight: 1.35 },
  chevron: (expanded) => ({ flex: "0 0 auto", color: "var(--app-text-muted)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }),
  cardProgressRow: { display: "flex", alignItems: "center", gap: "9px", marginTop: "12px" },
  masteryNumber: { width: "36px", color: "var(--app-text-soft)", fontSize: "10px", textAlign: "right" },
  cardMeta: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "9px", color: "var(--app-text-muted)", fontSize: "9px" },
  statusPill: (status) => ({ padding: "4px 7px", borderRadius: "999px", background: status === "mastered" ? "rgba(16,185,129,.14)" : status === "strong" ? "rgba(20,184,166,.12)" : status === "unseen" ? "var(--app-pill-track)" : "rgba(245,158,11,.11)", color: status === "mastered" || status === "strong" ? "#047857" : status === "unseen" ? "var(--app-text-muted)" : "#b45309", fontWeight: 750 }),
  expandedBody: { display: "grid", gap: "10px", padding: "0 13px 13px", borderTop: "1px solid var(--app-border-soft)" },
  expandedStats: (mobile) => ({ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap: "6px", paddingTop: "11px" }),
  snapshot: { display: "grid", gap: "3px", padding: "9px", borderRadius: "11px", background: "var(--app-pill-track)", color: "var(--app-text-muted)", fontSize: "9px" },
  evidence: { display: "grid", gap: "5px", padding: "10px", borderRadius: "12px", background: "rgba(16,185,129,.08)", color: "var(--app-text)", fontSize: "12px" },
  detailLabel: { color: "#047857", fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em" },
  feedback: { color: "var(--app-text-soft)", fontSize: "11px", lineHeight: 1.5 },
  expandedActions: { display: "flex", justifyContent: "flex-end", gap: "7px", flexWrap: "wrap" },
  secondaryAction: { display: "inline-flex", alignItems: "center", gap: "6px", minHeight: "36px", padding: "0 11px", border: "1px solid var(--app-border-soft)", borderRadius: "12px", background: "var(--app-card)", color: "var(--app-text)", fontSize: "11px", fontWeight: 700, cursor: "pointer" },
  primaryAction: { display: "inline-flex", alignItems: "center", gap: "6px", minHeight: "36px", padding: "0 12px", border: 0, borderRadius: "12px", background: "linear-gradient(135deg,#10b981,#059669)", color: "white", fontSize: "11px", fontWeight: 750, cursor: "pointer" },
  empty: { padding: "20px", color: "var(--app-text-muted)", textAlign: "center", fontSize: "12px" },
  loadMore: { justifySelf: "center", minHeight: "38px", padding: "0 16px", border: "1px solid var(--app-border-soft)", borderRadius: "999px", background: "var(--app-pill-track)", color: "var(--app-text)", fontSize: "11px", fontWeight: 750, cursor: "pointer" },
};
