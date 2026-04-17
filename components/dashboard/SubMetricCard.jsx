"use client";

import { Clock3 } from "lucide-react";

export default function SubMetricCard({
  label,
  value,
  icon,
  onAdjust,
}) {
  return (
    <div style={styles.metricCard(false)}>
      <div style={styles.metricTopRow}>
        <div style={styles.metricMeta}>
          {icon && <div style={styles.metricIconWrap}>{icon}</div>}
          <div style={styles.metricLabel}>{label}</div>
        </div>
        {onAdjust && (
          <button type="button" onClick={onAdjust} style={styles.quickAddButtonSub} aria-label={`Adjust ${label}`}>
            <Clock3 size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      <div style={styles.metricValue(false)}>{value}</div>
    </div>
  );
}

const styles = {
  metricCard: (featured) => ({
    background: featured ? "var(--app-card)" : "var(--app-card-muted)",
    border: "1px solid var(--app-border-soft)",
    boxShadow: featured ? "0 16px 36px rgba(15,23,42,0.14)" : "0 12px 26px rgba(15,23,42,0.1)",
    borderRadius: featured ? "24px" : "22px",
    padding: featured ? "20px" : "18px",
  }),
  metricTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
  },
  metricMeta: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },
  metricIconWrap: {
    width: "34px",
    height: "34px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface-elevated)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  metricLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--app-text-muted)",
  },
  quickAddButtonSub: {
    width: "30px",
    height: "30px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface-elevated)",
    borderRadius: "10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--app-text-muted)",
    cursor: "pointer",
  },
  metricValue: (featured) => ({
    fontSize: featured ? "40px" : "30px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    color: "var(--app-text)",
  }),
};
