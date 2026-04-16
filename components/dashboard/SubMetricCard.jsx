"use client";

export default function SubMetricCard({
  label,
  value,
  onQuickAdd,
  quickAddLabel = "+1",
}) {
  return (
    <div style={styles.metricCard(false)}>
      <div style={styles.metricTopRow}>
        <div style={styles.metricLabel}>{label}</div>
        {onQuickAdd && (
          <button onClick={onQuickAdd} style={styles.quickAddButtonSub}>
            {quickAddLabel}
          </button>
        )}
      </div>

      <div style={styles.metricValue(false)}>{value}</div>
    </div>
  );
}

const styles = {
  metricCard: (featured) => ({
    background: featured ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.58)",
    border: "1px solid rgba(255,255,255,0.82)",
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
  metricLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#667085",
    marginBottom: "8px",
  },
  quickAddButtonSub: {
    border: "1px solid rgba(15,23,42,0.1)",
    background: "rgba(255,255,255,0.85)",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#111827",
    cursor: "pointer",
  },
  metricValue: (featured) => ({
    fontSize: featured ? "40px" : "30px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
  }),
};
