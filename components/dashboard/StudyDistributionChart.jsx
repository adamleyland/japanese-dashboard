"use client";

import { useMemo, useRef, useState } from "react";
import StudyDistributionTooltip from "@/components/dashboard/StudyDistributionTooltip";

const CHART_SIZE = 260;
const STROKE_WIDTH = 30;
const TRACK_RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * TRACK_RADIUS;
const ARC_GAP = 8;

export default function StudyDistributionChart({
  items,
  totalLabel,
  totalValue,
  centerLabel = "Tracked hours",
}) {
  const containerRef = useRef(null);
  const [activeKey, setActiveKey] = useState(null);
  const [tooltipState, setTooltipState] = useState(null);

  const chartItems = useMemo(() => {
    const positiveItems = items.filter((item) => Number(item.value) > 0);
    const resolvedTotal =
      totalValue && totalValue > 0
        ? totalValue
        : positiveItems.reduce((sum, item) => sum + Number(item.value || 0), 0);

    return positiveItems
      .sort((left, right) => Number(right.value || 0) - Number(left.value || 0))
      .reduce(
        (result, item, index) => {
          const value = Number(item.value || 0);
          const ratio = resolvedTotal > 0 ? value / resolvedTotal : 0;
          const rawLength = ratio * CIRCUMFERENCE;
          const visibleLength = Math.max(rawLength - ARC_GAP, 0);
          const midPoint = result.accumulatedLength + rawLength / 2;
          const midAngle = (midPoint / CIRCUMFERENCE) * Math.PI * 2 - Math.PI / 2;

          return {
            segments: result.segments.concat({
              ...item,
              rank: index + 1,
              ratio,
              dashArray: `${visibleLength} ${CIRCUMFERENCE}`,
              dashOffset: -result.accumulatedLength,
              percentageLabel: formatPercentageLabel(ratio),
              midAngle,
              midPoint,
            }),
            accumulatedLength: result.accumulatedLength + rawLength,
          };
        },
        { segments: [], accumulatedLength: 0 },
      ).segments;
  }, [items, totalValue]);

  const resolvedTotalValue = useMemo(
    () => chartItems.reduce((sum, item) => sum + Number(item.value || 0), 0),
    [chartItems],
  );

  const clearTooltip = () => {
    setActiveKey(null);
    setTooltipState(null);
  };

  const setTooltipFromPointer = (item, event) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    setActiveKey(item.key);
    setTooltipState({
      datum: item,
      position: {
        x: clamp(event.clientX - bounds.left, 42, bounds.width - 42),
        y: clamp(event.clientY - bounds.top, 42, bounds.height - 42),
      },
    });
  };

  const setTooltipFromAngle = (item) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    const orbitRadius = TRACK_RADIUS - STROKE_WIDTH * 0.15;
    const x = CHART_SIZE / 2 + Math.cos(item.midAngle) * orbitRadius;
    const y = CHART_SIZE / 2 + Math.sin(item.midAngle) * orbitRadius;

    setActiveKey(item.key);
    setTooltipState({
      datum: item,
      position: {
        x: clamp(x, 42, bounds.width - 42),
        y: clamp(y, 42, bounds.height - 42),
      },
    });
  };

  if (!chartItems.length || resolvedTotalValue <= 0) {
    return (
      <div
        style={{
          borderRadius: "22px",
          border: "1px dashed var(--app-border-soft)",
          background: "rgba(15,23,42,0.16)",
          minHeight: "240px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          color: "var(--app-text-muted)",
          fontSize: "13px",
          lineHeight: 1.6,
        }}
      >
        Study distribution will appear once tracked hour sources have recorded time.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          minHeight: `${CHART_SIZE}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={CHART_SIZE}
          height={CHART_SIZE}
          viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
          role="img"
          aria-label="Study distribution donut chart"
          style={{ overflow: "visible" }}
        >
          <defs>
            {chartItems.map((item) => (
              <filter
                key={`${item.key}-glow`}
                id={`study-distribution-glow-${item.key}`}
                x="-40%"
                y="-40%"
                width="180%"
                height="180%"
              >
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={item.color} floodOpacity="0.3" />
              </filter>
            ))}
          </defs>

          <circle
            cx={CHART_SIZE / 2}
            cy={CHART_SIZE / 2}
            r={TRACK_RADIUS}
            fill="none"
            stroke="rgba(148,163,184,0.14)"
            strokeWidth={STROKE_WIDTH}
          />

          <g transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}>
            {chartItems.map((item) => {
              const isActive = item.key === activeKey;
              const isMuted = activeKey && !isActive;

              return (
                <circle
                  key={item.key}
                  cx={CHART_SIZE / 2}
                  cy={CHART_SIZE / 2}
                  r={TRACK_RADIUS}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={isActive ? STROKE_WIDTH + 4 : STROKE_WIDTH}
                  strokeDasharray={item.dashArray}
                  strokeDashoffset={item.dashOffset}
                  strokeLinecap="round"
                  tabIndex={0}
                  aria-label={`${item.label}: ${item.valueLabel}, ${item.percentageLabel} of tracked hours`}
                  onMouseEnter={(event) => setTooltipFromPointer(item, event)}
                  onMouseMove={(event) => setTooltipFromPointer(item, event)}
                  onMouseLeave={clearTooltip}
                  onFocus={() => setTooltipFromAngle(item)}
                  onBlur={clearTooltip}
                  style={{
                    cursor: "pointer",
                    opacity: isMuted ? 0.34 : 1,
                    filter: isActive ? `url(#study-distribution-glow-${item.key})` : "none",
                    transition: "opacity 180ms ease, stroke-width 180ms ease, filter 180ms ease",
                    outline: "none",
                  }}
                />
              );
            })}
          </g>
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "132px",
              height: "132px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(180deg, rgba(15,23,42,0.42), rgba(15,23,42,0.2))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              display: "grid",
              alignContent: "center",
              justifyItems: "center",
              gap: "4px",
              textAlign: "center",
              padding: "16px",
            }}
          >
            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "var(--app-text)",
                lineHeight: 1,
              }}
            >
              {totalLabel}
            </div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--app-text-muted)",
              }}
            >
              {centerLabel}
            </div>
          </div>
        </div>

        <StudyDistributionTooltip
          datum={tooltipState?.datum}
          position={tooltipState?.position}
        />
      </div>

      <div style={{ display: "grid", gap: "10px" }}>
        {chartItems.map((item) => {
          const isActive = item.key === activeKey;

          return (
            <button
              key={item.key}
              type="button"
              onMouseEnter={() => setTooltipFromAngle(item)}
              onMouseLeave={clearTooltip}
              onFocus={() => setTooltipFromAngle(item)}
              onBlur={clearTooltip}
              style={{
                display: "grid",
                gridTemplateColumns: "auto minmax(0, 1fr) auto",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                padding: "10px 12px",
                borderRadius: "16px",
                border: isActive
                  ? `1px solid ${item.color}`
                  : "1px solid var(--app-border-soft)",
                background: isActive
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(255,255,255,0.03)",
                color: "var(--app-text)",
                cursor: "pointer",
                transition: "border-color 180ms ease, background 180ms ease, transform 180ms ease",
                textAlign: "left",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "999px",
                  background: item.color,
                  boxShadow: `0 0 0 6px ${item.colorSoft}`,
                  flexShrink: 0,
                }}
              />

              <span style={{ minWidth: 0, display: "grid", gap: "3px" }}>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--app-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 700,
                  }}
                >
                  {item.valueLabel}
                </span>
              </span>

              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: isActive ? item.color : "var(--app-text-soft)",
                  whiteSpace: "nowrap",
                }}
              >
                {item.percentageLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatPercentageLabel(value) {
  const percentage = value * 100;
  return `${percentage >= 10 ? percentage.toFixed(0) : percentage.toFixed(1)}%`;
}
