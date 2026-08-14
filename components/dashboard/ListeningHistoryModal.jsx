"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3, X } from "lucide-react";
import { fetchListeningManualHistory } from "@/lib/trackingEvents";

export default function ListeningHistoryModal({ open, userId, onClose }) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    fetchListeningManualHistory(userId).then((history) => {
      if (!cancelled) setEntries(history);
    });
    const handleEscape = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEscape);
    return () => { cancelled = true; document.removeEventListener("keydown", handleEscape); };
  }, [onClose, open, userId]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div style={styles.overlay} onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label="Manual listening history" style={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
        <header style={styles.header}>
          <div style={styles.heading}>
            <span style={styles.icon}><Clock3 size={17} /></span>
            <div><div style={styles.title}>Listening history</div><div style={styles.subtitle}>Recent listening time additions</div></div>
          </div>
          <button type="button" style={styles.closeButton} onClick={onClose} aria-label="Close listening history"><X size={16} /></button>
        </header>
        <div style={styles.content} aria-live="polite">
          {entries === null ? <div style={styles.status}>Loading history…</div> : entries.length ? entries.map((entry) => (
            <div key={entry.id || `${entry.createdAt}-${entry.amount}`} style={styles.entry}>
              <div><strong style={styles.amount}>+{formatDuration(entry.amount)}</strong><div style={styles.source}>{formatSource(entry.source)}</div></div>
              <time style={styles.timestamp} dateTime={entry.createdAt}>{formatTimestamp(entry.createdAt)}</time>
            </div>
          )) : <div style={styles.status}>No listening time has been added yet.</div>}
        </div>
      </section>
    </div>, document.body,
  );
}

function formatDuration(hours) {
  const totalMinutes = Math.round(Number(hours || 0) * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return !wholeHours ? `${minutes}m` : !minutes ? `${wholeHours}h` : `${wholeHours}h ${minutes}m`;
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatSource(source) {
  return source === "manual" ? "Manual entry" : source === "stopwatch-bank" ? "Stopwatch" : "Listening session";
}

const styles = {
  overlay: { position: "fixed", inset: 0, zIndex: 1000, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--app-overlay)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" },
  modal: { width: "min(390px, 100%)", maxHeight: "min(580px, calc(100dvh - 40px))", overflow: "hidden", borderRadius: "22px", border: "1px solid var(--app-border-soft)", background: "var(--app-surface-strong)", boxShadow: "0 28px 70px rgba(15,23,42,0.16)", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)" },
  header: { padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderBottom: "1px solid var(--app-border-soft)" }, heading: { display: "flex", alignItems: "center", gap: "10px" }, icon: { width: "34px", height: "34px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "11px", color: "#92400e", background: "rgba(234,179,8,0.18)" }, title: { fontSize: "15px", fontWeight: 750, color: "var(--app-text)" }, subtitle: { marginTop: "2px", fontSize: "12px", color: "var(--app-text-soft)" },
  closeButton: { width: "30px", height: "30px", borderRadius: "999px", border: "1px solid var(--app-border-soft)", background: "var(--app-surface-elevated)", color: "var(--app-text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center" }, content: { overflowY: "auto", padding: "8px 16px 16px" }, entry: { padding: "13px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid var(--app-border-soft)" }, amount: { fontSize: "16px", color: "#a16207" }, source: { marginTop: "3px", fontSize: "11px", color: "var(--app-text-soft)" }, timestamp: { fontSize: "12px", color: "var(--app-text-soft)", textAlign: "right" }, status: { padding: "28px 8px", textAlign: "center", color: "var(--app-text-soft)", fontSize: "14px" },
};
