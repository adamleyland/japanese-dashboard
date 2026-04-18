"use client";

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
        {onAdjust ? (
          <button
            type="button"
            onClick={onAdjust}
            style={styles.metricIconButton(featured)}
            aria-label={`Adjust ${label}`}
          >
            {icon}
          </button>
        ) : (
          <div style={styles.metricIconWrap(featured)}>{icon}</div>
        )}
      </div>

      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue(featured)}>{value}</div>
    </div>
  );
}

const styles = {
  metricCard: (f) => ({
    background: f ? "var(--app-card)" : "var(--app-card-muted)",
    border: "1px solid var(--app-border-soft)",
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
    border: "1px solid var(--app-border)",
    background: "var(--app-surface-elevated)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: f ? "20px" : "18px",
  }),
  metricIconButton: (f) => ({
    width: f ? "40px" : "34px",
    height: f ? "40px" : "34px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface-elevated)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: f ? "20px" : "18px",
    cursor: "pointer",
    padding: 0,
  }),
  metricLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--app-text-muted)",
    marginBottom: "8px",
  },
  metricValue: (f) => ({
    fontSize: f ? "40px" : "30px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    color: "var(--app-text)",
  }),
};
