"use client";

import { useState } from "react";

export default function Home() {
  const [tab, setTab] = useState("listening");

  return (
    <main style={styles.page}>
      <div style={styles.bgOrb1} />
      <div style={styles.bgOrb2} />
      <div style={styles.container}>
        <section style={styles.heroGrid}>
          <div style={styles.heroCard}>
            <div style={styles.eyebrow}>Main dashboard</div>
            <h1 style={styles.title}>Japanese Progress Dashboard</h1>
            <p style={styles.subtitle}>
              Track listening, reading, and gaming in one clean place.
            </p>

            <div style={styles.metricsGrid}>
              <MetricCard label="Listening" value="1030 / 2000h" />
              <MetricCard label="Reading" value="3.05m / 5m" />
              <MetricCard label="Gaming" value="280h" />
              <MetricCard label="Overall" value="52.4%" />
            </div>
          </div>

          <div style={styles.wordCard}>
            <div style={styles.eyebrow}>Word of the day</div>
            <div style={styles.word}>継続</div>
            <div style={styles.reading}>けいぞく</div>
            <div style={styles.meaning}>consistency, continuation</div>
            <div style={styles.exampleBox}>
              毎日少しずつでも継続すると、あとで大きな差になる。
              <div style={styles.exampleTranslation}>
                Even a little every day adds up to a big difference later.
              </div>
            </div>
          </div>
        </section>

        <section style={styles.tabsWrap}>
          <TabButton active={tab === "listening"} onClick={() => setTab("listening")}>
            Listening
          </TabButton>
          <TabButton active={tab === "reading"} onClick={() => setTab("reading")}>
            Reading
          </TabButton>
          <TabButton active={tab === "gaming"} onClick={() => setTab("gaming")}>
            Gaming
          </TabButton>
        </section>

        <section style={styles.contentWrap}>
          {tab === "listening" && <ListeningTab />}
          {tab === "reading" && <ReadingTab />}
          {tab === "gaming" && <GamingTab />}
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={styles.tabButton(active)}>
      {children}
    </button>
  );
}

function ListeningTab() {
  return (
    <div style={styles.mainGrid}>
      <div style={styles.largeCard}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Listening</h2>
            <p style={styles.sectionText}>This is where the big YouTube player will go next.</p>
          </div>
          <div style={styles.pill}>Main learning area</div>
        </div>

        <div style={styles.videoPlaceholder}>
          YouTube player coming next
        </div>

        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: "51.5%" }} />
        </div>

        <div style={styles.progressMeta}>
          <span>51.5% complete</span>
          <span>1 block = 10 hours</span>
        </div>
      </div>

      <div style={styles.sideColumn}>
        <div style={styles.sideCard}>
          <h3 style={styles.sideTitle}>Timer</h3>
          <div style={styles.bigNumber}>00:00:00</div>
        </div>

        <div style={styles.sideCard}>
          <h3 style={styles.sideTitle}>Quick stats</h3>
          <div style={styles.smallStatsGrid}>
            <div style={styles.smallStat}>
              <div style={styles.metricLabel}>Today</div>
              <div style={styles.smallStatValue}>1.0h</div>
            </div>
            <div style={styles.smallStat}>
              <div style={styles.metricLabel}>Remaining</div>
              <div style={styles.smallStatValue}>970h</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadingTab() {
  return (
    <div style={styles.largeCard}>
      <h2 style={styles.sectionTitle}>Reading</h2>
      <p style={styles.sectionText}>Reading tracker will go here next.</p>
    </div>
  );
}

function GamingTab() {
  return (
    <div style={styles.largeCard}>
      <h2 style={styles.sectionTitle}>Gaming</h2>
      <p style={styles.sectionText}>Gaming tracker will go here next.</p>
    </div>
  );
}

const glass = {
  background: "rgba(255,255,255,0.6)",
  border: "1px solid rgba(255,255,255,0.7)",
  boxShadow: "0 20px 60px rgba(15,23,42,0.12)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #ecfeff 100%)",
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: "#111827",
    padding: "24px",
    position: "relative",
    overflow: "hidden",
  },
  bgOrb1: {
    position: "absolute",
    width: "420px",
    height: "420px",
    borderRadius: "999px",
    background: "rgba(186,230,253,0.8)",
    filter: "blur(80px)",
    top: "-120px",
    left: "-80px",
    pointerEvents: "none",
  },
  bgOrb2: {
    position: "absolute",
    width: "420px",
    height: "420px",
    borderRadius: "999px",
    background: "rgba(221,214,254,0.7)",
    filter: "blur(80px)",
    top: "-120px",
    right: "-80px",
    pointerEvents: "none",
  },
  container: {
    maxWidth: "1300px",
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: "18px",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap: "18px",
  },
  heroCard: {
    ...glass,
    borderRadius: "30px",
    padding: "24px",
  },
  wordCard: {
    ...glass,
    borderRadius: "30px",
    padding: "24px",
  },
  eyebrow: {
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#667085",
    marginBottom: "8px",
  },
  title: {
    fontSize: "44px",
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
    margin: "0 0 10px 0",
  },
  subtitle: {
    color: "#667085",
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.6,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
    marginTop: "20px",
  },
  metricCard: {
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.72)",
    borderRadius: "22px",
    padding: "18px",
  },
  metricLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#667085",
    marginBottom: "8px",
  },
  metricValue: {
    fontSize: "28px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
  },
  word: {
    fontSize: "52px",
    fontWeight: 700,
    letterSpacing: "-0.05em",
    marginTop: "6px",
  },
  reading: {
    color: "#667085",
    fontSize: "18px",
    marginTop: "8px",
  },
  meaning: {
    marginTop: "10px",
    fontSize: "15px",
  },
  exampleBox: {
    marginTop: "16px",
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.48)",
    border: "1px solid rgba(255,255,255,0.68)",
    lineHeight: 1.6,
    fontSize: "14px",
  },
  exampleTranslation: {
    marginTop: "8px",
    color: "#667085",
    fontSize: "13px",
  },
  tabsWrap: {
    ...glass,
    borderRadius: "999px",
    padding: "10px",
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  tabButton: (active) => ({
    border: "none",
    borderRadius: "999px",
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    background: active ? "#111827" : "rgba(255,255,255,0.62)",
    color: active ? "#fff" : "#111827",
    boxShadow: active ? "0 10px 30px rgba(15,23,42,0.18)" : "none",
  }),
  contentWrap: {
    display: "grid",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.55fr 1fr",
    gap: "18px",
  },
  largeCard: {
    ...glass,
    borderRadius: "30px",
    padding: "24px",
  },
  sideColumn: {
    display: "grid",
    gap: "18px",
  },
  sideCard: {
    ...glass,
    borderRadius: "30px",
    padding: "24px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "18px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "24px",
    letterSpacing: "-0.03em",
  },
  sectionText: {
    margin: "8px 0 0 0",
    color: "#667085",
    fontSize: "14px",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.52)",
    border: "1px solid rgba(255,255,255,0.72)",
    fontSize: "13px",
    color: "#667085",
  },
  videoPlaceholder: {
    height: "420px",
    borderRadius: "24px",
    background:
      "linear-gradient(135deg, rgba(17,24,39,0.92), rgba(55,65,81,0.88))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "22px",
    fontWeight: 600,
    marginBottom: "18px",
  },
  progressBar: {
    width: "100%",
    height: "16px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "rgba(255,255,255,0.5)",
    border: "1px solid rgba(255,255,255,0.72)",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #111827 0%, #374151 100%)",
  },
  progressMeta: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "10px",
    color: "#667085",
    fontSize: "14px",
  },
  sideTitle: {
    margin: "0 0 14px 0",
    fontSize: "20px",
    letterSpacing: "-0.03em",
  },
  bigNumber: {
    fontSize: "56px",
    fontWeight: 700,
    letterSpacing: "-0.06em",
    textAlign: "center",
  },
  smallStatsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  smallStat: {
    padding: "16px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.48)",
    border: "1px solid rgba(255,255,255,0.68)",
  },
  smallStatValue: {
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
  },
};