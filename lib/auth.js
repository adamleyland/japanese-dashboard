import { supabase } from "@/lib/supabase";
import { fetchStoredGoogleAccessToken } from "@/lib/profiles";

export const GOOGLE_PROVIDER = "google";
export const GOOGLE_YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const GOOGLE_AUTH_INTENT_STORAGE_KEY = "supabase_google_auth_intent";

export function isAuthSessionMissingError(error) {
  return error?.name === "AuthSessionMissingError";
}

export async function getSafeAuthUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (isAuthSessionMissingError(error)) {
      return null;
    }

    console.error("Failed to resolve Supabase auth user", error);
    return null;
  }

  return data.user ?? null;
}

export function getAuthCallbackUrl() {
  if (typeof window === "undefined") {
    return "/auth/callback";
  }

  return `${window.location.origin}/auth/callback`;
}

function getGoogleAuthOptions() {
  return {
    redirectTo: getAuthCallbackUrl(),
    scopes: GOOGLE_YOUTUBE_SCOPE,
    queryParams: {
      prompt: "consent",
      access_type: "offline",
    },
  };
}

export async function signInWithGoogle() {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(GOOGLE_AUTH_INTENT_STORAGE_KEY, "signin");
  }

  return supabase.auth.signInWithOAuth({
    provider: GOOGLE_PROVIDER,
    options: getGoogleAuthOptions(),
  });
}

export async function linkGoogleIdentity() {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(GOOGLE_AUTH_INTENT_STORAGE_KEY, "link");
  }

  return supabase.auth.linkIdentity({
    provider: GOOGLE_PROVIDER,
    options: getGoogleAuthOptions(),
  });
}

function consumeGoogleAuthIntent() {
  if (typeof window === "undefined") {
    return "";
  }

  const intent = window.sessionStorage.getItem(GOOGLE_AUTH_INTENT_STORAGE_KEY) || "";
  if (intent) {
    window.sessionStorage.removeItem(GOOGLE_AUTH_INTENT_STORAGE_KEY);
  }

  return intent;
}

export function normalizeAuthStatusFromUrl(searchParams) {
  const status = searchParams.get("auth_status");
  const error = searchParams.get("auth_error");
  const message = searchParams.get("auth_message");

  if (error) {
    consumeGoogleAuthIntent();

    return {
      tone: "error",
      message:
        message ||
        (error === "missing_code"
          ? "Google auth did not return a code."
          : error === "missing_session"
            ? "No active session was available for Google linking."
            : error === "oauth_cancelled"
              ? "Google auth was cancelled."
              : "Google auth could not be completed."),
    };
  }

  if (status) {
    const intent = consumeGoogleAuthIntent();

    return {
      tone: "success",
      message:
        message ||
        (intent === "link"
          ? "Google account linked."
          : status === "google_authenticated"
            ? "Signed in with Google."
            : "Authentication updated."),
    };
  }

  return null;
}

export async function getGoogleAccessToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Failed to read Supabase session for Google provider token", error);
  }

  const sessionToken = data?.session?.provider_token || "";
  if (sessionToken) {
    return sessionToken;
  }

  const user = await getSafeAuthUser();
  if (!user?.id) {
    return null;
  }

  return (await fetchStoredGoogleAccessToken(user.id)) || null;
}
