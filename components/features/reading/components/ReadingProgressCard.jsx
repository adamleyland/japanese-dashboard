"use client";

import { BookOpenText, RefreshCcw, SlidersHorizontal } from "lucide-react";
import NumberField from "@/components/ui/NumberField";
import ReadingEmptyState from "@/components/features/reading/components/ReadingEmptyState";
import { formatReadingWords, formatReadingWordsCompact } from "@/lib/reading/normalizers";

export default function ReadingProgressCard({
  styles,
  isMobile = false,
  isCompact = false,
  totalWordsRead,
  goalWords,
  setGoalWords,
  loading,
  error,
  configured,
  currentBook,
  onRefresh,
  settingsOpen,
  setSettingsOpen,
}) {
  const safeWordsRead = Math.max(0, Math.round(Number(totalWordsRead) || 0));
  const safeGoalWords = Math.max(1, Math.round(Number(goalWords) || 1));
  const progress = Math.min(100, (safeWordsRead / safeGoalWords) * 100);
  const remainingWords = Math.max(0, safeGoalWords - safeWordsRead);
  const mobileProgressSummary = formatReadingWordsCompact(safeWordsRead);

  if (!configured && !loading) {
    return (
      <div style={styles.sideCard}>
        <ReadingEmptyState
          label="LingQ sync is ready for wiring. Add LINGQ_API_KEY to enable automatic words-read totals."
          align="left"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.sideCard}>
        <ReadingEmptyState label={error} tone="error" align="left" />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div
        style={{
          ...styles.sideCard,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: isCompact ? "16px" : "18px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--app-text)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          title={formatReadingWords(safeWordsRead)}
          aria-label={`LingQ total words read ${formatReadingWords(safeWordsRead)}`}
        >
          {mobileProgressSummary}
        </div>

        <div
          style={{
            flex: "1 1 auto",
            minWidth: 0,
          }}
        >
          <div
            style={{
              ...styles.progressBarWrap,
              height: "10px",
              borderRadius: "999px",
            }}
            aria-hidden="true"
          >
            <div
              style={{
                ...styles.progressBarFill(progress),
                background: "#3b82f6",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.sideCard}>
      <div
        style={{
          ...styles.wordCardHeader,
          marginBottom: "8px",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div style={styles.progressContainer}>
            <div
              style={{
                ...styles.dictionaryIconFootprint,
                background: "rgba(59,130,246,0.16)",
                border: "1px solid rgba(59,130,246,0.18)",
              }}
            >
              <BookOpenText size={14} color="#3b82f6" strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
            <div style={styles.eyebrow}>LingQ Progress</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setSettingsOpen((currentValue) => !currentValue)}
            style={styles.iconBadgeBtn}
            aria-label={settingsOpen ? "Hide reading goal settings" : "Show reading goal settings"}
          >
            <SlidersHorizontal size={16} />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            style={styles.iconBadgeBtn}
            aria-label="Refresh LingQ stats"
          >
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>

      <div style={styles.visualMainStats}>
        <div style={styles.visualLargeValue}>{formatReadingWords(safeWordsRead)}</div>
        <p
          style={{
            textAlign: "center",
            fontSize: "11px",
            textTransform: "uppercase",
            color: "var(--app-text-muted)",
            margin: "-5px 0 10px 0",
            letterSpacing: "0.05em",
          }}
        >
          Total LingQ Words Read
        </p>
      </div>

      <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
        <div style={styles.progressBarWrap}>
          <div
            style={{
              ...styles.progressBarFill(progress),
              background: "#3b82f6",
            }}
          />
          <div style={styles.progressBarLabel}>
            <span>{Math.round(progress)}%</span>
            <span>to goal</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "8px",
          }}
        >
          <SummaryPill label="Goal" value={formatReadingWords(safeGoalWords)} />
          <SummaryPill label="Remaining" value={formatReadingWords(remainingWords)} />
        </div>
      </div>

      {settingsOpen ? (
        <div style={{ ...styles.goalGrid, marginBottom: "14px" }}>
          <NumberField
            label="Reading goal"
            value={safeGoalWords}
            onChange={setGoalWords}
            step={50000}
            mobileOptimized={isCompact}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "8px",
            }}
          >
            {[1000000, 3000000, 5000000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setGoalWords(preset)}
                style={styles.adjustBtn}
              >
                {formatReadingWords(preset)}
              </button>
            ))}
          </div>
        </div>
        ) : null}

      {loading && !safeWordsRead ? (
        <div style={{ ...styles.playerSub, padding: "8px 0" }}>Loading LingQ reading stats...</div>
      ) : null}

      <div
        style={{
          borderRadius: "18px",
          border: "1px solid var(--app-border-soft)",
          background: "var(--app-surface-elevated)",
          padding: "14px",
          display: "grid",
          gap: "6px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--app-text-muted)",
          }}
        >
          Focus
        </div>
        <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.02em" }}>
          {currentBook ? currentBook.title : "Build your next reading streak"}
        </div>
        <div style={{ ...styles.playerSub, margin: 0 }}>
          {currentBook
            ? currentBook.subtitle || currentBook.author || currentBook.progressLabel || "Latest LingQ lesson"
            : "Your LingQ total is ready. Mark a book as currently reading to tie this progress to a title."}
        </div>
      </div>
    </div>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div
      style={{
        borderRadius: "14px",
        border: "1px solid var(--app-border-soft)",
        background: "var(--app-surface-elevated)",
        padding: "10px 12px",
        display: "grid",
        gap: "3px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: "var(--app-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "18px", fontWeight: 800 }}>{value}</div>
    </div>
  );
}

