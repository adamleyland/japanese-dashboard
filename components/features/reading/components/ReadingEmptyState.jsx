"use client";

export default function ReadingEmptyState({
  label,
  tone = "default",
  align = "center",
}) {
  return (
    <div
      style={{
        borderRadius: "18px",
        border:
          tone === "error"
            ? "1px solid rgba(239,68,68,0.22)"
            : "1px dashed var(--app-border-soft)",
        background: tone === "error" ? "rgba(239,68,68,0.06)" : "var(--app-surface-soft)",
        color: tone === "error" ? "#dc2626" : "var(--app-text-muted)",
        padding: "18px",
        fontSize: "13px",
        textAlign: align,
      }}
    >
      {label}
    </div>
  );
}

