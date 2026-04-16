"use client";

export default function GamingWorkspace({ styles, gamingHours, setGamingHours, NumberField }) {
  return (
    <div style={styles.largeCard}>
      <h2 style={styles.sectionTitle}>Gaming</h2>
      <p style={styles.sectionText}>Track immersion hours.</p>
      <div style={styles.controlGridSingle}>
        <NumberField
          label="Gaming hours"
          value={gamingHours}
          onChange={setGamingHours}
          step={0.5}
        />
      </div>
    </div>
  );
}
