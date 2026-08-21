"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { BookOpenText, X } from "lucide-react";
import FuriganaText from "@/components/features/writing/components/FuriganaText";

export default function GrammarExplanationModal({ open, explanation, loading, error, onClose }) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div style={modalStyles.overlay} onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Grammar explanation"
        style={modalStyles.modal}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header style={modalStyles.header}>
          <div style={modalStyles.headingWrap}>
            <span style={modalStyles.icon}><BookOpenText size={18} /></span>
            <div>
              <div style={modalStyles.eyebrow}>Grammar guide</div>
              <div style={modalStyles.title}>
                {explanation ? (
                  <FuriganaText>
                    {explanation.grammarPointFurigana || explanation.grammarPoint}
                  </FuriganaText>
                ) : "Loading explanation…"}
              </div>
            </div>
          </div>
          <button type="button" style={modalStyles.closeButton} onClick={onClose} aria-label="Close grammar explanation">
            <X size={17} />
          </button>
        </header>

        <div style={modalStyles.content} aria-live="polite">
          {loading ? <div style={modalStyles.status}>Building your explanation…</div> : null}
          {error ? <div style={modalStyles.error}>{error}</div> : null}

          {!loading && explanation ? (
            <>
              <div style={modalStyles.heroCard}>
                <span style={modalStyles.levelPill}>{explanation.level}</span>
                {explanation.meaningJapanese ? (
                  <FuriganaText style={modalStyles.meaningJapanese}>
                    {explanation.meaningJapaneseFurigana || explanation.meaningJapanese}
                  </FuriganaText>
                ) : null}
                <div style={modalStyles.meaning}>{explanation.meaning}</div>
                <div style={modalStyles.nuance}>{explanation.nuance}</div>
              </div>

              {explanation.formation?.length ? (
                <GrammarSection title="How to form it">
                  <div style={modalStyles.chipRow}>
                    {explanation.formation.map((formation) => (
                      <span key={formation} style={modalStyles.formationChip}>{formation}</span>
                    ))}
                  </div>
                </GrammarSection>
              ) : null}

              {explanation.examples?.length ? (
                <GrammarSection title="Examples">
                  <div style={modalStyles.exampleStack}>
                    {explanation.examples.map((example, index) => (
                      <div key={`${example.japanese}-${index}`} style={modalStyles.exampleCard}>
                        <FuriganaText style={modalStyles.japanese}>
                          {example.japaneseFurigana || example.japanese}
                        </FuriganaText>
                        <div style={modalStyles.english}>{example.english}</div>
                      </div>
                    ))}
                  </div>
                </GrammarSection>
              ) : null}

              {explanation.commonMistake ? (
                <GrammarSection title="Common mistake">
                  <div style={modalStyles.warningCard}>{explanation.commonMistake}</div>
                </GrammarSection>
              ) : null}

              {explanation.similarGrammar ? (
                <GrammarSection title="Compared with similar grammar">
                  <div style={modalStyles.bodyText}>{explanation.similarGrammar}</div>
                </GrammarSection>
              ) : null}

              {explanation.quickChallenge ? (
                <GrammarSection title="Try it now">
                  <div style={modalStyles.challengeCard}>{explanation.quickChallenge}</div>
                </GrammarSection>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function GrammarSection({ title, children }) {
  return (
    <section style={modalStyles.section}>
      <h3 style={modalStyles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1200,
    padding: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--app-overlay)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  modal: {
    width: "min(660px, 100%)",
    maxHeight: "min(760px, calc(100dvh - 32px))",
    overflow: "hidden",
    borderRadius: "24px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-strong)",
    boxShadow: "0 30px 80px rgba(15,23,42,0.24)",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
  },
  header: {
    padding: "16px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    borderBottom: "1px solid var(--app-border-soft)",
  },
  headingWrap: { display: "flex", alignItems: "center", gap: "11px", minWidth: 0 },
  icon: {
    width: "38px",
    height: "38px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: "12px",
    color: "#047857",
    background: "rgba(16,185,129,0.13)",
  },
  eyebrow: { fontSize: "10px", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--app-text-muted)" },
  title: { marginTop: "2px", fontSize: "19px", fontWeight: 800, color: "var(--app-text)" },
  closeButton: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface-elevated)",
    color: "var(--app-text-muted)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  content: { overflowY: "auto", padding: "18px", display: "grid", gap: "18px" },
  status: { padding: "48px 16px", textAlign: "center", color: "var(--app-text-soft)", fontSize: "14px" },
  error: { padding: "13px", borderRadius: "14px", color: "#b91c1c", background: "rgba(239,68,68,0.09)", border: "1px solid rgba(239,68,68,0.16)", fontSize: "13px" },
  heroCard: { display: "grid", gap: "9px", padding: "15px", borderRadius: "18px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.16)" },
  levelPill: { width: "fit-content", padding: "4px 8px", borderRadius: "999px", color: "#047857", background: "rgba(16,185,129,0.13)", fontSize: "11px", fontWeight: 800 },
  meaning: { fontSize: "15px", fontWeight: 750, lineHeight: 1.55, color: "var(--app-text)" },
  meaningJapanese: { fontSize: "16px", fontWeight: 750, lineHeight: 1.7, color: "#047857" },
  nuance: { fontSize: "13px", lineHeight: 1.65, color: "var(--app-text-soft)" },
  section: { display: "grid", gap: "9px" },
  sectionTitle: { margin: 0, fontSize: "12px", fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--app-text-muted)" },
  chipRow: { display: "flex", flexWrap: "wrap", gap: "7px" },
  formationChip: { padding: "8px 10px", borderRadius: "11px", background: "var(--app-surface-elevated)", border: "1px solid var(--app-border-soft)", color: "var(--app-text)", fontSize: "13px", fontWeight: 650 },
  exampleStack: { display: "grid", gap: "8px" },
  exampleCard: { display: "grid", gap: "4px", padding: "12px", borderRadius: "14px", background: "var(--app-surface-elevated)", border: "1px solid var(--app-border-soft)" },
  japanese: { fontSize: "15px", lineHeight: 1.65, fontWeight: 650, color: "var(--app-text)" },
  english: { fontSize: "12px", lineHeight: 1.55, color: "var(--app-text-soft)" },
  warningCard: { padding: "12px", borderRadius: "14px", color: "#92400e", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.18)", fontSize: "13px", lineHeight: 1.6 },
  challengeCard: { padding: "12px", borderRadius: "14px", color: "#0f766e", background: "rgba(20,184,166,0.09)", border: "1px solid rgba(20,184,166,0.17)", fontSize: "13px", lineHeight: 1.6, fontWeight: 650 },
  bodyText: { fontSize: "13px", lineHeight: 1.65, color: "var(--app-text-soft)" },
};
