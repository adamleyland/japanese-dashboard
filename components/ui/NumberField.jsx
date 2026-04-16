"use client";

export default function NumberField({ label, value, onChange, step = 1 }) {
  return (
    <label style={styles.inputCard}>
      <span style={styles.inputLabel}>{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        style={styles.input}
      />
    </label>
  );
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
  input: {
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid rgba(0,0,0,0.1)",
    background: "#fff",
    fontSize: "14px",
  },
};
