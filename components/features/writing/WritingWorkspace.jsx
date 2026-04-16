"use client";

import NumberField from "@/components/ui/NumberField";

export default function WritingWorkspace({ styles, wordsWritten, setWordsWritten }) {
  return (
    <div style={styles.largeCard}>
      <h2 style={styles.sectionTitle}>Writing</h2>
      <p style={styles.sectionText}>Track total words written from journaling and output drills.</p>
      <div style={styles.controlGridSingle}>
        <NumberField
          label="Words written"
          value={wordsWritten}
          onChange={setWordsWritten}
          step={100}
        />
      </div>
    </div>
  );
}
