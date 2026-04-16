"use client";

import { Settings2, BarChart3 } from "lucide-react";
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
      <div style={styles.visualHeader}>
        <h3 style={styles.sideTitle}>Listening Visualisation</h3>
        <div style={styles.visualTools}>
          <button style={styles.iconBadgeBtn} onClick={() => setSettingsOpen((v) => !v)}>
            <Settings2 size={14} />
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
            onClick={() => setListeningHours((h) => Math.max(0, h + item.delta))}
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
