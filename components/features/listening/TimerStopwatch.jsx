"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  Check,
  Clock3,
  Timer,
  Plus,
  Minus,
} from "lucide-react";
import { PillSliderToggle, ProgressRing } from "@/components/dashboard/DictionaryCarousel";

const NEUTRAL_TRACK = "var(--app-progress-track)";
const BRIGHT_BLUE = "#6366f1";
const MID_BLUE = "#4f46e5";
const DARK_BLUE = "#3730a3";

export default function TimerStopwatch({
  styles,
  clockMode,
  stopwatchSeconds,
  stopwatchRunning,
  timerSeconds,
  timerDurationSeconds,
  timerRunning,
  toggleTimerStart,
  bankStopwatch,
  setClockMode,
  setStopwatchRunning,
  setStopwatchSeconds,
  setTimerRunning,
  setTimerSeconds,
  setTimerDurationSeconds,
  liveSessionDisplay,
  variant = "default",
}) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncViewport = () => {
      setIsDesktop(window.innerWidth >= 1000);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const currentSeconds =
    clockMode === "timer" ? Math.max(0, timerDurationSeconds - timerSeconds) : stopwatchSeconds;
  const flooredCurrentSeconds = Math.max(0, Math.floor(currentSeconds));
  const progressPercent = ((currentSeconds % 60) / 60) * 100;
  const totalMinutesPassed = Math.floor(currentSeconds / 60);
  const displayMinutes = String(Math.floor((flooredCurrentSeconds % 3600) / 60)).padStart(2, "0");
  const displaySeconds = String(flooredCurrentSeconds % 60).padStart(2, "0");
  const desktopStopwatchHourCount = Math.max(0, Math.floor(flooredCurrentSeconds / 3600));
  const desktopPrimaryTime = `${displayMinutes}:${displaySeconds}`;

  const { ringColor, trackColor } = useMemo(() => {
    if (totalMinutesPassed === 0) {
      return {
        ringColor: BRIGHT_BLUE,
        trackColor: NEUTRAL_TRACK,
      };
    }

    if (totalMinutesPassed % 2 === 1) {
      return {
        ringColor: DARK_BLUE,
        trackColor: BRIGHT_BLUE,
      };
    }

    return {
      ringColor: MID_BLUE,
      trackColor: DARK_BLUE,
    };
  }, [totalMinutesPassed]);

  const ringRadius = isDesktop ? 96 : 78;
  const ringStroke = isDesktop ? 8 : 6;
  const timerMinutes = Math.max(1, Math.round(timerDurationSeconds / 60));
  const isMobileCondensed = variant === "mobileCondensed";

  const updateTimerDuration = (nextDurationSeconds) => {
    const safeDuration = Math.min(59 * 60, Math.max(60, nextDurationSeconds));
    setTimerDurationSeconds(safeDuration);

    if (clockMode !== "timer") return;

    if (!timerRunning) {
      setTimerSeconds(safeDuration);
      return;
    }

    setTimerSeconds((seconds) => {
      const adjusted = Math.round((seconds + (safeDuration - timerDurationSeconds)) * 10) / 10;
      return Math.max(0, Math.min(safeDuration, adjusted));
    });
  };

  const adjustTimerMinutes = (deltaMinutes) => {
    updateTimerDuration(timerDurationSeconds + deltaMinutes * 60);
  };

  const handleTimerReset = () => {
    if (clockMode === "stopwatch") {
      setStopwatchRunning(false);
      setStopwatchSeconds(0);
      return;
    }

    setTimerRunning(false);
    setTimerSeconds(timerDurationSeconds);
  };

  const timerAdjustButton = {
    border: "1px solid var(--app-border)",
    background: "var(--app-surface-elevated)",
    color: "#4338ca",
    borderRadius: "12px",
    width: isDesktop ? "40px" : "36px",
    height: isDesktop ? "40px" : "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  const actionButton = (active) => ({
    ...styles.iconActionButton(active),
    width: isDesktop ? "50px" : "44px",
    height: isDesktop ? "50px" : "44px",
  });

  if (isMobileCondensed) {
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
            position: "relative",
            width: "42px",
            height: "42px",
            flexShrink: 0,
          }}
        >
          <ProgressRing
            radius={21}
            stroke={4}
            progress={progressPercent}
            color={ringColor}
            trackColor={trackColor}
            style={{
              transition: progressPercent < 1 ? "none" : "stroke-dashoffset 0.1s linear",
            }}
          />
        </div>

        <div
          style={{
            minWidth: 0,
            flex: "1 1 auto",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: "var(--app-text)",
              whiteSpace: "nowrap",
            }}
          >
            {liveSessionDisplay}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            aria-label={stopwatchRunning ? "Pause stopwatch" : "Start stopwatch"}
            title={stopwatchRunning ? "Pause stopwatch" : "Start stopwatch"}
            onClick={() => setStopwatchRunning((running) => !running)}
            style={mobileStyles.compactActionButton(stopwatchRunning)}
          >
            {stopwatchRunning ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            type="button"
            aria-label="Restart stopwatch"
            title="Restart stopwatch"
            onClick={() => {
              setStopwatchRunning(false);
              setStopwatchSeconds(0);
            }}
            style={mobileStyles.compactActionButton(false)}
          >
            <RotateCcw size={18} />
          </button>

          <button
            type="button"
            aria-label="Bank stopwatch session"
            title="Bank stopwatch session"
            onClick={bankStopwatch}
            style={mobileStyles.compactActionButton(false)}
          >
            <Check size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.sideCard,
        padding: isDesktop ? styles.sideCard.padding : "16px",
      }}
    >
      <div
        style={{
          ...styles.wordCardHeader,
          marginBottom: "10px",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div style={styles.progressContainer}>
            <div
              style={{
                ...styles.dictionaryIconFootprint,
                background: "rgba(99, 102, 241, 0.16)",
                border: "1px solid rgba(99, 102, 241, 0.18)",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Clock3 size={14} color="#818cf8" strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
            <div style={styles.eyebrow}>セッション</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto" }}>
          <PillSliderToggle
            value={clockMode}
            options={[
              { value: "stopwatch", label: "Stopwatch", icon: Clock3, ariaLabel: "Stopwatch mode" },
              { value: "timer", label: "Timer", icon: Timer, ariaLabel: "Timer mode" },
            ]}
            onChange={setClockMode}
            width={isDesktop ? 216 : 96}
            size="sm"
            iconOnly={!isDesktop}
          />
        </div>
      </div>

      <div
        style={{
          ...styles.timerContainer,
          gap: isDesktop ? "22px" : "18px",
          paddingTop: "25px",
        }}
      >
        <div style={styles.timerRingWrap}>
          <ProgressRing
            radius={ringRadius}
            stroke={ringStroke}
            progress={progressPercent}
            color={ringColor}
            trackColor={trackColor}
            style={{
              transition: progressPercent < 1 ? "none" : "stroke-dashoffset 0.1s linear",
            }}
          />
          <div
            style={{
              ...styles.timerRingValue,
              fontSize: isDesktop ? "42px" : "32px",
              lineHeight: 1,
              display: "grid",
              gap: isDesktop && clockMode === "stopwatch" && desktopStopwatchHourCount > 0 ? "12px" : "8px",
              justifyItems: "center",
            }}
          >
            {isDesktop && clockMode === "stopwatch" && desktopStopwatchHourCount > 0 ? (
              <div
                aria-label={`${desktopStopwatchHourCount} hour${desktopStopwatchHourCount === 1 ? "" : "s"} elapsed`}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: "6px",
                  maxWidth: "132px",
                }}
              >
                {Array.from({ length: desktopStopwatchHourCount }).map((_, index) => (
                  <span
                    key={`stopwatch-hour-dot-${index + 1}`}
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "999px",
                      background: BRIGHT_BLUE,
                      boxShadow: "0 0 0 3px rgba(99, 102, 241, 0.12)",
                    }}
                  />
                ))}
              </div>
            ) : null}
            <div>{desktopPrimaryTime}</div>
            <div
              style={{
                fontSize: isDesktop ? "12px" : "11px",
                fontWeight: 600,
                color: "var(--app-text-muted)",
                opacity: 0.84,
                letterSpacing: "0.08em",
              }}
            >
              MIN:SEC
            </div>
          </div>
        </div>

        {clockMode === "timer" && (
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: isDesktop ? "8px 10px" : "7px 9px",
                borderRadius: "16px",
                background: "var(--app-card)",
                border: "1px solid var(--app-border-soft)",
              }}
            >
              <button
                type="button"
                style={{
                  ...timerAdjustButton,
                  opacity: timerMinutes <= 1 ? 0.45 : 1,
                  cursor: timerMinutes <= 1 ? "not-allowed" : "pointer",
                }}
                onClick={() => adjustTimerMinutes(-1)}
                disabled={timerMinutes <= 1}
              >
                <Minus size={16} />
              </button>

              <div style={{ textAlign: "center", minWidth: isDesktop ? "116px" : "100px" }}>
                <div style={{ ...styles.eyebrow, marginBottom: "2px" }}>Timer Length</div>
                <div
                  style={{
                    fontSize: isDesktop ? "18px" : "16px",
                    fontWeight: 700,
                    color: "var(--app-text)",
                  }}
                >
                  {timerMinutes} min
                </div>
              </div>

              <button
                type="button"
                style={timerAdjustButton}
                onClick={() => adjustTimerMinutes(1)}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}

        <div style={{ ...styles.timerActionRow, gap: isDesktop ? "12px" : "10px" }}>
          <button
            style={actionButton(clockMode === "stopwatch" ? stopwatchRunning : timerRunning)}
            onClick={toggleTimerStart}
          >
            {(clockMode === "stopwatch" ? stopwatchRunning : timerRunning) ? (
              <Pause size={isDesktop ? 16 : 14} />
            ) : (
              <Play size={isDesktop ? 16 : 14} />
            )}
          </button>
          <button style={actionButton(false)} onClick={handleTimerReset}>
            <RotateCcw size={isDesktop ? 16 : 14} />
          </button>
          <button
            style={{
              ...actionButton(false),
              opacity: clockMode === "stopwatch" ? 1 : 0.5,
              cursor: clockMode === "stopwatch" ? "pointer" : "default",
            }}
            onClick={clockMode === "stopwatch" ? bankStopwatch : undefined}
          >
            <Check size={isDesktop ? 16 : 14} />
          </button>
        </div>
      </div>
    </div>
  );
}

const mobileStyles = {
  compactActionButton: (active) => ({
    border: "1px solid var(--app-border-soft)",
    background: active ? "rgba(99, 102, 241, 0.16)" : "var(--app-surface-elevated)",
    color: active ? "#4f46e5" : "var(--app-text-soft)",
    borderRadius: "14px",
    width: "44px",
    height: "44px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    padding: 0,
  }),
};
