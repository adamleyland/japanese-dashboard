"use client";

import { Save, Trash2 } from "lucide-react";
import { formatWritingCount } from "@/components/features/writing/utils/writingStats";

export default function WritingEditorModule({
  styles,
  isCompact = false,
  isMobile = false,
  content,
  metrics,
  entryDateLabel,
  selectedEntry,
  statusMessage,
  isSaving = false,
  isDeleting = false,
  onContentChange,
  onSave,
  onNewEntry,
  onDelete,
}) {
  const saveDisabled = !metrics.characterCount || isSaving || isDeleting;

  return (
    <div
      style={{
        ...styles.largeCard,
        border: isMobile ? "var(--reading-mobile-top-card-border)" : styles.largeCard.border,
        boxShadow: isMobile ? "var(--reading-mobile-top-card-shadow)" : styles.largeCard.boxShadow,
        padding: isMobile ? "18px" : styles.largeCard.padding,
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        gap: "18px",
        minHeight: 0,
        height: "100%",
      }}
    >
      <div style={styles.sectionHeader}>
        <div style={{ minWidth: 0 }}>
          <h2 style={styles.sectionTitle}>ライティング</h2>
        </div>
      </div>

      <div style={localStyles.editorShell}>
        <div style={localStyles.entryMetaRow}>
          <div style={localStyles.entryDateLabel}>{entryDateLabel}</div>
          <div style={localStyles.wordCountPill}>
            {formatWritingCount(metrics.estimatedWords)} words
          </div>
        </div>

        <textarea
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder="何か書いてみましょう..."
          style={localStyles.textarea(isMobile, isCompact)}
        />

        <div style={localStyles.footerRow}>
          <div style={localStyles.actionRow}>
            {selectedEntry ? (
              <button
                type="button"
                onClick={onDelete}
                style={localStyles.deleteButton}
                disabled={isSaving || isDeleting}
              >
                <Trash2 size={15} />
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            ) : null}
            <button type="button" onClick={onNewEntry} style={localStyles.secondaryButton}>
              New entry
            </button>
            <button
              type="button"
              onClick={onSave}
              style={localStyles.primaryButton(saveDisabled)}
              disabled={saveDisabled}
            >
              <Save size={15} />
              {isSaving ? "Saving..." : selectedEntry ? "Update" : "Save"}
            </button>
          </div>
        </div>

        {statusMessage ? <div style={localStyles.statusMessage}>{statusMessage}</div> : null}
      </div>
    </div>
  );
}

const localStyles = {
  editorShell: {
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto auto",
    gap: "15px",
    minHeight: 0,
    height: "100%",
  },
  entryMetaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  entryDateLabel: {
    fontSize: "25px",
    fontWeight: 700,
    color: "var(--app-text-soft)",
    letterSpacing: "-0.01em",
  },
  textarea: (isMobile, isCompact) => ({
    width: "100%",
    minHeight: isMobile ? "280px" : isCompact ? "420px" : "0",
    height: isMobile ? "280px" : "100%",
    resize: "vertical",
    borderRadius: "22px",
    border: "1px solid var(--app-border-soft)",
    background: "linear-gradient(180deg, var(--app-surface-elevated) 0%, var(--app-card) 100%)",
    color: "var(--app-text)",
    padding: "18px",
    boxSizing: "border-box",
    fontSize: "16px",
    lineHeight: 1.8,
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  }),
  wordCountPill: {
    justifySelf: "start",
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 12px",
    borderRadius: "999px",
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.16)",
    color: "#059669",
    fontSize: "12px",
    fontWeight: 700,
  },
  footerRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  actionRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  deleteButton: {
    border: "1px solid rgba(239,68,68,0.22)",
    background: "rgba(239,68,68,0.1)",
    color: "#dc2626",
    borderRadius: "14px",
    padding: "11px 14px",
    cursor: "pointer",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  secondaryButton: {
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
    color: "var(--app-text)",
    borderRadius: "14px",
    padding: "11px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },
  primaryButton: (disabled) => ({
    border: "none",
    background: disabled
      ? "rgba(148,163,184,0.42)"
      : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#fff",
    borderRadius: "14px",
    padding: "11px 16px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    boxShadow: disabled ? "none" : "0 16px 32px rgba(5,150,105,0.22)",
    opacity: disabled ? 0.7 : 1,
  }),
  statusMessage: {
    borderRadius: "14px",
    padding: "10px 12px",
    background: "rgba(16,185,129,0.1)",
    border: "1px solid rgba(16,185,129,0.16)",
    color: "#059669",
    fontSize: "13px",
    fontWeight: 600,
  },
};
