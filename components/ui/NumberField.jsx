"use client";

export default function NumberField({ label, value, onChange, step = 1, mobileOptimized = false }) {
  const allowsDecimal = stepAllowsDecimal(step);

  return (
    <label style={styles.inputCard}>
      <span style={styles.inputLabel}>{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        inputMode={mobileOptimized ? (allowsDecimal ? "decimal" : "numeric") : undefined}
        enterKeyHint={mobileOptimized ? "done" : undefined}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        style={styles.input(mobileOptimized)}
      />
    </label>
  );
}

function stepAllowsDecimal(step) {
  const numericStep = Number(step);
  return Number.isFinite(numericStep) && !Number.isInteger(numericStep);
}

const styles = {
  inputCard: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
    width: "100%",
  },
  inputLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--app-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  input: (mobileOptimized) => ({
    width: "100%",
    minWidth: 0,
    padding: "10px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface-strong)",
    color: "var(--app-text)",
    fontSize: mobileOptimized ? "16px" : "14px",
    boxSizing: "border-box",
    outline: "none",
  }),
};
