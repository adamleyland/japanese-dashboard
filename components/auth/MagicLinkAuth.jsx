"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, LogOut, Mail, Moon, Sun, UserCircle2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  clearAuthCallbackUrlParams,
  linkGoogleIdentity,
  normalizeAuthStatusFromUrl,
  signInWithGoogle,
  storeYoutubeAuthResult,
} from "@/lib/auth";
import { useTheme } from "@/components/providers/ThemeProvider";

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.56 2.68-3.86 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.92-2.26c-.81.54-1.85.86-3.03.86-2.33 0-4.3-1.57-5-3.68H1.98V13c1.48 2.94 4.52 5 7.02 5Z"
      />
      <path
        fill="#FBBC05"
        d="M4 10.74A5.4 5.4 0 0 1 3.72 9c0-.6.1-1.18.28-1.74V4.98H1.98A9 9 0 0 0 1 9c0 1.45.35 2.82.98 4l2.02-2.26Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.33l2.58-2.58C13.45.9 11.42 0 9 0 5.5 0 2.46 2.06.98 4.98L4 7.26c.7-2.11 2.67-3.68 5-3.68Z"
      />
    </svg>
  );
}

export default function MagicLinkAuth({
  user,
  isCompact = false,
  isLoading,
  isMobile = false,
  embedded = false,
}) {
  const { isDarkMode, toggleTheme } = useTheme();
  const [email, setEmail] = useState(user?.email || "");
  const [isOpen, setIsOpen] = useState(embedded);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const popupRef = useRef(null);
  const googleIdentities = (user?.identities || []).filter(
    (identity) => identity?.provider === "google",
  );
  const googleIdentityCount = googleIdentities.length;
  const hasGoogleIdentity = googleIdentityCount > 0;
  const googleIdentityLabel =
    googleIdentityCount > 1
      ? `${googleIdentityCount} Google accounts linked`
      : hasGoogleIdentity
        ? "Google account linked"
        : "";

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextStatus = normalizeAuthStatusFromUrl(new URLSearchParams(window.location.search));
    if (!nextStatus) {
      return;
    }

    setStatusTone(nextStatus.tone);
    setStatusMessage(nextStatus.message);
    setIsOpen(true);
    storeYoutubeAuthResult({
      tone: nextStatus.tone,
      status: nextStatus.status || "",
      code: nextStatus.code || "",
      authErrorCode: nextStatus.authErrorCode || "",
      message: nextStatus.message || "",
    });
    clearAuthCallbackUrlParams();
  }, []);

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
          shouldCreateUser: false,
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

  const continueWithGoogle = async () => {
    setIsSubmitting(true);
    setStatusMessage("");
    setStatusTone("neutral");

    try {
      const { error } = await signInWithGoogle();
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Failed to start Supabase Google sign-in", error);
      setStatusTone("error");
      setStatusMessage(error.message || "Unable to continue with Google.");
      setIsSubmitting(false);
    }
  };

  const linkGoogleAccount = async () => {
    if (!user?.id) {
      console.error("A signed-in session is required before linking a Google identity");
      setStatusTone("error");
      setStatusMessage("Sign in before linking a Google account.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");
    setStatusTone("neutral");

    try {
      const { error } = await linkGoogleIdentity();
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Failed to start Supabase Google identity linking", error);
      setStatusTone("error");
      setStatusMessage(error.message || "Unable to link Google account.");
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

  const signedIn = !!user?.id;

  return (
    <div ref={popupRef} style={embedded ? styles.embeddedWrapper : styles.wrapper}>
      {!embedded ? (
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        style={styles.triggerButton(signedIn, isMobile)}
        aria-label={signedIn ? `Signed in as ${user?.email || "your account"}` : "Open sign-in"}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        {!isMobile ? <span style={styles.triggerDot(signedIn, isLoading)} /> : null}
        <UserCircle2 size={isMobile ? 22 : 16} strokeWidth={2} />
      </button>
      ) : null}

      {isOpen && (
        <div style={styles.popup(isCompact, isMobile, embedded)} role="dialog" aria-modal="false">
          <div style={styles.popupHeader}>
            <div style={styles.popupTitleWrap}>
              <div style={styles.eyebrow}>Sync</div>
              <div style={styles.title}>{signedIn ? "Signed in" : "Cross-device sign in"}</div>
            </div>

            {!embedded ? (
              <button type="button" onClick={() => setIsOpen(false)} style={styles.closeButton} aria-label="Close sign-in">
                <X size={14} strokeWidth={2} />
              </button>
            ) : null}
          </div>

          {signedIn ? (
            <>
              <div style={styles.accountRow}>
                <span style={styles.accountDot} />
                <span style={styles.accountLabel}>{user?.email || "Signed in"}</span>
              </div>

              {hasGoogleIdentity && <div style={styles.message("success")}>{googleIdentityLabel}</div>}

              <button type="button" onClick={toggleTheme} style={styles.themeRow}>
                <span style={styles.themeMeta}>
                  <span style={styles.themeIcon}>
                    {isDarkMode ? <Moon size={14} strokeWidth={2} /> : <Sun size={14} strokeWidth={2} />}
                  </span>
                  <span style={styles.themeLabel}>Dark mode</span>
                </span>
                <span style={styles.themeToggle(isDarkMode)}>
                  <span style={styles.themeToggleKnob(isDarkMode)} />
                </span>
              </button>

              {!!statusMessage && <div style={styles.message(statusTone)}>{statusMessage}</div>}

              <button
                type="button"
                onClick={linkGoogleAccount}
                disabled={isSubmitting}
                style={styles.secondaryButton}
              >
                <Link2 size={14} strokeWidth={2} />
                {hasGoogleIdentity ? "Link another Google account" : "Link Google account"}
              </button>

              <button type="button" onClick={signOut} disabled={isSubmitting} style={styles.secondaryButton}>
                <LogOut size={14} strokeWidth={2} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={continueWithGoogle} disabled={isSubmitting || isLoading} style={styles.primaryButton}>
                <span style={styles.googleIconWrap}>
                  <GoogleMark />
                </span>
                {isSubmitting ? "Redirecting..." : "Continue with Google"}
              </button>

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

              <button type="button" onClick={sendMagicLink} disabled={isSubmitting || isLoading} style={styles.secondaryButton}>
                <Mail size={14} strokeWidth={2} />
                {isSubmitting ? "Sending..." : "Sign in with Email"}
              </button>

              <button type="button" onClick={toggleTheme} style={styles.themeRow}>
                <span style={styles.themeMeta}>
                  <span style={styles.themeIcon}>
                    {isDarkMode ? <Moon size={14} strokeWidth={2} /> : <Sun size={14} strokeWidth={2} />}
                  </span>
                  <span style={styles.themeLabel}>Dark mode</span>
                </span>
                <span style={styles.themeToggle(isDarkMode)}>
                  <span style={styles.themeToggleKnob(isDarkMode)} />
                </span>
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
  embeddedWrapper: {
    width: "100%",
  },
  triggerButton: (signedIn, isMobile) => ({
    width: isMobile ? "44px" : "38px",
    height: isMobile ? "44px" : "38px",
    borderRadius: isMobile ? "12px" : "999px",
    border: isMobile
      ? "none"
      : signedIn
      ? "1px solid rgba(16,185,129,0.25)"
      : "1px solid var(--app-border)",
    background: isMobile ? "transparent" : "var(--app-surface)",
    color: signedIn
      ? isMobile
        ? "var(--app-text)"
        : "#047857"
      : "var(--app-text-muted)",
    boxShadow: isMobile ? "none" : "0 12px 28px rgba(15,23,42,0.08)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    opacity: signedIn || !isMobile ? 1 : 0.58,
    transition: "color 180ms ease, opacity 180ms ease",
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
  popup: (isCompact, isMobile, embedded) => ({
    position: embedded ? "relative" : "absolute",
    top: embedded ? "auto" : isMobile ? "auto" : "calc(100% + 10px)",
    bottom: embedded ? "auto" : isMobile ? "calc(100% + 10px)" : "auto",
    right: embedded ? "auto" : 0,
    width: embedded ? "100%" : isCompact ? "min(260px, calc(100vw - 56px))" : "280px",
    maxHeight: isMobile ? "calc(100dvh - 136px)" : "none",
    overflowY: isMobile ? "auto" : "visible",
    overscrollBehavior: "contain",
    borderRadius: "18px",
    border: "1px solid rgba(255,255,255,0.82)",
    background: "var(--app-surface-strong)",
    boxShadow: "0 22px 50px rgba(15,23,42,0.14)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    padding: "14px",
    display: "grid",
    gap: "10px",
    zIndex: 10020,
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
    color: "var(--app-text-faint)",
  },
  title: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--app-text)",
    marginTop: "2px",
  },
  closeButton: {
    width: "26px",
    height: "26px",
    borderRadius: "999px",
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-surface)",
    color: "var(--app-text-muted)",
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
    border: "1px solid var(--app-border)",
    background: "var(--app-surface)",
    padding: "10px 12px",
    color: "var(--app-text-muted)",
  },
  input: {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "13px",
    color: "var(--app-text)",
  },
  primaryButton: {
    border: "1px solid rgba(15,23,42,0.12)",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
  },
  googleIconWrap: {
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    background: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  secondaryButton: {
    border: "1px solid var(--app-border)",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "var(--app-surface)",
    color: "var(--app-text)",
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
    color: "var(--app-text)",
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
  themeRow: {
    width: "100%",
    border: "1px solid var(--app-border)",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "var(--app-surface)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    cursor: "pointer",
  },
  themeMeta: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
  themeIcon: {
    width: "24px",
    height: "24px",
    borderRadius: "999px",
    background: "var(--app-surface-soft)",
    color: "var(--app-text-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  themeLabel: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--app-text)",
  },
  themeToggle: (active) => ({
    width: "36px",
    height: "22px",
    borderRadius: "999px",
    background: active ? "#111827" : "var(--app-surface-soft)",
    border: active ? "1px solid rgba(15,23,42,0.32)" : "1px solid var(--app-border)",
    position: "relative",
    flexShrink: 0,
  }),
  themeToggleKnob: (active) => ({
    position: "absolute",
    top: "2px",
    left: active ? "16px" : "2px",
    width: "16px",
    height: "16px",
    borderRadius: "999px",
    background: "#ffffff",
    boxShadow: "0 2px 6px rgba(15,23,42,0.18)",
    transition: "left 180ms ease",
  }),
  message: (tone) => ({
    fontSize: "12px",
    color: tone === "error" ? "#b91c1c" : tone === "success" ? "#047857" : "var(--app-text-muted)",
    lineHeight: 1.4,
  }),
};
