"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function MetricAdjustmentModal({
  open,
  metricLabel,
  icon: Icon,
  accent,
  currentTotal,
  unitType,
  onApply,
  onClose,
}) {
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [words, setWords] = useState("");

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes);
  const parsedWords = Number(words);

  const adjustmentAmount = useMemo(() => {
    if (unitType === "hours") {
      const hourValue = Number.isFinite(parsedHours) ? parsedHours : 0;
      const minuteValue = Number.isFinite(parsedMinutes) ? parsedMinutes : 0;
      const explicitNegativeZeroHours =
        hours.trim().startsWith("-") && Math.abs(hourValue) === 0 && minuteValue > 0;
      const normalizedMinuteValue = explicitNegativeZeroHours ? -minuteValue : minuteValue;
      return hourValue + normalizedMinuteValue / 60;
    }

    return Number.isFinite(parsedWords) ? parsedWords : 0;
  }, [hours, parsedHours, parsedMinutes, parsedWords, unitType]);

  const hasValue = adjustmentAmount !== 0;
  const nextTotal = Math.max(0, currentTotal + adjustmentAmount);

  const totalLabel = useMemo(() => {
    if (unitType === "hours") {
      return formatHours(nextTotal);
    }

    return formatWords(nextTotal);
  }, [nextTotal, unitType]);

  const adjustmentLabel = useMemo(() => {
    if (unitType === "hours") {
      return `${adjustmentAmount > 0 ? "+" : ""}${formatHours(adjustmentAmount)}`;
    }

    return `${adjustmentAmount > 0 ? "+" : ""}${formatWords(adjustmentAmount)}`;
  }, [adjustmentAmount, unitType]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const handleApply = () => {
    if (!hasValue) {
      return;
    }

    onApply(adjustmentAmount);
    onClose();
  };

  return createPortal(
    <div style={styles.overlay} onMouseDown={onClose}>
      <div
        style={styles.modal}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${metricLabel} adjustment`}
      >
        <div style={styles.header(accent)}>
          <div style={styles.headerInfo}>
            <span style={styles.headerIcon}>
              <Icon size={16} strokeWidth={2} />
            </span>
            <span style={styles.headerLabel}>{metricLabel}</span>
          </div>

          <button type="button" onClick={onClose} style={styles.closeButton} aria-label="Close adjustment popup">
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div style={styles.totalCard}>
          <div style={styles.totalLabel}>New Total</div>
          <div style={styles.totalValue}>{totalLabel}</div>
          <div style={styles.totalMeta}>Adjustment {adjustmentLabel}</div>
        </div>

        {unitType === "hours" ? (
          <>
            <div style={styles.fieldGrid}>
              <label style={styles.fieldCard}>
                <span style={styles.fieldLabel}>Hours</span>
                <input
                  type="number"
                  step={1}
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.fieldCard}>
                <span style={styles.fieldLabel}>Minutes</span>
                <input
                  type="number"
                  step={1}
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  style={styles.input}
                />
              </label>
            </div>

            <div style={styles.inputHint}>Use negative values to reduce time.</div>

            <div style={styles.actionsSingle}>
              <button type="button" onClick={handleApply} disabled={!hasValue} style={styles.primaryButton(!hasValue, accent)}>
                Apply
              </button>
            </div>
          </>
        ) : (
          <>
            <label style={styles.fieldCard}>
              <span style={styles.fieldLabel}>Words</span>
              <input
                type="number"
                step={1}
                value={words}
                onChange={(event) => setWords(event.target.value)}
                style={styles.input}
              />
            </label>

            <div style={styles.inputHint}>Use a negative number to reduce words.</div>

            <div style={styles.actionsSingle}>
              <button type="button" onClick={handleApply} disabled={!hasValue} style={styles.primaryButton(!hasValue, accent)}>
                Apply
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "var(--app-overlay)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 1000,
  },
  modal: {
    width: "min(360px, 100%)",
    borderRadius: "22px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-strong)",
    boxShadow: "0 28px 70px rgba(15,23,42,0.16)",
    padding: "16px",
    display: "grid",
    gap: "12px",
  },
  header: (accent) => ({
    borderRadius: "16px",
    background: accent.soft,
    color: accent.text,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 12px 12px 14px",
  }),
  headerInfo: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },
  headerIcon: {
    width: "30px",
    height: "30px",
    borderRadius: "10px",
    background: "var(--app-surface-elevated)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerLabel: {
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--app-text)",
  },
  closeButton: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
    color: "var(--app-text-muted)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  totalCard: {
    padding: "10px 12px",
    borderRadius: "14px",
    background: "var(--app-surface-soft)",
    border: "1px solid var(--app-border-soft)",
    display: "grid",
    gap: "2px",
  },
  totalLabel: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  totalValue: {
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    color: "var(--app-text)",
  },
  totalMeta: {
    fontSize: "12px",
    color: "var(--app-text-soft)",
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  fieldCard: {
    display: "grid",
    gap: "6px",
  },
  fieldLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--app-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    color: "var(--app-text)",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
  inputHint: {
    fontSize: "12px",
    color: "var(--app-text-soft)",
  },
  actionsSingle: {
    display: "grid",
  },
  primaryButton: (disabled, accent) => ({
    border: "none",
    background: disabled ? "rgba(148,163,184,0.5)" : accent.bg,
    color: disabled ? "rgba(255,255,255,0.9)" : "#fff",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  }),
};

function formatHours(value) {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 2,
  })} hours`;
}

function formatWords(value) {
  return `${Math.round(value).toLocaleString()} words`;
}
