import { supabase } from "@/lib/supabase";

export const GOOGLE_PROVIDER = "google";
export const GOOGLE_YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
export const GOOGLE_AUTH_INTENT_STORAGE_KEY = "supabase_google_auth_intent";
export const YOUTUBE_CONNECT_INTENT_STORAGE_KEY = "jp_youtube_connect_intent_v1";
export const YOUTUBE_AUTH_RESULT_STORAGE_KEY = "jp_youtube_auth_result_v1";
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

export function clearGoogleAuthIntent() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(GOOGLE_AUTH_INTENT_STORAGE_KEY);
}

export function storeYoutubeAuthResult(result) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      YOUTUBE_AUTH_RESULT_STORAGE_KEY,
      JSON.stringify({
        ...result,
        recordedAt: Date.now(),
      }),
    );
  } catch (error) {
    console.error("Failed to persist YouTube auth result to sessionStorage", error);
  }
}

export function consumeYoutubeAuthResult() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(YOUTUBE_AUTH_RESULT_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    window.sessionStorage.removeItem(YOUTUBE_AUTH_RESULT_STORAGE_KEY);
    return JSON.parse(rawValue);
  } catch (error) {
    console.error("Failed to parse stored YouTube auth result", error);
    window.sessionStorage.removeItem(YOUTUBE_AUTH_RESULT_STORAGE_KEY);
    return null;
  }
}

export function clearYoutubeAuthResult() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(YOUTUBE_AUTH_RESULT_STORAGE_KEY);
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

export function clearAuthCallbackUrlParams() {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = new URL(window.location.href);
  [
    "auth_status",
    "auth_error",
    "auth_error_code",
    "auth_message",
    "error",
    "error_code",
    "error_description",
    "code",
    "state",
    "scope",
  ].forEach((param) => {
    nextUrl.searchParams.delete(param);
  });

  window.history.replaceState({}, "", nextUrl.toString());
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
  const authErrorCode =
    searchParams.get("auth_error_code") || searchParams.get("error_code") || "";

  if (isIdentityAlreadyExistsAuthError(searchParams)) {
    consumeGoogleAuthIntent();

    return {
      status: "google_identity_already_linked",
      code: "",
      authErrorCode,
      tone: "success",
      message: message || "Google is already linked. Restoring YouTube now.",
    };
  }

  if (error || rawError) {
    consumeGoogleAuthIntent();
    clearYoutubeConnectIntent();

    const resolvedError = error || rawError;
    return {
      status: "",
      code: resolvedError,
      authErrorCode,
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
      status,
      code: "",
      authErrorCode,
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
