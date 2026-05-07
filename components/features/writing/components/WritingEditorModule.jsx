"use client";

import { MessageSquareQuote, RefreshCcw, Save, Sparkles, Trash2 } from "lucide-react";
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
  coachPrompt = null,
  coachFeedback = null,
  coachError = "",
  coachNotice = "",
  isGeneratingPrompt = false,
  isGeneratingFeedback = false,
  onContentChange,
  onSave,
  onNewEntry,
  onDelete,
  onGeneratePrompt,
  onGetFeedback,
}) {
  const saveDisabled = !metrics.characterCount || isSaving || isDeleting;
  const feedbackDisabled =
    !metrics.characterCount || isSaving || isDeleting || isGeneratingPrompt || isGeneratingFeedback;

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
          <h2 style={styles.sectionTitle}>Writing</h2>
        </div>
      </div>

      <div style={localStyles.editorShell}>
        <div style={localStyles.entryMetaRow}>
          <div style={localStyles.entryDateLabel}>{entryDateLabel}</div>
          <div style={localStyles.wordCountPill}>
            {formatWritingCount(metrics.estimatedWords)} words
          </div>
        </div>

        <div style={localStyles.coachCard}>
          <div style={localStyles.coachHeader}>
            <div style={localStyles.coachHeadingWrap}>
              <div style={localStyles.coachHeading}>
                <Sparkles size={15} />
                Writing coach
              </div>
              <div style={localStyles.coachSubheading}>
                Generate a random topic, weave in a grammar point, then ask for a gentle review.
              </div>
            </div>

            <div style={localStyles.coachActionRow}>
              <button
                type="button"
                onClick={onGeneratePrompt}
                style={localStyles.coachSecondaryButton}
                disabled={isGeneratingPrompt || isGeneratingFeedback}
              >
                <RefreshCcw size={14} />
                {isGeneratingPrompt ? "Generating..." : coachPrompt ? "Refresh prompt" : "Get prompt"}
              </button>
              <button
                type="button"
                onClick={onGetFeedback}
                style={localStyles.coachPrimaryButton(feedbackDisabled)}
                disabled={feedbackDisabled}
              >
                <MessageSquareQuote size={14} />
                {isGeneratingFeedback ? "Reviewing..." : "Get feedback"}
              </button>
            </div>
          </div>

          {coachPrompt ? (
            <div style={localStyles.promptGrid(isMobile)}>
              <div style={localStyles.promptPanel}>
                <div style={localStyles.promptLabel}>Topic</div>
                <div style={localStyles.promptValue}>{coachPrompt.topic}</div>
                <div style={localStyles.promptTask}>{coachPrompt.task}</div>
              </div>

              <div style={localStyles.promptPanel}>
                <div style={localStyles.promptLabel}>Grammar point</div>
                <div style={localStyles.promptValue}>{coachPrompt.grammarPoint}</div>
                <div style={localStyles.promptTask}>{coachPrompt.grammarHint}</div>
                <div style={localStyles.exampleChip}>
                  <span style={localStyles.exampleLabel}>Example</span>
                  <span style={localStyles.exampleText}>{coachPrompt.example}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={localStyles.coachPlaceholder}>
              Need an idea? Generate a topic and a grammar target for this entry.
            </div>
          )}

          {coachError ? <div style={localStyles.coachError}>{coachError}</div> : null}
        </div>

        <textarea
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder="Write something in Japanese..."
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

        {coachFeedback ? (
          <div style={localStyles.feedbackCard}>
            <div style={localStyles.feedbackHeader}>
              <div style={localStyles.feedbackTitle}>AI feedback</div>
              <div style={localStyles.feedbackPill}>Short review</div>
            </div>

            {coachNotice ? <div style={localStyles.noticeCard}>{coachNotice}</div> : null}

            <div style={localStyles.feedbackLead}>{coachFeedback.encouragement}</div>

            {coachFeedback.grammarJudgement ? (
              <div style={localStyles.feedbackSection}>
                <div style={localStyles.feedbackLabel}>Grammar verdict</div>
                <div style={localStyles.verdictPill}>{coachFeedback.grammarJudgement}</div>
              </div>
            ) : null}

            <div style={localStyles.feedbackSection}>
              <div style={localStyles.feedbackLabel}>Grammar use</div>
              <div style={localStyles.feedbackBody}>{coachFeedback.grammarFit}</div>
            </div>

            {coachFeedback.strengths?.length ? (
              <div style={localStyles.feedbackSection}>
                <div style={localStyles.feedbackLabel}>What worked</div>
                <div style={localStyles.feedbackChipRow}>
                  {coachFeedback.strengths.map((strength) => (
                    <div key={strength} style={localStyles.feedbackChip}>
                      {strength}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {coachFeedback.corrections?.length ? (
              <div style={localStyles.feedbackSection}>
                <div style={localStyles.feedbackLabel}>High-value fixes</div>
                <div style={localStyles.correctionStack}>
                  {coachFeedback.corrections.map((correction, index) => (
                    <div key={`${correction.original}-${index}`} style={localStyles.correctionCard}>
                      <div style={localStyles.correctionRow}>
                        <span style={localStyles.correctionTag}>Original</span>
                        <span style={localStyles.correctionText}>{correction.original}</span>
                      </div>
                      <div style={localStyles.correctionRow}>
                        <span style={localStyles.correctionTagGreen}>Better</span>
                        <span style={localStyles.correctionText}>{correction.improved}</span>
                      </div>
                      <div style={localStyles.correctionReason}>{correction.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {coachFeedback.naturalRewrite ? (
              <div style={localStyles.feedbackSection}>
                <div style={localStyles.feedbackLabel}>Natural rewrite</div>
                <div style={localStyles.rewriteCard}>{coachFeedback.naturalRewrite}</div>
              </div>
            ) : null}

            <div style={localStyles.feedbackSection}>
              <div style={localStyles.feedbackLabel}>Next step</div>
              <div style={localStyles.feedbackBody}>{coachFeedback.nextStep}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const localStyles = {
  editorShell: {
    display: "grid",
    gridTemplateRows: "auto auto minmax(0, 1fr) auto auto auto",
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
  coachCard: {
    display: "grid",
    gap: "12px",
    borderRadius: "20px",
    border: "1px solid rgba(16,185,129,0.16)",
    background: "linear-gradient(180deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.02) 100%)",
    padding: "14px",
  },
  coachHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  coachHeadingWrap: {
    display: "grid",
    gap: "4px",
  },
  coachHeading: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--app-text)",
  },
  coachSubheading: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "var(--app-text-muted)",
    maxWidth: "560px",
  },
  coachActionRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  coachSecondaryButton: {
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
    color: "var(--app-text)",
    borderRadius: "12px",
    padding: "9px 12px",
    cursor: "pointer",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
  },
  coachPrimaryButton: (disabled) => ({
    border: "none",
    background: disabled
      ? "rgba(148,163,184,0.42)"
      : "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)",
    color: "#fff",
    borderRadius: "12px",
    padding: "9px 12px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    opacity: disabled ? 0.72 : 1,
    boxShadow: disabled ? "none" : "0 12px 24px rgba(15,118,110,0.18)",
  }),
  promptGrid: (isMobile) => ({
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  }),
  promptPanel: {
    display: "grid",
    gap: "8px",
    borderRadius: "16px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
    padding: "12px",
  },
  promptLabel: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  promptValue: {
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.4,
    color: "var(--app-text)",
  },
  promptTask: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "var(--app-text-soft)",
  },
  exampleChip: {
    display: "grid",
    gap: "6px",
    borderRadius: "14px",
    background: "rgba(16,185,129,0.08)",
    border: "1px solid rgba(16,185,129,0.14)",
    padding: "10px 11px",
  },
  exampleLabel: {
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#047857",
  },
  exampleText: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "var(--app-text)",
  },
  coachPlaceholder: {
    borderRadius: "16px",
    border: "1px dashed var(--app-border-soft)",
    padding: "14px",
    fontSize: "13px",
    lineHeight: 1.6,
    color: "var(--app-text-muted)",
    background: "rgba(255,255,255,0.02)",
  },
  coachError: {
    borderRadius: "14px",
    padding: "10px 12px",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.14)",
    color: "#b91c1c",
    fontSize: "12px",
    fontWeight: 600,
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
  feedbackCard: {
    display: "grid",
    gap: "14px",
    borderRadius: "20px",
    border: "1px solid rgba(20,184,166,0.16)",
    background: "linear-gradient(180deg, rgba(20,184,166,0.08) 0%, rgba(255,255,255,0.02) 100%)",
    padding: "15px",
  },
  feedbackHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  feedbackTitle: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--app-text)",
  },
  feedbackPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    border: "1px solid rgba(20,184,166,0.16)",
    background: "rgba(20,184,166,0.1)",
    color: "#0f766e",
    fontSize: "11px",
    fontWeight: 700,
  },
  feedbackLead: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "var(--app-text)",
  },
  noticeCard: {
    borderRadius: "14px",
    padding: "10px 12px",
    background: "rgba(245, 158, 11, 0.1)",
    border: "1px solid rgba(245, 158, 11, 0.18)",
    color: "#92400e",
    fontSize: "12px",
    lineHeight: 1.55,
  },
  feedbackSection: {
    display: "grid",
    gap: "8px",
  },
  feedbackLabel: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  feedbackBody: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "var(--app-text-soft)",
  },
  verdictPill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "8px 10px",
    borderRadius: "999px",
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.16)",
    color: "#047857",
    fontSize: "12px",
    fontWeight: 700,
  },
  feedbackChipRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  feedbackChip: {
    borderRadius: "999px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
    padding: "8px 10px",
    fontSize: "12px",
    color: "var(--app-text)",
  },
  correctionStack: {
    display: "grid",
    gap: "10px",
  },
  correctionCard: {
    display: "grid",
    gap: "8px",
    borderRadius: "16px",
    background: "var(--app-surface-elevated)",
    border: "1px solid var(--app-border-soft)",
    padding: "12px",
  },
  correctionRow: {
    display: "grid",
    gap: "4px",
  },
  correctionTag: {
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  correctionTagGreen: {
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#047857",
  },
  correctionText: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "var(--app-text)",
  },
  correctionReason: {
    fontSize: "12px",
    lineHeight: 1.55,
    color: "var(--app-text-soft)",
  },
  rewriteCard: {
    borderRadius: "16px",
    background: "var(--app-surface-elevated)",
    border: "1px solid var(--app-border-soft)",
    padding: "12px",
    fontSize: "13px",
    lineHeight: 1.75,
    color: "var(--app-text)",
    whiteSpace: "pre-wrap",
  },
};
