"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import NavigationBar from "@/components/layout/NavigationBar";
import CalendarPopover from "@/components/layout/CalendarPopover";

export default function TopNav({
  activeTab,
  authControl,
  authUserId,
  isCompact,
  isMobile,
  moduleTabs,
  onChange,
  onToggleDashboard,
  showDashboard,
  styles,
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef(null);
  const mobileModuleTabs = moduleTabs.filter(
    (item) => item.key !== "shadowing" && item.key !== "writing",
  );

  const dateLabel = useMemo(
    () => formatTodayLabel(isCompact),
    [isCompact],
  );

  useEffect(() => {
    if (!calendarOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setCalendarOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [calendarOpen]);

  if (isMobile) {
    return (
      <section style={styles.topNavShell(isCompact, true)}>
        <div style={styles.mobileNavItemWrap}>
          <button
            type="button"
            onClick={onToggleDashboard}
            style={styles.topNavIconButton(showDashboard, true)}
            aria-pressed={showDashboard}
            aria-label={showDashboard ? "Hide dashboard" : "Show dashboard"}
          >
            <LayoutDashboard size={22} />
          </button>
        </div>

        {mobileModuleTabs.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;

          return (
            <div key={item.key} style={styles.mobileNavItemWrap}>
              <button
                type="button"
                onClick={() => onChange(item.key)}
                style={styles.moduleNavButton(isActive, true)}
                aria-pressed={isActive}
                aria-label={item.label}
                title={item.label}
              >
                <Icon size={22} />
              </button>
            </div>
          );
        })}

        <div style={styles.mobileNavItemWrap}>{authControl}</div>
      </section>
    );
  }

  return (
    <section style={styles.topNavShell(isCompact, false)}>
      <div style={styles.topNavLeft}>
        <button
          type="button"
          onClick={onToggleDashboard}
          style={styles.topNavIconButton(showDashboard, false)}
          aria-pressed={showDashboard}
          aria-label={showDashboard ? "Hide dashboard" : "Show dashboard"}
        >
          <LayoutDashboard size={16} />
        </button>

        <div ref={calendarRef} style={styles.topNavCalendarWrap}>
          <button
            type="button"
            onClick={() => setCalendarOpen((open) => !open)}
            style={styles.topNavDateButton}
          >
            {dateLabel}
          </button>

          {calendarOpen && (
            <CalendarPopover
              authUserId={authUserId}
              isCompact={isCompact}
              onClose={() => setCalendarOpen(false)}
            />
          )}
        </div>
      </div>

      <div style={styles.topNavCenter}>
        <NavigationBar
          activeTab={activeTab}
          isMobile={false}
          moduleTabs={moduleTabs}
          onChange={onChange}
          styles={styles}
        />
      </div>

      <div style={styles.topNavRight}>{authControl}</div>
    </section>
  );
}

function formatTodayLabel(isCompact) {
  const today = new Date();
  const weekday = today.toLocaleDateString(undefined, {
    weekday: isCompact ? "short" : "long",
  });
  const day = today.toLocaleDateString(undefined, { day: "numeric" });
  const month = today.toLocaleDateString(undefined, {
    month: isCompact ? "short" : "long",
  });

  return `${weekday}, ${formatOrdinalDay(Number(day))} ${month}`;
}

function formatOrdinalDay(day) {
  const lastTwoDigits = day % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${day}th`;
  }

  const lastDigit = day % 10;

  if (lastDigit === 1) return `${day}st`;
  if (lastDigit === 2) return `${day}nd`;
  if (lastDigit === 3) return `${day}rd`;
  return `${day}th`;
}
