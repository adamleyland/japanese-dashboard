"use client";

import { Clock3 } from "lucide-react";

export default function MetricCard({
  label,
  value,
  icon,
  onAdjust,
  featured = false,
}) {
  return (
    <div style={styles.metricCard(featured)}>
      <div style={styles.metricTopRow}>
        <div style={styles.metricIconWrap(featured)}>{icon}</div>
        {onAdjust && (
          <button type="button" onClick={onAdjust} style={styles.quickAddButton} aria-label={`Adjust ${label}`}>
            <Clock3 size={15} strokeWidth={2} />
          </button>
        )}
      </div>

      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue(featured)}>{value}</div>
    </div>
  );
}

const styles = {
  metricCard: (f) => ({
    background: f ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.58)",
    border: "1px solid rgba(255,255,255,0.82)",
    boxShadow: f ? "0 16px 36px rgba(15,23,42,0.14)" : "0 12px 26px rgba(15,23,42,0.1)",
    borderRadius: f ? "24px" : "22px",
    padding: f ? "20px" : "18px",
  }),
  metricTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
  },
  metricIconWrap: (f) => ({
    width: f ? "40px" : "34px",
    height: f ? "40px" : "34px",
    borderRadius: "12px",
    border: "1px solid rgba(15,23,42,0.1)",
    background: "rgba(255,255,255,0.85)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: f ? "20px" : "18px",
  }),
  quickAddButton: {
    width: "32px",
    height: "32px",
    border: "1px solid rgba(15,23,42,0.1)",
    background: "rgba(255,255,255,0.78)",
    borderRadius: "10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    cursor: "pointer",
  },
  metricLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#667085",
    marginBottom: "8px",
  },
  metricValue: (f) => ({
    fontSize: f ? "40px" : "30px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
  }),
};
