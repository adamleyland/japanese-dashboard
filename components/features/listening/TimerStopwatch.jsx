"use client";

import React from "react";
import { Pause, Play, RotateCcw, Check } from "lucide-react";
import { PillSliderToggle, ProgressRing } from "@/components/dashboard/DictionaryCarousel";

export default function TimerStopwatch({
  styles,
  clockMode,
  stopwatchSeconds, // Expecting decimal (e.g., 1.1, 1.2)
  stopwatchRunning,
  timerSeconds,     // Expecting decimal
  timerRunning,
  toggleTimerStart,
  bankStopwatch,
  setClockMode,
  setStopwatchRunning,
  setStopwatchSeconds,
  setTimerRunning,
  setTimerSeconds,
  liveSessionDisplay,
}) {
  
  // 1. Calculate raw progress within the current minute (0-100)
  const currentSeconds = clockMode === "timer" ? (300 - timerSeconds) : stopwatchSeconds;
  const progressPercent = ((currentSeconds % 60) / 60) * 100;

  // 2. Determine "Lap" status for the color swapping
  // Even minutes (0, 2, 4): Original Blue
  // Odd minutes (1, 3, 5): Darker Blue
  const totalMinutesPassed = Math.floor(currentSeconds / 60);
  const isOddMinute = totalMinutesPassed % 2 !== 0;

  const colorPrimary = "#6366f1";   // Original Blue
  const colorSecondary = "#4338ca"; // Slightly Darker Blue (Indigo-700)
  
  // This logic makes the "filled" part of the previous minute 
  // the background of the current minute
  const ringColor = isOddMinute ? colorSecondary : colorPrimary;
  const trackColor = isOddMinute ? colorPrimary : "#e2e8f0"; // e2e8f0 is a standard light gray

  return (
    <div style={styles.sideCard}>
      <div style={styles.clockHeader}>
        <h3 style={styles.sideTitle}>Live Session Timer</h3>
        <PillSliderToggle
          value={clockMode}
          options={[
            { value: "stopwatch", label: "Stopwatch" },
            { value: "timer", label: "Timer" },
          ]}
          onChange={setClockMode}
          width={200}
          size="sm"
        />
      </div>

      <div style={styles.timerContainer}>
        <div style={styles.timerRingWrap}>
          <ProgressRing
            radius={70}
            stroke={6}
            progress={progressPercent}
            color={ringColor}
            trackColor={trackColor}
            style={{
              transition:
                progressPercent < 1 ? "none" : "stroke-dashoffset 0.1s linear",
            }}
          />
          <div style={styles.timerRingValue}>
            {liveSessionDisplay}
            <div
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "#64748b",
                opacity: 0.8,
              }}
            >
              MIN:SEC
            </div>
          </div>
        </div>

        <div style={styles.timerActionRow}>
          <button
            style={styles.iconActionButton(
              clockMode === "stopwatch" ? stopwatchRunning : timerRunning
            )}
            onClick={toggleTimerStart}
          >
            {(clockMode === "stopwatch" ? stopwatchRunning : timerRunning) ? (
              <Pause size={14} />
            ) : (
              <Play size={14} />
            )}
          </button>
          <button
            style={styles.iconActionButton(false)}
            onClick={() => {
              if (clockMode === "stopwatch") {
                setStopwatchRunning(false);
                setStopwatchSeconds(0);
              } else {
                setTimerRunning(false);
                setTimerSeconds(300);
              }
            }}
          >
            <RotateCcw size={14} />
          </button>
          <button
            style={styles.iconActionButton(false)}
            onClick={clockMode === "stopwatch" ? bankStopwatch : () => {}}
          >
            <Check size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
