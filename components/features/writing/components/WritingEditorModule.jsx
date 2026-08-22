"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpenText,
  Check,
  ChevronDown,
  ChevronUp,
  FilePlus2,
  MessageCircleQuestion,
  MessageSquareQuote,
  RefreshCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";
import { formatWritingCount } from "@/components/features/writing/utils/writingStats";
import FuriganaText from "@/components/features/writing/components/FuriganaText";

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
  grammarPointProgress = null,
  coachFeedback = null,
  coachError = "",
  coachNotice = "",
  grammarLevel = "N4",
  isGeneratingPrompt = false,
  isGeneratingFeedback = false,
  isExplainingGrammar = false,
  onContentChange,
  onSave,
  onNewEntry,
  onDelete,
  onGeneratePrompt,
  onGetFeedback,
  onGrammarLevelChange,
  onExplainGrammar,
}) {
  const [isPromptExpanded, setIsPromptExpanded] = useState(true);
  const saveDisabled = !metrics.characterCount || isSaving || isDeleting;
  const feedbackDisabled =
    !metrics.characterCount || isSaving || isDeleting || isGeneratingPrompt || isGeneratingFeedback;
  const isPromptCollapsed = isMobile && coachPrompt && !isPromptExpanded;
  const grammarMasteryLabel = grammarPointProgress
    ? `${formatGrammarStatus(grammarPointProgress.status)} · ${grammarPointProgress.masteryScore}%`
    : "";

  const handleGeneratePrompt = () => {
    setIsPromptExpanded(true);
    onGeneratePrompt();
  };

  return (
    <div
      style={{
        ...styles.largeCard,
        border: isMobile ? "var(--reading-mobile-top-card-border)" : styles.largeCard.border,
        boxShadow: isMobile ? "var(--reading-mobile-top-card-shadow)" : styles.largeCard.boxShadow,
        padding: isMobile ? "18px" : styles.largeCard.padding,
        display: "grid",
        gridTemplateRows: "minmax(0, 1fr)",
        gap: "18px",
        minHeight: 0,
        height: "100%",
      }}
    >
      <div style={localStyles.editorShell}>
        <div style={localStyles.entryMetaRow}>
          <div style={localStyles.entryDateLabel}>{entryDateLabel}</div>
          <div style={localStyles.wordCountPill}>
            {formatWritingCount(metrics.estimatedWords)} words
          </div>
        </div>

        <div style={localStyles.coachCard(isMobile)}>
          <div style={localStyles.coachHeader}>
            <div style={localStyles.coachHeading}>
              {coachPrompt?.source === "fallback" ? (
                <WifiOff size={14} title="Offline fallback prompt" />
              ) : (
                <Sparkles size={14} title={coachPrompt ? "AI generated prompt" : "Writing coach"} />
              )}
              Writing coach
            </div>

            <div style={localStyles.coachActionRow}>
              <JlptLevelMenu
                value={grammarLevel}
                onChange={onGrammarLevelChange}
                disabled={isGeneratingPrompt || isGeneratingFeedback}
              />
              <button
                type="button"
                onClick={handleGeneratePrompt}
                style={localStyles.coachSecondaryButton(isGeneratingPrompt || isGeneratingFeedback)}
                disabled={isGeneratingPrompt || isGeneratingFeedback}
              >
                <RefreshCcw size={14} />
                {isGeneratingPrompt ? "Generating..." : coachPrompt ? "Refresh prompt" : "Get prompt"}
              </button>
              {isMobile && coachPrompt ? (
                <button
                  type="button"
                  onClick={() => setIsPromptExpanded((current) => !current)}
                  style={localStyles.promptToggleButton}
                  aria-expanded={isPromptExpanded}
                  aria-label={isPromptExpanded ? "Collapse writing prompt" : "Expand writing prompt"}
                  title={isPromptExpanded ? "Collapse prompt" : "Expand prompt"}
                >
                  {isPromptExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              ) : null}
            </div>
          </div>

          {isPromptCollapsed ? (
            <div style={localStyles.collapsedPromptSummary}>
              <div style={localStyles.collapsedPromptItem}>
                <span style={localStyles.collapsedPromptLabel}>Topic</span>
                <span lang="ja" style={localStyles.collapsedPromptValue}>
                  {coachPrompt.topicJapanese || coachPrompt.topic}
                </span>
              </div>
              <div style={localStyles.collapsedPromptItem}>
                <span style={localStyles.collapsedPromptLabelRow}>
                  <span style={localStyles.collapsedPromptLabel}>Grammar</span>
                  {grammarMasteryLabel ? (
                    <span
                      style={localStyles.masteryBadge(true)}
                      title={`Grammar mastery: ${grammarMasteryLabel}`}
                    >
                      {grammarMasteryLabel}
                    </span>
                  ) : null}
                </span>
                <FuriganaText style={localStyles.collapsedPromptValue}>
                  {coachPrompt.grammarPointFurigana || coachPrompt.grammarPoint}
                </FuriganaText>
              </div>
            </div>
          ) : coachPrompt ? (
            <>
              <div style={localStyles.promptGrid(isMobile)}>
                <div style={localStyles.promptPanel(isMobile)}>
                  <div style={localStyles.promptPanelHeader}>
                    <div lang="ja" style={localStyles.topicJapaneseTitle}>
                      {coachPrompt.topicJapanese || coachPrompt.topic}
                    </div>
                    <span style={localStyles.panelIcon} title="Topic" aria-label="Topic">
                      <MessageCircleQuestion size={15} />
                    </span>
                  </div>
                  <div style={localStyles.topicEnglishTranslation}>
                    {coachPrompt.topicEnglish || coachPrompt.topic}
                  </div>
                </div>

                <div style={localStyles.promptPanel(isMobile)}>
                  <div style={localStyles.promptPanelHeader}>
                    <div style={localStyles.grammarPointHeading}>
                      <FuriganaText style={localStyles.grammarPointValue}>
                        {coachPrompt.grammarPointFurigana || coachPrompt.grammarPoint}
                      </FuriganaText>
                      {grammarMasteryLabel ? (
                        <span
                          style={localStyles.masteryBadge(false)}
                          title={`Grammar mastery: ${grammarMasteryLabel}`}
                        >
                          {grammarMasteryLabel}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={onExplainGrammar}
                      style={localStyles.explainButton}
                      disabled={isExplainingGrammar}
                      aria-label="Open grammar explanation"
                      title="Open grammar explanation"
                    >
                      <BookOpenText size={14} />
                    </button>
                  </div>
                  <div lang="ja" style={localStyles.grammarHintJapanese}>
                    {coachPrompt.grammarHintJapanese}
                  </div>
                  <div style={localStyles.grammarHintEnglish}>{coachPrompt.grammarHint}</div>
                  <div style={localStyles.exampleChip}>
                    <FuriganaText style={localStyles.exampleText}>
                      {coachPrompt.exampleFurigana || coachPrompt.example}
                    </FuriganaText>
                  </div>
                </div>
              </div>

              {coachPrompt.talkingPoints?.length ? (
                <div style={localStyles.speakingGuide}>
                  <div
                    className={isMobile ? "writing-talking-points-scroll" : undefined}
                    style={localStyles.talkingPointGrid(isMobile)}
                  >
                    {coachPrompt.talkingPoints.map((point, index) => (
                      <div key={`${point.japanese}-${index}`} style={localStyles.talkingPoint}>
                        <span lang="ja" style={localStyles.talkingPointJapanese}>{point.japanese}</span>
                      </div>
                    ))}
                  </div>
                  {coachPrompt.sentenceStarter ? (
                    <div style={localStyles.sentenceStarter}>
                      <span style={localStyles.sentenceStarterLabel}>Start with</span>
                      <span lang="ja">{coachPrompt.sentenceStarter}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div style={localStyles.coachPlaceholder}>
              Need an idea? Generate a topic and a grammar target for this entry.
            </div>
          )}

          {coachError ? <div style={localStyles.coachError}>{coachError}</div> : null}
        </div>

        <style>{`.writing-talking-points-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }`}</style>

        <textarea
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder="日本語で話すか、書いてみましょう…"
          lang="ja"
          inputMode="text"
          enterKeyHint="done"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          style={localStyles.textarea(isMobile, isCompact)}
        />

        <div style={localStyles.footerRow}>
          <div style={localStyles.actionRow}>
            {selectedEntry ? (
              <button
                type="button"
                onClick={onDelete}
                style={localStyles.deleteButton(isMobile)}
                disabled={isSaving || isDeleting}
                aria-label={isDeleting ? "Deleting entry" : "Delete entry"}
                title={isDeleting ? "Deleting entry…" : "Delete entry"}
              >
                <Trash2 size={15} />
                {isMobile ? null : isDeleting ? "Deleting..." : "Delete"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onNewEntry}
              style={localStyles.secondaryButton}
              aria-label="New entry"
              title="New entry"
            >
              <FilePlus2 size={17} />
            </button>
            <button
              type="button"
              onClick={onGetFeedback}
              style={localStyles.feedbackActionButton(feedbackDisabled)}
              disabled={feedbackDisabled}
              aria-label={isGeneratingFeedback ? "Reviewing writing" : "Get feedback"}
              title={isGeneratingFeedback ? "Reviewing writing…" : "Get feedback"}
            >
              <MessageSquareQuote size={17} />
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
              <span
                style={localStyles.sourceIcon(coachFeedback.source === "fallback")}
                title={coachFeedback.source === "fallback" ? "Offline fallback feedback" : "AI generated feedback"}
                aria-label={coachFeedback.source === "fallback" ? "Offline fallback feedback" : "AI generated feedback"}
              >
                {coachFeedback.source === "fallback" ? <WifiOff size={11} /> : <Sparkles size={11} />}
              </span>
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

const JLPT_LEVEL_OPTIONS = ["N5", "N4", "N3", "N2", "N1"];

function JlptLevelMenu({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [open]);

  return (
    <div ref={menuRef} style={localStyles.levelMenuWrap}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`JLPT grammar level ${value}`}
        disabled={disabled}
        style={localStyles.levelMenuButton(open, disabled)}
      >
        <span style={localStyles.levelMenuIcon}><SlidersHorizontal size={13} /></span>
        <span style={localStyles.levelMenuText}>{value}</span>
        <ChevronDown size={14} style={localStyles.levelMenuChevron(open)} />
      </button>

      {open ? (
        <div role="listbox" aria-label="JLPT grammar level" style={localStyles.levelMenuPopover}>
          {JLPT_LEVEL_OPTIONS.map((level) => {
            const active = level === value;
            return (
              <button
                key={level}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(level);
                  setOpen(false);
                }}
                style={localStyles.levelMenuOption(active)}
              >
                <span>{level}</span>
                {active ? <Check size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function formatGrammarStatus(status) {
  return {
    unseen: "New",
    learning: "Learning",
    improving: "Improving",
    strong: "Strong",
    mastered: "Mastered",
  }[status] || "New";
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
  coachCard: (isMobile) => ({
    display: "grid",
    gap: isMobile ? "8px" : "12px",
    borderRadius: "20px",
    border: "1px solid rgba(16,185,129,0.16)",
    background: "linear-gradient(180deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.02) 100%)",
    padding: isMobile ? "9px" : "14px",
  }),
  coachHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  coachHeading: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--app-text)",
  },
  coachActionRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "nowrap",
    alignItems: "center",
    flexShrink: 0,
  },
  coachSecondaryButton: (disabled) => ({
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-pill-track)",
    color: "var(--app-text)",
    borderRadius: "999px",
    minHeight: "38px",
    padding: "6px 13px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 650,
    fontSize: "12px",
    lineHeight: 1.2,
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    opacity: disabled ? 0.65 : 1,
  }),
  promptToggleButton: {
    width: "38px",
    height: "38px",
    flex: "0 0 38px",
    border: "1px solid var(--app-border-soft)",
    borderRadius: "999px",
    background: "var(--app-pill-track)",
    color: "var(--app-text-muted)",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  collapsedPromptSummary: {
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: "8px",
    padding: "9px 10px",
    borderRadius: "14px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
  },
  collapsedPromptItem: {
    minWidth: 0,
    display: "grid",
    gap: "2px",
  },
  collapsedPromptLabel: {
    fontSize: "9px",
    lineHeight: 1.2,
    fontWeight: 800,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  collapsedPromptLabelRow: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "5px",
  },
  collapsedPromptValue: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "13px",
    lineHeight: 1.5,
    fontWeight: 700,
    color: "var(--app-text)",
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
  levelMenuWrap: {
    position: "relative",
    width: "98px",
    flex: "0 0 auto",
    zIndex: 30,
  },
  levelMenuButton: (open, disabled) => ({
    width: "100%",
    minHeight: "38px",
    display: "grid",
    gridTemplateColumns: "26px minmax(0, 1fr) 18px",
    alignItems: "center",
    gap: "7px",
    padding: "5px 9px 5px 6px",
    border: open
      ? "1px solid var(--app-selected-border)"
      : "1px solid var(--app-border-soft)",
    borderRadius: "999px",
    background: "var(--app-pill-track)",
    color: "var(--app-text)",
    boxShadow: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    textAlign: "left",
    opacity: disabled ? 0.65 : 1,
  }),
  levelMenuIcon: {
    width: "26px",
    height: "26px",
    borderRadius: "999px",
    display: "grid",
    placeItems: "center",
    color: "var(--app-text-muted)",
  },
  levelMenuText: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "12px",
    lineHeight: 1.2,
    fontWeight: 650,
  },
  levelMenuChevron: (open) => ({
    color: "var(--app-text-muted)",
    transform: open ? "rotate(180deg)" : "none",
    transition: "transform 160ms ease",
  }),
  levelMenuPopover: {
    position: "absolute",
    top: "calc(100% + 7px)",
    left: 0,
    width: "100%",
    minWidth: "170px",
    padding: "7px",
    border: "1px solid var(--app-border-soft)",
    borderRadius: "18px",
    background: "color-mix(in srgb, var(--app-card) 94%, transparent)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: "0 18px 42px rgba(15,23,42,0.16)",
    overflow: "hidden",
  },
  levelMenuOption: (active) => ({
    width: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 18px",
    alignItems: "center",
    gap: "8px",
    padding: "9px 10px",
    border: 0,
    borderRadius: "10px",
    background: active ? "var(--app-selected-surface)" : "transparent",
    color: active ? "var(--app-selected-text)" : "var(--app-text-soft)",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "12px",
    fontWeight: active ? 700 : 600,
  }),
  sourceIcon: (isFallback) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    background: isFallback ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.07)",
    color: isFallback ? "#b45309" : "#059669",
    opacity: 0.72,
  }),
  promptPanel: (isMobile) => ({
    display: "grid",
    gap: isMobile ? "6px" : "8px",
    borderRadius: "16px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
    padding: isMobile ? "10px" : "12px",
  }),
  promptPanelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
  },
  grammarPointHeading: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  masteryBadge: (compact) => ({
    flexShrink: 0,
    width: "fit-content",
    padding: compact ? "2px 5px" : "3px 7px",
    borderRadius: "999px",
    border: "1px solid rgba(16,185,129,0.18)",
    background: "rgba(16,185,129,0.1)",
    color: "#047857",
    fontSize: compact ? "8px" : "10px",
    lineHeight: 1.2,
    fontWeight: 800,
    whiteSpace: "nowrap",
  }),
  explainButton: {
    border: "1px solid rgba(16,185,129,0.18)",
    background: "rgba(16,185,129,0.09)",
    color: "#047857",
    borderRadius: "999px",
    width: "28px",
    height: "28px",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  panelIcon: { width: "28px", height: "28px", borderRadius: "999px", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--app-text-muted)", background: "var(--app-pill-track)" },
  topicJapaneseTitle: { minWidth: 0, fontSize: "17px", fontWeight: 750, lineHeight: 1.5, color: "var(--app-text)" },
  topicEnglishTranslation: { fontSize: "11px", lineHeight: 1.45, color: "var(--app-text-muted)" },
  grammarPointValue: { minWidth: 0, fontSize: "17px", fontWeight: 750, lineHeight: 1.55, color: "var(--app-text)" },
  grammarHintJapanese: { fontSize: "14px", fontWeight: 700, lineHeight: 1.65, color: "#047857" },
  grammarHintEnglish: { fontSize: "11px", lineHeight: 1.5, color: "var(--app-text-muted)" },
  exampleChip: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    borderRadius: "14px",
    background: "rgba(16,185,129,0.08)",
    border: "1px solid rgba(16,185,129,0.14)",
    padding: "10px 11px",
  },
  exampleText: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "var(--app-text)",
  },
  speakingGuide: {
    display: "grid",
    gap: "9px",
    borderRadius: "16px",
    padding: "11px",
    border: "1px dashed rgba(20,184,166,0.22)",
    background: "rgba(20,184,166,0.05)",
  },
  talkingPointGrid: (isMobile) => ({
    display: "grid",
    gridTemplateColumns: isMobile ? undefined : "repeat(3, minmax(0, 1fr))",
    gridAutoFlow: isMobile ? "column" : undefined,
    gridAutoColumns: isMobile ? "minmax(210px, 82%)" : undefined,
    gap: "7px",
    overflowX: isMobile ? "auto" : undefined,
    overscrollBehaviorX: isMobile ? "contain" : undefined,
    scrollSnapType: isMobile ? "x proximity" : undefined,
    scrollbarWidth: isMobile ? "none" : undefined,
    msOverflowStyle: isMobile ? "none" : undefined,
  }),
  talkingPoint: {
    display: "grid",
    gap: "3px",
    padding: "9px",
    borderRadius: "12px",
    background: "var(--app-surface-elevated)",
    border: "1px solid var(--app-border-soft)",
    color: "var(--app-text)",
    fontSize: "12px",
    lineHeight: 1.4,
    fontWeight: 650,
    scrollSnapAlign: "start",
  },
  talkingPointJapanese: {
    color: "var(--app-text)",
    fontWeight: 650,
  },
  sentenceStarter: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--app-text)",
  },
  sentenceStarterLabel: {
    padding: "4px 7px",
    borderRadius: "999px",
    background: "rgba(20,184,166,0.12)",
    color: "#0f766e",
    fontSize: "10px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
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
  deleteButton: (isMobile) => ({
    border: "1px solid rgba(239,68,68,0.22)",
    background: "rgba(239,68,68,0.1)",
    color: "#dc2626",
    borderRadius: "14px",
    width: isMobile ? "42px" : "auto",
    height: isMobile ? "42px" : "auto",
    padding: isMobile ? 0 : "11px 14px",
    cursor: "pointer",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    justifyContent: "center",
    flex: isMobile ? "0 0 42px" : undefined,
  }),
  secondaryButton: {
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
    color: "var(--app-text)",
    borderRadius: "14px",
    width: "42px",
    height: "42px",
    padding: 0,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 42px",
  },
  feedbackActionButton: (disabled) => ({
    border: "1px solid rgba(20,184,166,0.2)",
    background: disabled ? "rgba(148,163,184,0.16)" : "rgba(20,184,166,0.1)",
    color: disabled ? "var(--app-text-muted)" : "#0f766e",
    borderRadius: "14px",
    width: "42px",
    height: "42px",
    padding: 0,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 42px",
    opacity: disabled ? 0.72 : 1,
  }),
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
