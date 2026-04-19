"use client";

import { useMemo } from "react";
import MetricCard from "@/components/dashboard/MetricCard";
import SubMetricCard from "@/components/dashboard/SubMetricCard";
import StudyDistributionChart from "@/components/dashboard/StudyDistributionChart";

export default function ExpandedTrackerOverview({
  styles,
  isCompact,
  overallMetric,
  primaryMetrics,
  secondaryMetrics,
  distributionItems,
}) {
  const topSource = useMemo(() => {
    return distributionItems.reduce((leadingItem, item) => {
      if (!leadingItem || item.value > leadingItem.value) {
        return item;
      }

      return leadingItem;
    }, null);
  }, [distributionItems]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isCompact ? "1fr" : "minmax(0, 1.05fr) minmax(320px, 0.95fr)",
        gap: "18px",
        alignItems: "start",
      }}
    >
      <section style={panelStyle}>
        <div style={{ display: "grid", gap: "6px" }}>
          <div style={styles.eyebrow}>Focused overview</div>
          <div
            style={{
              fontSize: isCompact ? "24px" : "28px",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "var(--app-text)",
            }}
          >
            Tracker at a glance
          </div>
          <p style={{ ...styles.playerSub, margin: 0, maxWidth: "56ch" }}>
            A wider study view with your tracked totals kept visible while the distribution panel
            highlights how your recorded hours are split.
          </p>
        </div>

        <div style={{ marginTop: "4px" }}>
          <MetricCard
            label={overallMetric.label}
            value={overallMetric.value}
            icon={overallMetric.icon}
            featured
          />
        </div>

        <div
          style={{
            ...styles.metricsGridThree,
            marginTop: 0,
            gridTemplateColumns: isCompact ? "1fr" : "repeat(3, minmax(0, 1fr))",
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

        <div style={{ display: "grid", gap: "10px" }}>
          <div style={styles.eyebrow}>Additional metrics</div>
          <div
            style={{
              ...styles.subMetricsGrid,
              marginTop: 0,
              gridTemplateColumns: isCompact ? "1fr" : "repeat(2, minmax(0, 1fr))",
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
        </div>
      </section>

      <section style={panelStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "6px" }}>
            <div style={styles.eyebrow}>Total study distribution</div>
            <div
              style={{
                fontSize: isCompact ? "22px" : "26px",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "var(--app-text)",
              }}
            >
              Overall study split
            </div>
            <p style={{ ...styles.playerSub, margin: 0, maxWidth: "44ch" }}>
              Hover any segment for a closer read on the tracked hour sources currently driving
              your overall total.
            </p>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderRadius: "999px",
              border: "1px solid var(--app-border-soft)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--app-text-soft)",
              fontSize: "12px",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "999px",
                background: topSource?.color || "rgba(148,163,184,0.8)",
              }}
            />
            {topSource ? `${topSource.label} leads` : "Waiting for tracked hours"}
          </div>
        </div>

        <StudyDistributionChart
          items={distributionItems}
          totalLabel={overallMetric.value}
          totalValue={distributionItems.reduce((sum, item) => sum + Number(item.value || 0), 0)}
        />
      </section>
    </div>
  );
}

const panelStyle = {
  display: "grid",
  gap: "18px",
  padding: "18px",
  borderRadius: "24px",
  border: "1px solid var(--app-border-soft)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
};
