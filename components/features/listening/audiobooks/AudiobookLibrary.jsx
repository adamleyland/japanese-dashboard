"use client";

import AudiobookCard from "@/components/features/listening/audiobooks/AudiobookCard";

export default function AudiobookLibrary({ books, onSelect }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionEyebrow}>Library</div>
        <div style={styles.sectionHint}>Mock shelf ready for real sources later</div>
      </div>

      <div style={styles.shelf}>
        {books.map((book) => (
          <AudiobookCard key={book.id} book={book} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

const styles = {
  section: {
    display: "grid",
    gap: "12px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  sectionEyebrow: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  sectionHint: {
    fontSize: "12px",
    color: "var(--app-text-faint)",
  },
  shelf: {
    display: "flex",
    gap: "14px",
    overflowX: "auto",
    paddingBottom: "8px",
    scrollbarWidth: "thin",
  },
};
