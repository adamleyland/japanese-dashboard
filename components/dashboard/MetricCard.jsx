"use client";

export default function MetricCard({
  label,
  value,
  icon,
  onAdjust,
  featured = false,
  compact = false,
}) {
  return (
    <div style={styles.metricCard(featured, compact)}>
      <div style={styles.metricTopRow(compact)}>
        {onAdjust ? (
          <button
            type="button"
            onClick={onAdjust}
            style={styles.metricIconButton(featured, compact)}
            aria-label={`Adjust ${label}`}
          >
            {icon}
          </button>
        ) : (
          <div style={styles.metricIconWrap(featured, compact)}>{icon}</div>
        )}
      </div>

      <div style={styles.metricLabel(compact)}>{label}</div>
      <div style={styles.metricValue(featured, compact)}>{value}</div>
    </div>
  );
}

const styles = {
  metricCard: (f, compact) => ({
    background: f ? "var(--app-card)" : "var(--app-card-muted)",
    border: "1px solid var(--app-border-soft)",
    boxShadow: f ? "0 16px 36px rgba(15,23,42,0.14)" : "0 12px 26px rgba(15,23,42,0.1)",
    borderRadius: f ? "24px" : "22px",
    padding: compact ? (f ? "18px" : "16px") : f ? "20px" : "18px",
  }),
  metricTopRow: (compact) => ({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: compact ? "8px" : "10px",
  }),
  metricIconWrap: (f, compact) => ({
    width: compact ? "40px" : f ? "40px" : "34px",
    height: compact ? "40px" : f ? "40px" : "34px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface-elevated)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: compact ? "18px" : f ? "20px" : "18px",
  }),
  metricIconButton: (f, compact) => ({
    width: compact ? "40px" : f ? "40px" : "34px",
    height: compact ? "40px" : f ? "40px" : "34px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface-elevated)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: compact ? "18px" : f ? "20px" : "18px",
    cursor: "pointer",
    padding: 0,
  }),
  metricLabel: (compact) => ({
    fontSize: compact ? "11px" : "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--app-text-muted)",
    marginBottom: "8px",
  }),
  metricValue: (f, compact) => ({
    fontSize: compact ? (f ? "34px" : "28px") : f ? "40px" : "30px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    color: "var(--app-text)",
  }),
};
