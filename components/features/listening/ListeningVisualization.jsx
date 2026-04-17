"use client";

import { Settings2, BarChart3, Ear } from "lucide-react";
import { PillSliderToggle } from "@/components/dashboard/DictionaryCarousel";

function NumberField({ label, value, onChange, step = 1, styles }) {
  return (
    <label style={styles.inputCard}>
      <span style={styles.inputLabel}>{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        style={styles.input}
      />
    </label>
  );
}

export default function ListeningVisualization({
  styles,
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
    <div style={styles.sideCard}>
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
                background: "linear-gradient(145deg, #f5cd55, #eab308)",
                boxShadow: "0 10px 24px rgba(14,165,233,0.01)",
              }}
            >
              <Ear size={14} color="#fff" strokeWidth={2.5} />
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
              border: "1px solid rgba(15, 23, 42, 0.08)",
              background: settingsOpen ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.82)",
              borderRadius: "12px",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: settingsOpen ? "#0369a1" : "#475569",
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
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
            color: "#64748b",
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
          />
          <PillSliderToggle
            value={vizMode}
            options={[
              { value: "blocks", label: "Blocks" },
              { value: "bar", label: "Bar" },
            ]}
            onChange={setVizMode}
            width={200}
            size="sm"
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
