"use client";

import NumberField from "@/components/ui/NumberField";

export default function ShadowingWorkspace({ styles, shadowingHours, setShadowingHours }) {
  return (
    <div style={styles.largeCard}>
      <h2 style={styles.sectionTitle}>Shadowing</h2>
      <p style={styles.sectionText}>Track active output practice and imitation sessions.</p>
      <div style={styles.controlGridSingle}>
        <NumberField
          label="Shadowing hours"
          value={shadowingHours}
          onChange={setShadowingHours}
          step={0.5}
        />
      </div>
    </div>
  );
}
