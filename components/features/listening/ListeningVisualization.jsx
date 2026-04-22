"use client";

import { Settings2, BarChart3, Ear, LayoutGrid } from "lucide-react";
import { PillSliderToggle } from "@/components/dashboard/DictionaryCarousel";

function NumberField({ label, value, onChange, step = 1, styles, mobileOptimized = false }) {
  const allowsDecimal = stepAllowsDecimal(step);

  return (
    <label style={styles.inputCard}>
      <span style={styles.inputLabel}>{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        inputMode={mobileOptimized ? (allowsDecimal ? "decimal" : "numeric") : undefined}
        enterKeyHint={mobileOptimized ? "done" : undefined}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        style={{
          ...styles.input,
          fontSize: mobileOptimized ? "16px" : styles.input.fontSize,
        }}
      />
    </label>
  );
}

export default function ListeningVisualization({
  styles,
  isMobile = false,
  isCompact = false,
  listeningHours,
  setListeningHours,
  listeningGoal,
  setListeningGoal,
  showVisualization,
  vizMode,
  setVizMode,
  settingsOpen,
  setSettingsOpen,
  totalBlocks,
  listeningProgress,
}) {
  return (
    <div
      style={{
        ...styles.sideCard,
        padding: isMobile ? "16px" : styles.sideCard.padding,
      }}
    >
      <div
        style={{
          ...styles.wordCardHeader,
          marginBottom: "8px",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div style={styles.progressContainer}>
            <div
              style={{
                ...styles.dictionaryIconFootprint,
                background: "rgba(234, 179, 8, 0.16)",
                border: "1px solid rgba(234, 179, 8, 0.18)",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Ear size={14} color="#facc15" strokeWidth={2.5} />
            </div>
          </div>

          <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
            <div style={styles.eyebrow}>進歩</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
          <button
            type="button"
            style={{
              border: "1px solid var(--app-border-soft)",
              background: settingsOpen ? "rgba(14,165,233,0.16)" : "var(--app-surface-elevated)",
              borderRadius: "12px",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: settingsOpen ? "#38bdf8" : "var(--app-text-soft)",
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
            }}
            onClick={() => setSettingsOpen((value) => !value)}
            aria-label="Toggle listening visualization settings"
          >
            <Settings2 size={15} />
          </button>
        </div>
      </div>

      <div style={styles.visualMainStats}>
        <div style={styles.visualLargeValue}>{formatHours(listeningHours)}</div>
        <p
          style={{
            textAlign: "center",
            fontSize: "11px",
            textTransform: "uppercase",
            color: "var(--app-text-muted)",
            margin: "-5px 0 10px 0",
            letterSpacing: "0.05em",
          }}
        >
          Total Immersed
        </p>
      </div>

      <div style={styles.quickAdjustGrid}>
        {[
          { label: "+1h", delta: 1 },
          { label: "+30m", delta: 0.5 },
          { label: "+5m", delta: 5 / 60 },
        ].map((item) => (
          <button
            key={item.label}
            style={styles.adjustBtn}
            onClick={() => setListeningHours((hours) => Math.max(0, hours + item.delta))}
          >
            {item.label}
          </button>
        ))}
      </div>

      {settingsOpen && (
        <div style={styles.goalGrid}>
          <NumberField
            label="Goal (hours)"
            value={listeningGoal}
            onChange={setListeningGoal}
            step={1}
            styles={styles}
            mobileOptimized={isCompact}
          />
          <PillSliderToggle
            value={vizMode}
            options={[
              { value: "blocks", label: "Blocks", icon: LayoutGrid, ariaLabel: "Blocks view" },
              { value: "bar", label: "Bar", icon: BarChart3, ariaLabel: "Bar view" },
            ]}
            onChange={setVizMode}
            width={isMobile ? 96 : 200}
            size="sm"
            iconOnly={isMobile}
          />
        </div>
      )}

      {showVisualization && (
        <div style={{ marginTop: "15px" }}>
          {vizMode === "blocks" ? (
            <div style={styles.blockGrid}>
              {Array.from({ length: totalBlocks }).map((_, index) => {
                const fill = Math.max(0, Math.min(1, (listeningHours - index * 10) / 10));
                return (
                  <div key={index} style={styles.progressBlockShell}>
                    <div style={styles.progressBlockFill(fill)} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.progressBarWrap}>
              <div style={styles.progressBarFill(listeningProgress)} />
              <div style={styles.progressBarLabel}>
                <BarChart3 size={14} /> {listeningProgress.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatHours(hours) {
  return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
}

function stepAllowsDecimal(step) {
  const numericStep = Number(step);
  return Number.isFinite(numericStep) && !Number.isInteger(numericStep);
}
