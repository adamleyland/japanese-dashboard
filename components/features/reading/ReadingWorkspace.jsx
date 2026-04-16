"use client";

export default function ReadingWorkspace({ styles, wordsRead, setWordsRead, NumberField }) {
  return (
    <div style={styles.largeCard}>
      <h2 style={styles.sectionTitle}>Reading</h2>
      <p style={styles.sectionText}>Track total words read across books, manga, and articles.</p>
      <div style={styles.controlGridSingle}>
        <NumberField label="Words read" value={wordsRead} onChange={setWordsRead} step={100} />
      </div>
    </div>
  );
}
