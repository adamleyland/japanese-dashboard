import { supabase } from "@/lib/supabase";

export const GOOGLE_PROVIDER = "google";
export const GOOGLE_YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const GOOGLE_AUTH_INTENT_STORAGE_KEY = "supabase_google_auth_intent";
export const YOUTUBE_CONNECT_INTENT_STORAGE_KEY = "jp_youtube_connect_intent_v1";
export const IDENTITY_ALREADY_EXISTS_CODE = "identity_already_exists";

export function rememberYoutubeConnectIntent() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(YOUTUBE_CONNECT_INTENT_STORAGE_KEY, "true");
}

export function clearYoutubeConnectIntent() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(YOUTUBE_CONNECT_INTENT_STORAGE_KEY);
}

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

export function getGoogleIdentities(user) {
  if (!Array.isArray(user?.identities)) {
    return [];
  }

  return user.identities.filter((identity) => identity?.provider === GOOGLE_PROVIDER);
}

export function hasLinkedGoogleIdentity(user) {
  return getGoogleIdentities(user).length > 0;
}

export function summarizeGoogleIdentities(user) {
  const googleIdentities = getGoogleIdentities(user);

  return {
    identityCount: googleIdentities.length,
    identityIds: googleIdentities.map((identity) => identity?.id || "").filter(Boolean),
    identityEmails: googleIdentities
      .map((identity) => identity?.identity_data?.email || identity?.email || "")
      .filter(Boolean),
  };
}

export function isIdentityAlreadyExistsAuthError(value) {
  if (!value) {
    return false;
  }

  if (value instanceof URLSearchParams) {
    return (
      value.get("error_code") === IDENTITY_ALREADY_EXISTS_CODE ||
      value.get("auth_error_code") === IDENTITY_ALREADY_EXISTS_CODE ||
      value.get("error") === IDENTITY_ALREADY_EXISTS_CODE ||
      value.get("auth_error") === IDENTITY_ALREADY_EXISTS_CODE
    );
  }

  return (
    value.code === IDENTITY_ALREADY_EXISTS_CODE ||
    value.error_code === IDENTITY_ALREADY_EXISTS_CODE ||
    value.error === IDENTITY_ALREADY_EXISTS_CODE
  );
}

export function hasIdentityAlreadyExistsUrlError() {
  if (typeof window === "undefined") {
    return false;
  }

  return isIdentityAlreadyExistsAuthError(new URLSearchParams(window.location.search));
}

export async function readFreshSupabaseAuthState({ forceRefresh = false } = {}) {
  let { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (!sessionError && sessionData?.session && forceRefresh) {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error) {
      sessionData = refreshed.data;
    } else {
      sessionError = refreshed.error;
    }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  return {
    session: sessionData?.session ?? null,
    sessionError,
    user: userData?.user ?? null,
    userError,
  };
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
  rememberYoutubeConnectIntent();

  return supabase.auth.signInWithOAuth({
    provider: GOOGLE_PROVIDER,
    options: getGoogleAuthOptions(),
  });
}

export async function linkGoogleIdentity() {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(GOOGLE_AUTH_INTENT_STORAGE_KEY, "link");
  }
  rememberYoutubeConnectIntent();

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
  const rawError = searchParams.get("error");
  const message = searchParams.get("auth_message");

  if (isIdentityAlreadyExistsAuthError(searchParams)) {
    consumeGoogleAuthIntent();

    return {
      tone: "success",
      message: message || "Google is already linked. Restoring YouTube now.",
    };
  }

  if (error || rawError) {
    consumeGoogleAuthIntent();
    clearYoutubeConnectIntent();

    const resolvedError = error || rawError;
    return {
      tone: "error",
      message:
        message ||
        (resolvedError === "missing_code"
          ? "Google auth did not return a code."
          : resolvedError === "missing_session"
            ? "No active session was available for Google linking."
            : resolvedError === "oauth_cancelled" || resolvedError === "access_denied"
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
