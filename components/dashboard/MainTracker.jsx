"use client";

import { useMemo, useState } from "react";
import { Blocks, Ear, BookOpenText, Gamepad2, Mic2, PenLine } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import SubMetricCard from "@/components/dashboard/SubMetricCard";
import MetricAdjustmentModal from "@/components/dashboard/MetricAdjustmentModal";

export default function MainTracker({
  overallHoursLabel,
  listeningHoursLabel,
  listeningHours,
  wordsReadLabel,
  wordsRead,
  gamingHoursLabel,
  gamingHours,
  shadowingHoursLabel,
  shadowingHours,
  wordsWrittenLabel,
  wordsWritten,
  authControl,
  onAdjustMetric,
  isCompact,
  isAdditionalOpen,
  setIsAdditionalOpen,
  styles,
}) {
  const [selectedMetric, setSelectedMetric] = useState(null);

  const metricConfig = useMemo(
    () => ({
      listening: {
        label: "Listening",
        unitType: "hours",
        currentTotal: listeningHours,
        accent: { bg: "#eab308", soft: "rgba(234,179,8,0.18)", text: "#92400e" },
        icon: Ear,
        iconNode: <Ear size={20} strokeWidth={2} color="#eab308" />,
      },
      reading: {
        label: "Reading",
        unitType: "words",
        currentTotal: wordsRead,
        accent: { bg: "#3b82f6", soft: "rgba(59,130,246,0.18)", text: "#1d4ed8" },
        icon: BookOpenText,
        iconNode: <BookOpenText size={20} strokeWidth={2} color="#3b82f6" />,
      },
      gaming: {
        label: "Gaming",
        unitType: "hours",
        currentTotal: gamingHours,
        accent: { bg: "#8b5cf6", soft: "rgba(139,92,246,0.18)", text: "#6d28d9" },
        icon: Gamepad2,
        iconNode: <Gamepad2 size={20} strokeWidth={2} color="#8b5cf6" />,
      },
      shadowing: {
        label: "Shadowing",
        unitType: "hours",
        currentTotal: shadowingHours,
        accent: { bg: "#ef4444", soft: "rgba(239,68,68,0.18)", text: "#b91c1c" },
        icon: Mic2,
        iconNode: <Mic2 size={20} strokeWidth={2} color="#ef4444" />,
      },
      writing: {
        label: "Writing",
        unitType: "words",
        currentTotal: wordsWritten,
        accent: { bg: "#10b981", soft: "rgba(16,185,129,0.18)", text: "#047857" },
        icon: PenLine,
        iconNode: <PenLine size={20} strokeWidth={2} color="#10b981" />,
      },
    }),
    [gamingHours, listeningHours, shadowingHours, wordsRead, wordsWritten],
  );

  const selectedMetricConfig = selectedMetric ? metricConfig[selectedMetric] : null;

  return (
    <>
      <div style={styles.heroCard}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: isCompact ? "24px" : "35px",
          }}
        >
          <h1
            style={{
              ...styles.title,
              fontSize: isCompact ? "34px" : "44px",
              margin: 0,
            }}
          >
            Japanese Progress
          </h1>

          {authControl}
        </div>

        <div style={styles.overallRow}>
          <MetricCard
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
            label="Listening"
            value={listeningHoursLabel}
            icon={metricConfig.listening.iconNode}
            onAdjust={() => setSelectedMetric("listening")}
          />
          <MetricCard
            label="Reading"
            value={wordsReadLabel}
            icon={metricConfig.reading.iconNode}
            onAdjust={() => setSelectedMetric("reading")}
          />
          <MetricCard
            label="Gaming"
            value={gamingHoursLabel}
            icon={metricConfig.gaming.iconNode}
            onAdjust={() => setSelectedMetric("gaming")}
          />
        </div>

        <details
          style={styles.expandableWrap}
          open={isAdditionalOpen}
          onToggle={(event) => setIsAdditionalOpen(event.currentTarget.open)}
        >
          <summary style={styles.expandableSummary}>
            <span>Additional metrics</span>
            <span
              style={{
                display: "inline-block",
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderBottom: isAdditionalOpen ? "8px solid #cbd5e1" : "none",
                borderTop: isAdditionalOpen ? "none" : "8px solid #cbd5e1",
              }}
            />
          </summary>

          <div
            style={{
              ...styles.subMetricsGrid,
              gridTemplateColumns: isCompact ? "1fr" : "repeat(2, minmax(0, 1fr))",
            }}
          >
            <SubMetricCard
              label="Shadowing"
              value={shadowingHoursLabel}
              icon={metricConfig.shadowing.iconNode}
              onAdjust={() => setSelectedMetric("shadowing")}
            />
            <SubMetricCard
              label="Written"
              value={wordsWrittenLabel}
              icon={metricConfig.writing.iconNode}
              onAdjust={() => setSelectedMetric("writing")}
            />
          </div>
        </details>
      </div>

      {selectedMetricConfig && (
        <MetricAdjustmentModal
          key={selectedMetric}
          open
          metricLabel={selectedMetricConfig.label}
          icon={selectedMetricConfig.icon}
          accent={selectedMetricConfig.accent}
          currentTotal={selectedMetricConfig.currentTotal}
          unitType={selectedMetricConfig.unitType}
          onApply={(amount) => selectedMetric && onAdjustMetric(selectedMetric, amount)}
          onClose={() => setSelectedMetric(null)}
        />
      )}
    </>
  );
}
