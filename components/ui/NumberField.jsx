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
  },
  inputLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  input: (mobileOptimized) => ({
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.1)",
    background: "#fff",
    fontSize: mobileOptimized ? "16px" : "14px",
  }),
};
