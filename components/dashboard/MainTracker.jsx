import { Blocks, Ear, BookOpenText, Gamepad2 } from "lucide-react";

export default function MainTracker({
  overallHoursLabel,
  listeningHoursLabel,
  wordsReadLabel,
  gamingHoursLabel,
  shadowingHoursLabel,
  wordsWrittenLabel,
  isCompact,
  isAdditionalOpen,
  setIsAdditionalOpen,
  setListeningHours,
  setWordsRead,
  setGamingHours,
  setShadowingHours,
  setWordsWritten,
  styles,
}) {
  return (
    <div style={styles.heroCard}>
      <h1
        style={{
          ...styles.title,
          fontSize: isCompact ? "34px" : "44px",
          marginBottom: isCompact ? "24px" : "35px",
        }}
      >
        Japanese Progress
      </h1>

      <div style={styles.overallRow}>
        <MetricCard
          styles={styles}
          label="Overall hours"
          value={overallHoursLabel}
          icon={<Blocks size={20} strokeWidth={2} color="#ef4444" />}
          featured
        />
      </div>

      <div
        style={{
          ...styles.metricsGridThree,
          gridTemplateColumns: isCompact ? "1fr" : "repeat(3, 1fr)",
        }}
      >
        <MetricCard
          styles={styles}
          label="Listening"
          value={listeningHoursLabel}
          icon={<Ear size={20} strokeWidth={2} color="#eab308" />}
          onQuickAdd={() => setListeningHours((v) => v + 1)}
          quickAddLabel="+1h"
        />
        <MetricCard
          styles={styles}
          label="Reading"
          value={wordsReadLabel}
          icon={<BookOpenText size={20} strokeWidth={2} color="#3b82f6" />}
          onQuickAdd={() => setWordsRead((v) => v + 1000)}
          quickAddLabel="+1k"
        />
        <MetricCard
          styles={styles}
          label="Gaming"
          value={gamingHoursLabel}
          icon={<Gamepad2 size={20} strokeWidth={2} color="#8b5cf6" />}
          onQuickAdd={() => setGamingHours((v) => v + 1)}
          quickAddLabel="+1h"
        />
      </div>

      <details
        style={styles.expandableWrap}
        open={isAdditionalOpen}
        onToggle={(e) => setIsAdditionalOpen(e.currentTarget.open)}
      >
        <summary style={styles.expandableSummary}>
          <span>Additional metrics</span>
          <span style={styles.expandableArrow}>{isAdditionalOpen ? "▲" : "▼"}</span>
        </summary>

        <div
          style={{
            ...styles.subMetricsGrid,
            gridTemplateColumns: isCompact ? "1fr" : "repeat(2, minmax(0, 1fr))",
          }}
        >
          <SubMetricCard
            styles={styles}
            label="Shadowing"
            value={shadowingHoursLabel}
            onQuickAdd={() => setShadowingHours((v) => v + 0.5)}
            quickAddLabel="+0.5h"
          />
          <SubMetricCard
            styles={styles}
            label="Written"
            value={wordsWrittenLabel}
            onQuickAdd={() => setWordsWritten((v) => v + 500)}
            quickAddLabel="+500"
          />
        </div>
      </details>
    </div>
  );
}

function MetricCard({ styles, label, value, icon, onQuickAdd, quickAddLabel = "+1", featured = false }) {
  return (
    <div style={styles.metricCard(featured)}>
      <div style={styles.metricTopRow}>
        <div style={styles.metricIconWrap(featured)}>{icon}</div>
        {onQuickAdd && (
          <button onClick={onQuickAdd} style={styles.quickAddButton}>
            {quickAddLabel}
          </button>
        )}
      </div>

      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue(featured)}>{value}</div>
    </div>
  );
}

function SubMetricCard({ styles, label, value, onQuickAdd, quickAddLabel = "+1" }) {
  return (
    <div style={styles.metricCard(false)}>
      <div style={styles.metricTopRow}>
        <div style={styles.metricLabel}>{label}</div>
        {onQuickAdd && (
          <button onClick={onQuickAdd} style={styles.quickAddButtonSub}>
            {quickAddLabel}
          </button>
        )}
      </div>

      <div style={styles.metricValue(false)}>{value}</div>
    </div>
  );
}
