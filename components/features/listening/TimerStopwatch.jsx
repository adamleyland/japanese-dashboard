"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  Check,
  Clock3,
  Plus,
  Minus,
} from "lucide-react";
import { PillSliderToggle, ProgressRing } from "@/components/dashboard/DictionaryCarousel";

const NEUTRAL_TRACK = "#e2e8f0";
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
  const progressPercent = ((currentSeconds % 60) / 60) * 100;
  const totalMinutesPassed = Math.floor(currentSeconds / 60);

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
    border: "1px solid rgba(99,102,241,0.14)",
    background: "rgba(255,255,255,0.86)",
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

  return (
    <div style={styles.sideCard}>
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
                background: "linear-gradient(145deg, #818cf8, #4f46e5)",
                boxShadow: "0 10px 24px rgba(79,70,229,0.01)",
              }}
            >
              <Clock3 size={14} color="#fff" strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
            <div style={styles.eyebrow}>Live Session</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto" }}>
          <PillSliderToggle
            value={clockMode}
            options={[
              { value: "stopwatch", label: "Stopwatch" },
              { value: "timer", label: "Timer" },
            ]}
            onChange={setClockMode}
            width={isDesktop ? 216 : 188}
            size="sm"
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
            }}
          >
            {liveSessionDisplay}
            <div
              style={{
                fontSize: isDesktop ? "12px" : "11px",
                fontWeight: 600,
                color: "#64748b",
                opacity: 0.84,
                marginTop: "8px",
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
                background: "rgba(255,255,255,0.58)",
                border: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <button
                type="button"
                style={timerAdjustButton}
                onClick={() => adjustTimerMinutes(-1)}
                disabled={timerMinutes <= 1}
              >
                <Minus size={16} />
              </button>

              <div style={{ textAlign: "center", minWidth: isDesktop ? "116px" : "100px" }}>
                <div style={{ ...styles.eyebrow, marginBottom: "2px" }}>Timer Length</div>
                <div style={{ fontSize: isDesktop ? "18px" : "16px", fontWeight: 700 }}>
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
