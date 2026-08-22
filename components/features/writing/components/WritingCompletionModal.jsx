"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, Flame, Sparkles, Target, Trophy, X } from "lucide-react";

export default function WritingCompletionModal({ completion, onClose }) {
  useEffect(() => {
    if (!completion) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [completion, onClose]);

  if (!completion || typeof document === "undefined") {
    return null;
  }

  const assessment = completion.assessment;
  const score = assessment?.score;

  return createPortal(
    <div style={completionStyles.overlay} onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Writing entry complete"
        style={completionStyles.card}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={onClose} style={completionStyles.closeButton} aria-label="Close writing summary">
          <X size={16} />
        </button>

        <div style={completionStyles.icon}><Trophy size={29} /></div>
        <div style={completionStyles.eyebrow}>Entry saved</div>
        <div style={completionStyles.title}>Writing complete!</div>

        {assessment ? (
          <>
            <div style={completionStyles.scoreWrap}>
              <strong style={completionStyles.score}>{score}</strong>
              <span style={completionStyles.scoreOutOf}>/100</span>
              <span style={completionStyles.scoreTier}>{getScoreTier(score)}</span>
            </div>
            <div style={completionStyles.summary}>{assessment.summary}</div>

            <div style={completionStyles.achievementRow}>
              <AchievementBadge achieved={assessment.promptAchieved} icon={Target} label="Prompt" />
              <AchievementBadge achieved={assessment.grammarAchieved} icon={Sparkles} label="Grammar" />
            </div>
          </>
        ) : (
          <div style={completionStyles.summary}>
            Your entry is safely logged. The AI score was unavailable this time.
          </div>
        )}

        <GrammarUsedSummary
          level={completion.grammarLevel}
          grammarPoints={completion.grammarPointsUsed}
        />

        <div style={completionStyles.stats}>
          <CompletionStat value={completion.estimatedWords} label="words" />
          <CompletionStat value={completion.characterCount} label="characters" />
          <CompletionStat value={completion.streak} label="day streak" icon={Flame} />
        </div>

        {completion.mainImprovement ? (
          <div style={completionStyles.notes}>
            <div style={completionStyles.noteRow}>
              <span style={completionStyles.noteLabel}>Main improvement</span>
              <span>{completion.mainImprovement}</span>
            </div>
          </div>
        ) : null}

        <button type="button" style={completionStyles.primaryButton} onClick={onClose}>Nice!</button>
      </section>
    </div>,
    document.body,
  );
}

function AchievementBadge({ achieved, icon: Icon, label }) {
  return (
    <div style={completionStyles.achievementBadge(achieved)}>
      {achieved ? <Check size={14} /> : <Icon size={14} />}
      <span>{label} {achieved ? "complete" : "keep trying"}</span>
    </div>
  );
}

function CompletionStat({ value, label, icon: Icon }) {
  return (
    <div style={completionStyles.stat}>
      {Icon ? <Icon size={15} style={completionStyles.statIcon} /> : null}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function GrammarUsedSummary({ level, grammarPoints = [] }) {
  const uniquePoints = grammarPoints.filter(
    (point, index, points) => points.findIndex((candidate) => candidate.id === point.id) === index,
  );

  return (
    <div style={completionStyles.grammarSummary}>
      <div style={completionStyles.grammarSummaryLabel}>{level || "Current level"} grammar used</div>
      {uniquePoints.length ? (
        <div style={completionStyles.grammarChipRow}>
          {uniquePoints.map((point) => (
            <div key={point.id} style={completionStyles.grammarChip}>
              <span lang="ja" style={completionStyles.grammarJapanese}>{point.japanese}</span>
              <span style={completionStyles.grammarScore}>{point.qualityScore}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={completionStyles.grammarEmpty}>
          No {level || "current-level"} grammar points were confidently detected this time.
        </div>
      )}
    </div>
  );
}

function getScoreTier(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Good progress";
  return "Keep building";
}

const completionStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1260,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "18px",
    background: "rgba(2,6,23,0.5)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  card: {
    position: "relative",
    width: "min(410px, 100%)",
    maxHeight: "calc(100dvh - 36px)",
    overflowY: "auto",
    borderRadius: "27px",
    padding: "24px 20px 19px",
    display: "grid",
    justifyItems: "center",
    gap: "11px",
    textAlign: "center",
    border: "1px solid rgba(250,204,21,0.32)",
    background: "linear-gradient(150deg, #172554 0%, #1e3a8a 58%, #164e63 100%)",
    boxShadow: "0 30px 80px rgba(2,6,23,0.46)",
    color: "#fff",
  },
  closeButton: {
    position: "absolute",
    top: "13px",
    right: "13px",
    width: "31px",
    height: "31px",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.74)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },
  icon: { width: "57px", height: "57px", borderRadius: "18px", display: "grid", placeItems: "center", color: "#fef08a", background: "rgba(250,204,21,0.16)" },
  eyebrow: { color: "#fde68a", fontSize: "10px", fontWeight: 850, letterSpacing: "0.13em", textTransform: "uppercase" },
  title: { fontSize: "23px", fontWeight: 850, letterSpacing: "-0.035em" },
  scoreWrap: { display: "flex", alignItems: "baseline", justifyContent: "center", gap: "3px", flexWrap: "wrap" },
  score: { fontSize: "48px", lineHeight: 1, letterSpacing: "-0.055em", color: "#fef08a" },
  scoreOutOf: { fontSize: "15px", color: "rgba(255,255,255,0.62)", fontWeight: 700 },
  scoreTier: { width: "100%", marginTop: "3px", color: "#bfdbfe", fontSize: "12px", fontWeight: 750 },
  summary: { maxWidth: "340px", color: "rgba(255,255,255,0.8)", fontSize: "13px", lineHeight: 1.55 },
  grammarSummary: { width: "100%", boxSizing: "border-box", display: "grid", gap: "8px", padding: "10px 12px", borderRadius: "13px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "left" },
  grammarSummaryLabel: { color: "#bfdbfe", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.055em", fontSize: "9px" },
  grammarChipRow: { display: "flex", flexWrap: "wrap", gap: "7px" },
  grammarChip: { display: "inline-flex", alignItems: "center", gap: "7px", padding: "6px 8px", borderRadius: "999px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.1)" },
  grammarJapanese: { color: "rgba(255,255,255,0.92)", fontSize: "12px", fontWeight: 750 },
  grammarScore: { color: "#d9f99d", fontSize: "10px", fontWeight: 800 },
  grammarEmpty: { color: "rgba(255,255,255,0.68)", fontSize: "11px", lineHeight: 1.45 },
  achievementRow: { display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "7px" },
  achievementBadge: (achieved) => ({ display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 9px", borderRadius: "999px", color: achieved ? "#d9f99d" : "rgba(255,255,255,0.67)", background: achieved ? "rgba(132,204,22,0.16)" : "rgba(255,255,255,0.08)", border: achieved ? "1px solid rgba(190,242,100,0.2)" : "1px solid rgba(255,255,255,0.1)", fontSize: "11px", fontWeight: 750 }),
  stats: { width: "100%", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "7px", marginTop: "2px" },
  stat: { display: "grid", justifyItems: "center", gap: "3px", padding: "10px 4px", borderRadius: "12px", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.66)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.055em" },
  statIcon: { color: "#fb923c", marginBottom: "1px" },
  notes: { width: "100%", display: "grid", gap: "1px", overflow: "hidden", borderRadius: "13px", background: "rgba(255,255,255,0.08)", textAlign: "left" },
  noteRow: { display: "grid", gap: "5px", padding: "10px 11px", color: "rgba(255,255,255,0.8)", fontSize: "11px", lineHeight: 1.45 },
  noteLabel: { color: "#bfdbfe", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.045em", fontSize: "9px" },
  primaryButton: { width: "100%", minHeight: "45px", marginTop: "2px", border: "none", borderRadius: "14px", background: "#facc15", color: "#422006", fontWeight: 850, fontSize: "14px", cursor: "pointer" },
};
