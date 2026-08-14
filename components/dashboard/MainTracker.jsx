"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Blocks, Ear, BookOpenText, Clock3, Gamepad2, Mic2, PenLine } from "lucide-react";
import ExpandedTrackerOverview from "@/components/dashboard/ExpandedTrackerOverview";
import MetricCard from "@/components/dashboard/MetricCard";
import MetricAdjustmentModal from "@/components/dashboard/MetricAdjustmentModal";
import ListeningHistoryModal from "@/components/dashboard/ListeningHistoryModal";
import SubMetricCard from "@/components/dashboard/SubMetricCard";
import TrackerFocusToggle from "@/components/dashboard/TrackerFocusToggle";

export default function MainTracker({
  overallHoursLabel,
  listeningHoursLabel,
  listeningHours,
  wordsReadLabel,
  wordsRead,
  estimatedReadingHours,
  estimatedWritingHours,
  gamingHoursLabel,
  gamingHours,
  shadowingHoursLabel,
  shadowingHours,
  writingHoursLabel,
  wordsWrittenLabel,
  wordsWritten,
  authControl,
  authUserId,
  onAdjustMetric,
  isMobile,
  isCompact,
  isVisible = true,
  focusMode,
  onToggleFocusMode,
  isAdditionalOpen,
  setIsAdditionalOpen,
  styles,
}) {
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [isListeningHistoryOpen, setIsListeningHistoryOpen] = useState(false);

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
      {
        key: "writing",
        label: "Writing",
        value: estimatedWritingHours,
        valueLabel: writingHoursLabel,
        color: "#10b981",
        colorSoft: "rgba(16,185,129,0.18)",
        unitLabel: "Hours",
      },
    ],
    [
      gamingHours,
      gamingHoursLabel,
      estimatedReadingHours,
      estimatedWritingHours,
      listeningHours,
      listeningHoursLabel,
      shadowingHours,
      shadowingHoursLabel,
      writingHoursLabel,
    ],
  );

  const selectedMetricConfig = selectedMetric ? metricConfig[selectedMetric] : null;
  const mobileTrackerMetrics = useMemo(
    () => [
      {
        key: "reading",
        label: metricConfig.reading.label,
        icon: metricConfig.reading.icon,
        accent: metricConfig.reading.accent,
        onAdjust: () => setSelectedMetric("reading"),
      },
      {
        key: "shadowing",
        label: metricConfig.shadowing.label,
        icon: metricConfig.shadowing.icon,
        accent: metricConfig.shadowing.accent,
        onAdjust: () => setSelectedMetric("shadowing"),
      },
      {
        key: "writing",
        label: metricConfig.writing.label,
        icon: metricConfig.writing.icon,
        accent: metricConfig.writing.accent,
        onAdjust: () => setSelectedMetric("writing"),
      },
      {
        key: "gaming",
        label: metricConfig.gaming.label,
        icon: metricConfig.gaming.icon,
        accent: metricConfig.gaming.accent,
        onAdjust: () => setSelectedMetric("gaming"),
      },
      {
        key: "listening",
        label: metricConfig.listening.label,
        icon: metricConfig.listening.icon,
        accent: metricConfig.listening.accent,
        onAdjust: () => setSelectedMetric("listening"),
      },
    ],
    [metricConfig],
  );

  return (
    <>
      <motion.div
        initial={false}
        animate={
          isMobile
            ? isVisible
              ? mobileMotion.visible
              : mobileMotion.hidden
            : mobileMotion.static
        }
        transition={mobileMotion.transition}
        style={isMobile ? mobileStyles.dashboardShell : styles.heroCard}
      >
        {isMobile ? (
          <div style={mobileStyles.dashboardGrid}>
            <section style={mobileStyles.overallCard}>
              <div style={mobileStyles.overallHeaderRow}>
                <div style={mobileStyles.overallEyebrow}>Tracker dashboard</div>
              </div>

              <div style={mobileStyles.overallValue}>{overallHoursLabel}</div>
            </section>

            <div style={mobileStyles.metricCardGrid}>
              {mobileTrackerMetrics.map((metric) => {
                const Icon = metric.icon;
                const metricValue =
                  metric.key === "listening"
                    ? listeningHoursLabel
                    : metric.key === "reading"
                      ? wordsReadLabel
                      : metric.key === "shadowing"
                        ? shadowingHoursLabel
                        : metric.key === "writing"
                          ? wordsWrittenLabel
                          : gamingHoursLabel;

                return (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={metric.onAdjust}
                    style={mobileStyles.metricDashboardCard(metric.key === "listening")}
                    aria-label={`Adjust ${metric.label}`}
                    title={metric.label}
                  >
                    <div style={mobileStyles.metricDashboardTopRow}>
                      <div style={mobileStyles.metricDashboardIcon(metric.accent)}>
                        <Icon size={18} strokeWidth={2.1} color={metric.accent.bg} />
                      </div>
                    </div>

                    <div style={mobileStyles.metricDashboardLabel}>{metric.label}</div>
                    <div style={mobileStyles.metricDashboardValue}>{metricValue}</div>
                  </button>
                );
              })}
            </div>

            <button type="button" onClick={() => setIsListeningHistoryOpen(true)} style={mobileStyles.listeningHistoryButton} aria-label="View manual listening history">
              <Clock3 size={17} strokeWidth={2.1} />
              <span>Listening history</span>
            </button>
          </div>
        ) : (
          <>
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
                <TrackerFocusToggle
                  active={focusMode}
                  onToggle={onToggleFocusMode}
                  compact={isCompact}
                />
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
      </motion.div>

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

      {isMobile && <ListeningHistoryModal open={isListeningHistoryOpen} userId={authUserId} onClose={() => setIsListeningHistoryOpen(false)} />}
    </>
  );
}

const mobileMotion = {
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
  },
  hidden: {
    y: 44,
    opacity: 0,
    scale: 0.96,
  },
  static: {
    y: 0,
    opacity: 1,
    scale: 1,
  },
  transition: {
    duration: 0.36,
    ease: [0.22, 1, 0.36, 1],
  },
};

const mobileStyles = {
  dashboardShell: {
    borderRadius: "28px",
    border: "var(--app-glass-border)",
    background: "var(--app-glass-bg)",
    boxShadow: "var(--app-glass-shadow)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "14px",
    minHeight: 0,
    height: "100%",
  },
  dashboardGrid: {
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    gap: "12px",
    width: "100%",
    height: "100%",
    minHeight: 0,
  },
  overallCard: {
    borderRadius: "22px",
    border: "1px solid rgba(255,255,255,0.82)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.76) 100%)",
    boxShadow: "0 16px 32px rgba(15,23,42,0.1)",
    padding: "14px",
    display: "grid",
    gap: "10px",
    minWidth: 0,
  },
  overallHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  overallEyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  overallValue: {
    fontSize: "34px",
    fontWeight: 800,
    letterSpacing: "-0.05em",
    lineHeight: 1,
    color: "var(--app-text)",
  },
  metricCardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    minHeight: 0,
    alignContent: "end",
  },
  metricDashboardCard: (isPrimaryAction = false) => ({
    width: "100%",
    minHeight: isPrimaryAction ? "92px" : "88px",
    gridColumn: isPrimaryAction ? "1 / -1" : "auto",
    borderRadius: "20px",
    border: isPrimaryAction ? "1px solid rgba(234,179,8,0.32)" : "1px solid var(--app-border-soft)",
    background: isPrimaryAction
      ? "linear-gradient(135deg, rgba(254,249,195,0.96), rgba(254,243,199,0.88))"
      : "var(--app-card-muted)",
    display: "grid",
    gap: "10px",
    textAlign: "left",
    cursor: "pointer",
    padding: "12px",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
    touchAction: "manipulation",
  }),
  metricDashboardTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricDashboardIcon: (accent) => ({
    width: "36px",
    height: "36px",
    borderRadius: "12px",
    border: "1px solid var(--app-border)",
    background: accent.soft,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  }),
  metricDashboardLabel: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  metricDashboardValue: {
    fontSize: "24px",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    color: "var(--app-text)",
  },
  listeningHistoryButton: {
    width: "100%",
    minHeight: "46px",
    borderRadius: "14px",
    border: "1px solid rgba(234,179,8,0.3)",
    background: "rgba(234,179,8,0.1)",
    color: "#92400e",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
};
