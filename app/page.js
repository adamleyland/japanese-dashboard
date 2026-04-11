"use client";

import { useMemo, useState } from "react";
import { Blocks, Ear, BookOpenText, Gamepad2  } from "lucide-react";

export default function Home() {
  const [tab, setTab] = useState("listening");
  const [listeningHours, setListeningHours] = useState(1030);
  const [shadowingHours, setShadowingHours] = useState(180);
  const [gamingHours, setGamingHours] = useState(280);
  const [wordsRead, setWordsRead] = useState(3050000);
  const [wordsWritten, setWordsWritten] = useState(260000);
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false);

  const overallHours = useMemo(
    () => listeningHours + gamingHours + shadowingHours,
    [listeningHours, gamingHours, shadowingHours]
  );

  return (
    <main style={styles.page}>
      <div style={styles.bgOrb1} />
      <div style={styles.bgOrb2} />
      <div style={styles.container}>
        <section style={styles.heroGrid}>
          <div style={styles.heroCard}>
            <h1 style={styles.title}>Japanese Progress</h1>

            <div style={styles.overallRow}>
              <MetricCard
                label="Overall hours"
                value={formatHours(overallHours)}
                icon={<Blocks size={20} strokeWidth={2} color="#ef4444" />}
                featured
              />
            </div>

            <div style={styles.metricsGridThree}>
              <MetricCard
                label="Listening hours"
                value={formatHours(listeningHours)}
                icon={<Ear size={20} strokeWidth={2} color="#eab308" />}
                onQuickAdd={() => setListeningHours((value) => value + 1)}
                quickAddLabel="+1h"
              />
              <MetricCard
                label="Words read"
                value={formatWords(wordsRead)}
                icon={<BookOpenText size={20} strokeWidth={2} color="#3b82f6" />}
                onQuickAdd={() => setWordsRead((value) => value + 1000)}
                quickAddLabel="+1k"
              />
              <MetricCard
                label="Gaming hours"
                value={formatHours(gamingHours)}
                icon={<Gamepad2 size={20} strokeWidth={2} color="#8b5cf6" />}
                onQuickAdd={() => setGamingHours((value) => value + 1)}
                quickAddLabel="+1h"
              />
            </div>

            <details
              style={styles.expandableWrap}
              open={isAdditionalOpen}
              onToggle={(event) => setIsAdditionalOpen(event.currentTarget.open)}
            >
              <summary style={styles.expandableSummary}>
                <span>Additional metrics</span>
                <span style={styles.expandableArrow}>
                  {isAdditionalOpen ? "▲" : "▼"}
                </span>
              </summary>
              <div style={styles.subMetricsGrid}>
                <SubMetricCard
                  label="Shadowing hours"
                  value={formatHours(shadowingHours)}
                  onQuickAdd={() => setShadowingHours((value) => value + 0.5)}
                  quickAddLabel="+0.5h"
                />
                <SubMetricCard
                  label="Words written"
                  value={formatWords(wordsWritten)}
                  onQuickAdd={() => setWordsWritten((value) => value + 500)}
                  quickAddLabel="+500"
                />
              </div>
            </details>
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
          {tab === "listening" && (
            <ListeningTab
              listeningHours={listeningHours}
              shadowingHours={shadowingHours}
              setListeningHours={setListeningHours}
              setShadowingHours={setShadowingHours}
            />
          )}
          {tab === "reading" && (
            <ReadingTab
              wordsRead={wordsRead}
              wordsWritten={wordsWritten}
              setWordsRead={setWordsRead}
              setWordsWritten={setWordsWritten}
            />
          )}
          {tab === "gaming" && (
            <GamingTab gamingHours={gamingHours} setGamingHours={setGamingHours} />
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon,
  onQuickAdd,
  quickAddLabel = "+1",
  featured = false,
}) {
  return (
    <div style={styles.metricCard(featured)}>
      <div style={styles.metricTopRow}>
        <div style={styles.metricIconWrap(featured)}>{icon}</div>
        {onQuickAdd ? (
          <button onClick={onQuickAdd} style={styles.quickAddButton}>
            {quickAddLabel}
          </button>
        ) : null}
      </div>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue(featured)}>{value}</div>
    </div>
  );
}

function SubMetricCard({ label, value, onQuickAdd, quickAddLabel = "+1" }) {
  return (
    <div style={styles.metricCard(false)}>
      <div style={styles.metricTopRow}>
        <div style={styles.metricLabel}>{label}</div>
        {onQuickAdd ? (
          <button onClick={onQuickAdd} style={styles.quickAddButton}>
            {quickAddLabel}
          </button>
        ) : null}
      </div>
      <div style={styles.metricValue(false)}>{value}</div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1 }) {
  return (
    <label style={styles.inputCard}>
      <span style={styles.inputLabel}>{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        style={styles.input}
      />
    </label>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={styles.tabButton(active)}>
      {children}
    </button>
  );
}

function ListeningTab({
  listeningHours,
  shadowingHours,
  setListeningHours,
  setShadowingHours,
}) {
  return (
    <div style={styles.mainGrid}>
      <div style={styles.largeCard}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Listening</h2>
            <p style={styles.sectionText}>
              Adjust your active listening and shadowing totals here.
            </p>
          </div>
          <div style={styles.pill}>Main learning area</div>
        </div>

        <div style={styles.controlGrid}>
          <NumberField
            label="Listening hours"
            value={listeningHours}
            onChange={setListeningHours}
            step={0.5}
          />
          <NumberField
            label="Shadowing hours"
            value={shadowingHours}
            onChange={setShadowingHours}
            step={0.5}
          />
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
              <div style={styles.metricLabel}>Listening</div>
              <div style={styles.smallStatValue}>{formatHours(listeningHours)}</div>
            </div>
            <div style={styles.smallStat}>
              <div style={styles.metricLabel}>Shadowing</div>
              <div style={styles.smallStatValue}>{formatHours(shadowingHours)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadingTab({ wordsRead, wordsWritten, setWordsRead, setWordsWritten }) {
  return (
    <div style={styles.largeCard}>
      <h2 style={styles.sectionTitle}>Reading & Writing</h2>
      <p style={styles.sectionText}>Keep word totals current to drive dashboard metrics.</p>

      <div style={styles.controlGrid}>
        <NumberField
          label="Words read"
          value={wordsRead}
          onChange={setWordsRead}
          step={100}
        />
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

function GamingTab({ gamingHours, setGamingHours }) {
  return (
    <div style={styles.largeCard}>
      <h2 style={styles.sectionTitle}>Gaming</h2>
      <p style={styles.sectionText}>Track immersion hours from Japanese games.</p>

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

function formatHours(value) {
  return `${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}h`;
}

function formatWords(value) {
  return Number(value).toLocaleString();
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
  logoSlot: {
    width: "52px",
    height: "52px",
    borderRadius: "16px",
    border: "1px dashed rgba(15,23,42,0.2)",
    background: "rgba(255,255,255,0.35)",
    marginBottom: "10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
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
    lineHeight: 1.2,
    letterSpacing: "-0.05em",
    margin: "10px 0 35px 0",
  },
  subtitle: {
    color: "#667085",
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.6,
  },
  overallRow: {
    marginTop: "20px",
  },
  metricsGridThree: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
    marginTop: "12px",
  },
  subMetricsGrid: {
    marginTop: "10px",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  metricCard: (featured) => ({
    background: featured ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.58)",
    border: "1px solid rgba(255,255,255,0.82)",
    boxShadow: featured
      ? "0 16px 36px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.7)"
      : "0 12px 26px rgba(15,23,42,0.1)",
    borderRadius: featured ? "24px" : "22px",
    padding: featured ? "20px" : "18px",
  }),
  metricTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
  },
  metricIconWrap: (featured) => ({
    width: featured ? "40px" : "34px",
    height: featured ? "40px" : "34px",
    borderRadius: "12px",
    border: "1px solid rgba(15,23,42,0.1)",
    background: "rgba(255,255,255,0.85)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: featured ? "20px" : "18px",
  }),
  quickAddButton: {
    border: "1px solid rgba(15,23,42,0.14)",
    background: "rgba(255,255,255,0.9)",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#111827",
    cursor: "pointer",
  },
  quickAddButtonSub: {
    border: "1px solid rgba(15,23,42,0.1)",
    background: "rgba(255,255,255,0.85)",
    borderRadius: "999px",
    padding: "5px 9px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#111827",
    cursor: "pointer",
  },
  metricLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#667085",
    marginBottom: "8px",
  },
  metricValue: (featured) => ({
    fontSize: featured ? "40px" : "30px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
  }),
  expandableWrap: {
    marginTop: "12px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.32)",
    border: "1px solid rgba(255,255,255,0.62)",
    padding: "12px",
  },
  expandableSummary: {
    cursor: "pointer",
    listStyle: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#667085",
  },
  expandableArrow: {
    fontSize: "20px",
    lineHeight: 1,
    color: "#cbd5e1",
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
  controlGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    marginTop: "18px",
  },
  controlGridSingle: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 360px)",
    marginTop: "18px",
  },
  inputCard: {
    display: "grid",
    gap: "8px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.48)",
    border: "1px solid rgba(255,255,255,0.68)",
    padding: "14px",
  },
  inputLabel: {
    fontSize: "12px",
    color: "#667085",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  input: {
    width: "100%",
    border: "1px solid rgba(15, 23, 42, 0.12)",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "18px",
    fontWeight: 600,
    color: "#111827",
    background: "rgba(255,255,255,0.9)",
    outline: "none",
  },
};