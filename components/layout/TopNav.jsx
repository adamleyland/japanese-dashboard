"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpenText, LayoutDashboard } from "lucide-react";
import { useWebHaptics } from "web-haptics/react";
import NavigationBar from "@/components/layout/NavigationBar";
import CalendarPopover from "@/components/layout/CalendarPopover";

const MODULE_ACCENT_COLORS = {
  listening: "#eab308",
  reading: "#3b82f6",
  gaming: "#8b5cf6",
  shadowing: "#ef4444",
  writing: "#10b981",
};

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
  const [mobileModulesAnchorTab, setMobileModulesAnchorTab] = useState(null);
  const calendarRef = useRef(null);
  const mobileModulesRef = useRef(null);
  const triggerMobileNavHaptic = useMobileNavHaptics(isMobile);
  const mobileModuleTabs = moduleTabs;
  const mobileModulesOpen = isMobile && mobileModulesAnchorTab === activeTab;
  const activeModuleAccent = MODULE_ACCENT_COLORS[activeTab] || "#2563eb";

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

  useEffect(() => {
    if (!isMobile || !mobileModulesOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (mobileModulesRef.current && !mobileModulesRef.current.contains(event.target)) {
        setMobileModulesAnchorTab(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isMobile, mobileModulesOpen]);

  const handleToggleMobileModules = useCallback(() => {
    triggerMobileNavHaptic();
    setMobileModulesAnchorTab((currentValue) => (currentValue === activeTab ? null : activeTab));
  }, [activeTab, triggerMobileNavHaptic]);

  if (isMobile) {
    return (
      <section
        style={{
          ...styles.topNavShell(isCompact, true),
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        }}
      >
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

        <div style={{ ...styles.mobileNavItemWrap, position: "relative" }}>
          <div ref={mobileModulesRef} style={localStyles.mobileModuleLauncherShell}>
            <div style={localStyles.mobileModuleTray(mobileModulesOpen)}>
              {mobileModuleTabs.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;

                return (
                  <div
                    key={item.key}
                    style={localStyles.mobileModuleOptionWrap(mobileModulesOpen, index)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!isActive) {
                          triggerMobileNavHaptic();
                        }

                        setMobileModulesAnchorTab(null);
                        onChange(item.key);
                      }}
                      style={localStyles.mobileModuleOptionButton(item.key, isActive)}
                      aria-pressed={isActive}
                      aria-label={item.label}
                      title={item.label}
                    >
                      <Icon size={20} />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleToggleMobileModules}
              style={localStyles.mobileModuleLauncherButton(mobileModulesOpen, activeModuleAccent)}
              aria-expanded={mobileModulesOpen}
              aria-haspopup="menu"
              aria-label={mobileModulesOpen ? "Hide learning modules" : "Show learning modules"}
              title="Learning modules"
            >
              <BookOpenText size={22} />
            </button>
          </div>
        </div>

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

function useMobileNavHaptics(isMobile) {
  const { trigger, isSupported } = useWebHaptics();
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const updateMatch = () => {
      setIsCoarsePointer(mediaQuery.matches);
    };

    updateMatch();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMatch);
      return () => mediaQuery.removeEventListener("change", updateMatch);
    }

    mediaQuery.addListener(updateMatch);
    return () => mediaQuery.removeListener(updateMatch);
  }, []);

  return useCallback(() => {
    if (!isMobile || !isCoarsePointer || !isSupported) {
      return;
    }

    void trigger("selection");
  }, [isCoarsePointer, isMobile, isSupported, trigger]);
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

const localStyles = {
  mobileModuleLauncherShell: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  mobileModuleTray: (open) => ({
    position: "absolute",
    left: "50%",
    bottom: "calc(100% + 14px)",
    transform: open
      ? "translateX(-50%) translateY(0px) scale(1)"
      : "translateX(-50%) translateY(12px) scale(0.94)",
    opacity: open ? 1 : 0,
    pointerEvents: open ? "auto" : "none",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px",
    borderRadius: "22px",
    border: "1px solid rgba(255,255,255,0.78)",
    background: "rgba(248,250,252,0.9)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: "0 22px 54px rgba(15,23,42,0.18)",
    transition: "opacity 220ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
    zIndex: 6,
  }),
  mobileModuleOptionWrap: (open, index) => ({
    opacity: open ? 1 : 0,
    transform: open
      ? "translateY(0px) scale(1)"
      : `translateY(${18 + index * 4}px) scale(0.9)`,
    transition: open
      ? `opacity 200ms ease ${50 + index * 24}ms, transform 320ms cubic-bezier(0.22, 1, 0.36, 1) ${40 + index * 24}ms`
      : "opacity 140ms ease, transform 180ms ease",
  }),
  mobileModuleOptionButton: (moduleKey, active) => {
    const accent = MODULE_ACCENT_COLORS[moduleKey] || "#64748b";
    const softAccent = hexToRgba(accent, active ? 0.18 : 0.1);
    const borderAccent = hexToRgba(accent, active ? 0.32 : 0.18);

    return {
      width: "46px",
      height: "46px",
      borderRadius: "16px",
      border: `1px solid ${borderAccent}`,
      background: active ? softAccent : "rgba(255,255,255,0.82)",
      color: accent,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: active
        ? `0 14px 28px ${hexToRgba(accent, 0.18)}`
        : "0 10px 22px rgba(15,23,42,0.08)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    };
  },
  mobileModuleLauncherButton: (open, accent) => ({
    width: "52px",
    height: "52px",
    borderRadius: "18px",
    border: open ? `1px solid ${hexToRgba(accent, 0.28)}` : "1px solid rgba(255,255,255,0.78)",
    background: open ? "rgba(255,255,255,0.96)" : "rgba(248,250,252,0.86)",
    color: open ? accent : "var(--app-text)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    boxShadow: open
      ? `0 18px 40px ${hexToRgba(accent, 0.2)}`
      : "0 12px 28px rgba(15,23,42,0.12)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    transition:
      "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease, background 220ms ease, color 220ms ease, border-color 220ms ease",
    transform: open ? "translateY(-2px) scale(1.02)" : "translateY(0px) scale(1)",
  }),
};

function hexToRgba(hex, alpha) {
  const normalizedHex = hex.replace("#", "");
  const value =
    normalizedHex.length === 3
      ? normalizedHex
          .split("")
          .map((char) => char + char)
          .join("")
      : normalizedHex;

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
