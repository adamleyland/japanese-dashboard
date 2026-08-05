"use client";

import { LockKeyhole } from "lucide-react";
import MagicLinkAuth from "@/components/auth/MagicLinkAuth";

export default function AuthGate({ isLoading = false }) {
  return (
    <main style={styles.page}>
      <div style={styles.orbLeft} />
      <div style={styles.orbRight} />
      <section style={styles.card} aria-label="Sign in to the Japanese tracker">
        <div style={styles.icon}>
          <LockKeyhole size={22} strokeWidth={2.2} />
        </div>
        <div style={styles.copy}>
          <div style={styles.eyebrow}>Japanese Tracker</div>
          <h1 style={styles.title}>Sign in to continue</h1>
          <p style={styles.description}>
            Your learning history and tracking tools are available only after sign-in.
          </p>
        </div>
        <MagicLinkAuth embedded isLoading={isLoading} />
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    padding: "24px",
    display: "grid",
    placeItems: "center",
    position: "relative",
    overflow: "hidden",
    background: "var(--app-page-bg)",
  },
  orbLeft: {
    position: "absolute",
    width: "420px",
    height: "420px",
    left: "-180px",
    top: "-160px",
    borderRadius: "999px",
    background: "var(--app-orb-1)",
    filter: "blur(80px)",
    pointerEvents: "none",
  },
  orbRight: {
    position: "absolute",
    width: "420px",
    height: "420px",
    right: "-180px",
    bottom: "-160px",
    borderRadius: "999px",
    background: "var(--app-orb-2)",
    filter: "blur(80px)",
    pointerEvents: "none",
  },
  card: {
    width: "min(100%, 400px)",
    display: "grid",
    gap: "18px",
    position: "relative",
    zIndex: 1,
    padding: "28px",
    borderRadius: "26px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-card)",
    boxShadow: "0 26px 70px rgba(15,23,42,0.16)",
  },
  icon: {
    width: "46px",
    height: "46px",
    borderRadius: "16px",
    display: "grid",
    placeItems: "center",
    color: "#7c3aed",
    background: "rgba(139,92,246,0.12)",
    border: "1px solid rgba(139,92,246,0.18)",
  },
  copy: {
    display: "grid",
    gap: "7px",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--app-text-muted)",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.1,
    letterSpacing: "-0.035em",
    color: "var(--app-text)",
  },
  description: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.5,
    color: "var(--app-text-muted)",
  },
};
