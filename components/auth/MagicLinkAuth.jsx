"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MagicLinkAuth({ session, user, isCompact, isLoading }) {
  const [email, setEmail] = useState(user?.email || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  const sendMagicLink = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatusMessage("Enter an email address to send a magic link.");
      return;
    }

    if (typeof window === "undefined") {
      setStatusMessage("Magic Link sign-in is only available in the browser.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");

    try {
      // Supabase Auth config must include:
      // Site URL: https://japanese-dashboard.vercel.app
      // Redirect URLs:
      // - http://localhost:3000
      // - https://japanese-dashboard.vercel.app
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }

      setStatusMessage("Magic link sent. Open it on this device or another device to sign in.");
    } catch (error) {
      console.error("Failed to send Supabase magic link", error);
      setStatusMessage(error.message || "Unable to send magic link right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = async () => {
    setIsSubmitting(true);
    setStatusMessage("");

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      setStatusMessage("Signed out.");
    } catch (error) {
      console.error("Failed to sign out from Supabase", error);
      setStatusMessage(error.message || "Unable to sign out right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section style={cardStyle}>
      <div style={headerRowStyle(isCompact)}>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrowStyle}>Sync</div>
          <div style={titleStyle}>Cross-device tracking</div>
          <div style={subtitleStyle}>
            {isLoading
              ? "Checking your session..."
              : session?.user
              ? `Signed in as ${user?.email || "your account"}`
              : "Sign in with a Supabase magic link to sync listening data."}
          </div>
        </div>

        {session?.user && (
          <button type="button" onClick={signOut} disabled={isSubmitting} style={secondaryButtonStyle}>
            Sign out
          </button>
        )}
      </div>

      {!session?.user && (
        <div style={controlsStyle(isCompact)}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            style={inputStyle}
          />
          <button type="button" onClick={sendMagicLink} disabled={isSubmitting} style={primaryButtonStyle}>
            {isSubmitting ? "Sending..." : "Send magic link"}
          </button>
        </div>
      )}

      {!!user?.id && (
        <div style={metaStyle}>
          Tracking ready for user <code>{user.id}</code>
        </div>
      )}

      {!!statusMessage && <div style={messageStyle}>{statusMessage}</div>}
    </section>
  );
}

const cardStyle = {
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(255,255,255,0.8)",
  boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  borderRadius: "20px",
  padding: "16px",
  marginBottom: "16px",
  display: "grid",
  gap: "12px",
};

const headerRowStyle = (isCompact) => ({
  display: "flex",
  flexDirection: isCompact ? "column" : "row",
  gap: "12px",
  alignItems: isCompact ? "stretch" : "center",
  justifyContent: "space-between",
});

const eyebrowStyle = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#64748b",
};

const titleStyle = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#111827",
};

const subtitleStyle = {
  fontSize: "13px",
  color: "#475569",
  marginTop: "4px",
};

const controlsStyle = (isCompact) => ({
  display: "grid",
  gridTemplateColumns: isCompact ? "1fr" : "minmax(0, 1fr) auto",
  gap: "10px",
});

const inputStyle = {
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid rgba(15,23,42,0.12)",
  background: "#fff",
  fontSize: "14px",
  color: "#111827",
};

const primaryButtonStyle = {
  border: "none",
  borderRadius: "12px",
  padding: "10px 14px",
  background: "#111827",
  color: "#fff",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  border: "1px solid rgba(15,23,42,0.12)",
  borderRadius: "12px",
  padding: "10px 14px",
  background: "#fff",
  color: "#111827",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const metaStyle = {
  fontSize: "12px",
  color: "#334155",
};

const messageStyle = {
  fontSize: "12px",
  color: "#475569",
};
