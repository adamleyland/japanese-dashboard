"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetchTrackingActivityByDateRange } from "@/lib/trackingEvents";

const METRIC_ACCENTS = {
  listening: "#eab308",
  reading: "#3b82f6",
  gaming: "#8b5cf6",
  shadowing: "#ef4444",
  writing: "#10b981",
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPopover({ authUserId, onClose, isCompact }) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [activityByDate, setActivityByDate] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    const loadActivity = async () => {
      if (!authUserId) {
        setActivityByDate({});
        return;
      }

      setIsLoading(true);
      const monthStart = startOfMonth(visibleMonth);
      const monthEnd = endOfMonth(visibleMonth);
      const activity = await fetchTrackingActivityByDateRange(authUserId, monthStart, monthEnd);

      if (!cancelled) {
        setActivityByDate(activity || {});
        setIsLoading(false);
      }
    };

    void loadActivity();

    return () => {
      cancelled = true;
    };
  }, [authUserId, visibleMonth]);

  const monthLabel = useMemo(
    () =>
      visibleMonth.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [visibleMonth],
  );

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  return (
    <div style={styles.popover(isCompact)} role="dialog" aria-modal="false" aria-label="Calendar">
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Calendar</div>
          <div style={styles.title}>{monthLabel}</div>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"
            onClick={() => setVisibleMonth((currentMonth) => addMonths(currentMonth, -1))}
            style={styles.iconButton}
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setVisibleMonth((currentMonth) => addMonths(currentMonth, 1))}
            style={styles.iconButton}
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} style={styles.weekdayLabel}>
            {label}
          </div>
        ))}
      </div>

      <div style={styles.grid}>
        {calendarDays.map((day) => {
          const isoDate = toIsoDate(day.date);
          const dayActivity = activityByDate[isoDate] || null;
          const metricKeys = dayActivity ? Object.keys(dayActivity.metrics || {}) : [];
          const isToday = isSameDate(day.date, new Date());
          const isCurrentMonth = day.inCurrentMonth;

          return (
            <div
              key={isoDate}
              style={styles.dayCell({
                hasActivity: metricKeys.length > 0,
                isCurrentMonth,
                isToday,
              })}
            >
              <div style={styles.dayNumber(isCurrentMonth, isToday)}>{day.date.getDate()}</div>

              <div style={styles.metricStripRow}>
                {metricKeys.slice(0, 5).map((metric) => (
                  <span
                    key={metric}
                    style={{
                      ...styles.metricStrip,
                      background: METRIC_ACCENTS[metric] || "#cbd5e1",
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={styles.footer}>
        {authUserId ? (
          isLoading ? (
            <span>Loading tracked days...</span>
          ) : (
            <span>Colored markers show dates with saved metric activity.</span>
          )
        ) : (
          <span>Sign in to see tracked metric dates.</span>
        )}
      </div>
    </div>
  );
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfWeek(date) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + mondayOffset);
}

function buildCalendarDays(monthDate) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart);
  const days = [];
  const cursor = new Date(gridStart);

  while (days.length < 42) {
    days.push({
      date: new Date(cursor),
      inCurrentMonth: cursor >= monthStart && cursor <= monthEnd,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

const styles = {
  popover: (isCompact) => ({
    position: "absolute",
    top: "calc(100% + 10px)",
    left: 0,
    width: isCompact ? "min(320px, calc(100vw - 32px))" : "360px",
    borderRadius: "22px",
    border: "1px solid rgba(255,255,255,0.92)",
    background: "rgba(255,255,255,0.985)",
    boxShadow: "0 28px 72px rgba(15,23,42,0.16)",
    backdropFilter: "blur(28px) saturate(1.2)",
    WebkitBackdropFilter: "blur(28px) saturate(1.2)",
    padding: "16px",
    display: "grid",
    gap: "12px",
    zIndex: 120,
  }),
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  eyebrow: {
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#94a3b8",
  },
  title: {
    marginTop: "2px",
    fontSize: "15px",
    fontWeight: 700,
    color: "#0f172a",
  },
  headerActions: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  iconButton: {
    width: "30px",
    height: "30px",
    borderRadius: "999px",
    border: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(255,255,255,0.86)",
    color: "#475569",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  weekdayRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: "6px",
  },
  weekdayLabel: {
    textAlign: "center",
    fontSize: "10px",
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: "6px",
  },
  dayCell: ({ hasActivity, isCurrentMonth, isToday }) => ({
    minHeight: "52px",
    padding: "8px 6px",
    borderRadius: "14px",
    border: isToday
      ? "1px solid rgba(15,23,42,0.14)"
      : "1px solid rgba(15,23,42,0.04)",
    background: hasActivity
      ? "rgba(248,250,252,0.96)"
      : isCurrentMonth
        ? "rgba(255,255,255,0.72)"
        : "rgba(248,250,252,0.5)",
    boxShadow: hasActivity ? "0 8px 18px rgba(15,23,42,0.05)" : "none",
    display: "grid",
    alignContent: "space-between",
    gap: "8px",
  }),
  dayNumber: (isCurrentMonth, isToday) => ({
    textAlign: "center",
    fontSize: "12px",
    fontWeight: isToday ? 800 : 700,
    color: isCurrentMonth ? "#0f172a" : "#94a3b8",
  }),
  metricStripRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "3px",
    minHeight: "6px",
  },
  metricStrip: {
    width: "14px",
    height: "4px",
    borderRadius: "999px",
  },
  footer: {
    fontSize: "12px",
    color: "#475569",
    lineHeight: 1.5,
  },
};
