"use client";

import { useMemo, useState } from "react";
import { Blocks, Ear, BookOpenText, Gamepad2, Mic2, PenLine } from "lucide-react";
import ExpandedTrackerOverview from "@/components/dashboard/ExpandedTrackerOverview";
import MetricCard from "@/components/dashboard/MetricCard";
import MetricAdjustmentModal from "@/components/dashboard/MetricAdjustmentModal";
import SubMetricCard from "@/components/dashboard/SubMetricCard";
import TrackerFocusToggle from "@/components/dashboard/TrackerFocusToggle";

export default function MainTracker({
  overallHoursLabel,
  listeningHoursLabel,
  listeningHours,
  wordsReadLabel,
  wordsRead,
  estimatedReadingHours,
  gamingHoursLabel,
  gamingHours,
  shadowingHoursLabel,
  shadowingHours,
  wordsWrittenLabel,
  wordsWritten,
  authControl,
  onAdjustMetric,
  isCompact,
  focusMode,
  onToggleFocusMode,
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

  const overallMetric = useMemo(
    () => ({
      label: "Overall hours",
      value: overallHoursLabel,
      icon: <Blocks size={20} strokeWidth={2} color="#ef4444" />,
    }),
    [overallHoursLabel],
  );

  const primaryMetrics = useMemo(
    () => [
      {
        key: "listening",
        label: "Listening",
        value: listeningHoursLabel,
        icon: metricConfig.listening.iconNode,
        onAdjust: () => setSelectedMetric("listening"),
      },
      {
        key: "reading",
        label: "Reading",
        value: wordsReadLabel,
        icon: metricConfig.reading.iconNode,
        onAdjust: () => setSelectedMetric("reading"),
      },
      {
        key: "gaming",
        label: "Gaming",
        value: gamingHoursLabel,
        icon: metricConfig.gaming.iconNode,
        onAdjust: () => setSelectedMetric("gaming"),
      },
    ],
    [gamingHoursLabel, listeningHoursLabel, metricConfig, wordsReadLabel],
  );

  const secondaryMetrics = useMemo(
    () => [
      {
        key: "shadowing",
        label: "Shadowing",
        value: shadowingHoursLabel,
        icon: metricConfig.shadowing.iconNode,
        onAdjust: () => setSelectedMetric("shadowing"),
      },
      {
        key: "writing",
        label: "Written",
        value: wordsWrittenLabel,
        icon: metricConfig.writing.iconNode,
        onAdjust: () => setSelectedMetric("writing"),
      },
    ],
    [metricConfig, shadowingHoursLabel, wordsWrittenLabel],
  );

  const distributionItems = useMemo(
    () => [
      {
        key: "listening",
        label: "Listening",
        value: listeningHours,
        valueLabel: listeningHoursLabel,
        color: "#eab308",
        colorSoft: "rgba(234,179,8,0.18)",
        unitLabel: "Hours",
      },
      {
        key: "reading",
        label: "Reading",
        value: estimatedReadingHours,
        valueLabel: `${estimatedReadingHours.toLocaleString()}h`,
        color: "#3b82f6",
        colorSoft: "rgba(59,130,246,0.18)",
        unitLabel: "Hours",
      },
      {
        key: "gaming",
        label: "Gaming",
        value: gamingHours,
        valueLabel: gamingHoursLabel,
        color: "#8b5cf6",
        colorSoft: "rgba(139,92,246,0.18)",
        unitLabel: "Hours",
      },
      {
        key: "shadowing",
        label: "Shadowing",
        value: shadowingHours,
        valueLabel: shadowingHoursLabel,
        color: "#ef4444",
        colorSoft: "rgba(239,68,68,0.18)",
        unitLabel: "Hours",
      },
    ],
    [
      gamingHours,
      gamingHoursLabel,
      estimatedReadingHours,
      listeningHours,
      listeningHoursLabel,
      shadowingHours,
      shadowingHoursLabel,
    ],
  );

  const selectedMetricConfig = selectedMetric ? metricConfig[selectedMetric] : null;
  const mobileMetrics = useMemo(
    () => [...primaryMetrics, ...secondaryMetrics],
    [primaryMetrics, secondaryMetrics],
  );

  return (
    <>
      <div style={styles.heroCard}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: isCompact ? "wrap" : "nowrap",
            marginBottom: isCompact ? "24px" : "35px",
          }}
        >
          <h1
            style={{
              ...styles.title,
              fontSize: isCompact ? "34px" : "30px",
              margin: 0,
            }}
          >
            Japanese Tracker
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "10px",
              flexWrap: "wrap",
              marginLeft: "auto",
              width: isCompact ? "100%" : "auto",
            }}
          >
            {authControl}
            <TrackerFocusToggle active={focusMode} onToggle={onToggleFocusMode} compact={isCompact} />
          </div>
        </div>

        {focusMode ? (
          <ExpandedTrackerOverview
            styles={styles}
            isCompact={isCompact}
            overallMetric={overallMetric}
            primaryMetrics={primaryMetrics}
            secondaryMetrics={secondaryMetrics}
            distributionItems={distributionItems}
          />
        ) : (
          <>
            <div style={styles.overallRow}>
              <MetricCard
                label={overallMetric.label}
                value={overallMetric.value}
                icon={overallMetric.icon}
                featured
                compact={isCompact}
              />
            </div>

            {isCompact ? (
              <div
                className="tracker-mobile-carousel"
                style={mobileStyles.metricsScroller}
              >
                {mobileMetrics.map((metric) => (
                  <div key={metric.key} style={mobileStyles.metricSlide}>
                    <MetricCard
                      label={metric.label}
                      value={metric.value}
                      icon={metric.icon}
                      onAdjust={metric.onAdjust}
                      compact
                    />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div
                  style={{
                    ...styles.metricsGridThree,
                    gridTemplateColumns: "repeat(3, 1fr)",
                  }}
                >
                  {primaryMetrics.map((metric) => (
                    <MetricCard
                      key={metric.key}
                      label={metric.label}
                      value={metric.value}
                      icon={metric.icon}
                      onAdjust={metric.onAdjust}
                    />
                  ))}
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
                        borderBottom: isAdditionalOpen ? "8px solid var(--app-text-faint)" : "none",
                        borderTop: isAdditionalOpen ? "none" : "8px solid var(--app-text-faint)",
                      }}
                    />
                  </summary>

                  <div
                    style={{
                      ...styles.subMetricsGrid,
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    }}
                  >
                    {secondaryMetrics.map((metric) => (
                      <SubMetricCard
                        key={metric.key}
                        label={metric.label}
                        value={metric.value}
                        icon={metric.icon}
                        onAdjust={metric.onAdjust}
                      />
                    ))}
                  </div>
                </details>
              </>
            )}
          </>
        )}
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
          mobileOptimized={isCompact}
          onApply={(amount) => selectedMetric && onAdjustMetric(selectedMetric, amount)}
          onClose={() => setSelectedMetric(null)}
        />
      )}
    </>
  );
}

const mobileStyles = {
  metricsScroller: {
    display: "flex",
    gap: "12px",
    overflowX: "auto",
    overflowY: "hidden",
    padding: "2px 4px 8px 4px",
    margin: "12px -4px 0 -4px",
    WebkitOverflowScrolling: "touch",
    overscrollBehaviorX: "contain",
    touchAction: "pan-x",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    scrollSnapType: "x proximity",
  },
  metricSlide: {
    flex: "0 0 min(84vw, 236px)",
    minWidth: "min(84vw, 236px)",
    scrollSnapAlign: "start",
  },
};
