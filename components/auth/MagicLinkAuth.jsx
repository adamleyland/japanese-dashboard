"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Mail, UserCircle2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function MagicLinkAuth({ session, user, isCompact, isLoading }) {
  const [email, setEmail] = useState(user?.email || "");
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const popupRef = useRef(null);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const sendMagicLink = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatusTone("error");
      setStatusMessage("Enter an email.");
      return;
    }

    if (typeof window === "undefined") {
      setStatusTone("error");
      setStatusMessage("Browser sign-in only.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");
    setStatusTone("neutral");

    try {
      // Supabase Auth > URL Configuration must include this origin in Redirect URLs.
      // detectSessionInUrl is enabled in lib/supabase.js so magic-link callbacks restore auth state in-place.
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }

      setStatusTone("success");
      setStatusMessage("Magic link sent.");
    } catch (error) {
      console.error("Failed to send Supabase magic link", error);
      setStatusTone("error");
      setStatusMessage(error.message || "Unable to send link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = async () => {
    setIsSubmitting(true);
    setStatusMessage("");
    setStatusTone("neutral");

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      setIsOpen(false);
    } catch (error) {
      console.error("Failed to sign out from Supabase", error);
      setStatusTone("error");
      setStatusMessage(error.message || "Unable to sign out.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const signedIn = !!session?.user;

  return (
    <div ref={popupRef} style={styles.wrapper}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        style={styles.triggerButton(signedIn)}
        aria-label={signedIn ? `Signed in as ${user?.email || "your account"}` : "Open sign-in"}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span style={styles.triggerDot(signedIn, isLoading)} />
        <UserCircle2 size={16} strokeWidth={2} />
      </button>

      {isOpen && (
        <div style={styles.popup(isCompact)} role="dialog" aria-modal="false">
          <div style={styles.popupHeader}>
            <div style={styles.popupTitleWrap}>
              <div style={styles.eyebrow}>Sync</div>
              <div style={styles.title}>{signedIn ? "Signed in" : "Cross-device sign in"}</div>
            </div>

            <button type="button" onClick={() => setIsOpen(false)} style={styles.closeButton} aria-label="Close sign-in">
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          {signedIn ? (
            <>
              <div style={styles.accountRow}>
                <span style={styles.accountDot} />
                <span style={styles.accountLabel}>{user?.email || "Signed in"}</span>
              </div>

              {!!statusMessage && <div style={styles.message(statusTone)}>{statusMessage}</div>}

              <button type="button" onClick={signOut} disabled={isSubmitting} style={styles.secondaryButton}>
                <LogOut size={14} strokeWidth={2} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <label style={styles.inputWrap}>
                <Mail size={14} strokeWidth={2} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  style={styles.input}
                />
              </label>

              <button type="button" onClick={sendMagicLink} disabled={isSubmitting || isLoading} style={styles.primaryButton}>
                {isSubmitting ? "Sending..." : "Send magic link"}
              </button>

              {!!statusMessage && <div style={styles.message(statusTone)}>{statusMessage}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    position: "relative",
    flexShrink: 0,
  },
  triggerButton: (signedIn) => ({
    width: "38px",
    height: "38px",
    borderRadius: "999px",
    border: signedIn ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(15,23,42,0.1)",
    background: "rgba(255,255,255,0.86)",
    color: signedIn ? "#047857" : "#475569",
    boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
  }),
  triggerDot: (signedIn, isLoading) => ({
    position: "absolute",
    top: "7px",
    right: "7px",
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: isLoading ? "#cbd5e1" : signedIn ? "#10b981" : "#cbd5e1",
    boxShadow: "0 0 0 2px rgba(255,255,255,0.95)",
  }),
  popup: (isCompact) => ({
    position: "absolute",
    top: "calc(100% + 10px)",
    right: 0,
    width: isCompact ? "min(260px, calc(100vw - 56px))" : "280px",
    borderRadius: "18px",
    border: "1px solid rgba(255,255,255,0.82)",
    background: "rgba(255,255,255,0.95)",
    boxShadow: "0 22px 50px rgba(15,23,42,0.14)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    padding: "14px",
    display: "grid",
    gap: "10px",
    zIndex: 20,
  }),
  popupHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  popupTitleWrap: {
    minWidth: 0,
  },
  eyebrow: {
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#94a3b8",
  },
  title: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#111827",
    marginTop: "2px",
  },
  closeButton: {
    width: "26px",
    height: "26px",
    borderRadius: "999px",
    border: "1px solid rgba(15,23,42,0.08)",
    background: "rgba(255,255,255,0.9)",
    color: "#64748b",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "12px",
    border: "1px solid rgba(15,23,42,0.1)",
    background: "#fff",
    padding: "10px 12px",
    color: "#64748b",
  },
  input: {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "13px",
    color: "#111827",
  },
  primaryButton: {
    border: "none",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "#111827",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(15,23,42,0.1)",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "#fff",
    color: "#111827",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  accountRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "#0f172a",
    minWidth: 0,
  },
  accountDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "#10b981",
    flexShrink: 0,
  },
  accountLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  message: (tone) => ({
    fontSize: "12px",
    color: tone === "error" ? "#b91c1c" : tone === "success" ? "#047857" : "#64748b",
    lineHeight: 1.4,
  }),
};
