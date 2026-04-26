import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getGoogleOAuthServerConfig } from "@/lib/serverEnv";

const GOOGLE_OAUTH_TOKENS_TABLE = "google_oauth_tokens";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;
const PROFILES_TABLE = "profiles";

function getTokensTable() {
  return getSupabaseAdminClient().from(GOOGLE_OAUTH_TOKENS_TABLE);
}

function toIsoExpiry(expiresInSeconds) {
  const expiresIn = Number(expiresInSeconds || 0);
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function isAccessTokenStillFresh(expiresAt) {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() > TOKEN_EXPIRY_SKEW_MS;
}

function summarizeStoredTokens(tokens) {
  return {
    hasStoredTokens: Boolean(tokens),
    hasAccessToken: Boolean(tokens?.access_token),
    hasRefreshToken: Boolean(tokens?.refresh_token),
    expiresAt: tokens?.expires_at || null,
    scope: tokens?.scope || "",
  };
}

function buildTokenFailure({
  code,
  message,
  status = 400,
  source = "google",
  details = {},
}) {
  return {
    ok: false,
    code,
    message,
    status,
    source,
    ...details,
  };
}

export async function getStoredGoogleOAuthTokens(userId) {
  if (!userId) {
    return null;
  }

  const { data, error } = await getTokensTable()
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function upsertGoogleOAuthTokens({
  userId,
  email,
  providerToken,
  providerRefreshToken,
  tokenType,
  scope,
  expiresAt,
}) {
  if (!userId) {
    return null;
  }

  const existingTokens = await getStoredGoogleOAuthTokens(userId);
  const nextRefreshToken = providerRefreshToken || existingTokens?.refresh_token || null;

  const { data, error } = await getTokensTable()
    .upsert(
      {
        user_id: userId,
        email: email ?? null,
        provider: "google",
        access_token: providerToken || existingTokens?.access_token || null,
        refresh_token: nextRefreshToken,
        token_type: tokenType || existingTokens?.token_type || null,
        scope: scope || existingTokens?.scope || null,
        expires_at: expiresAt || existingTokens?.expires_at || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteStoredGoogleOAuthTokens(userId) {
  if (!userId) {
    return;
  }

  const { error } = await getTokensTable().delete().eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function clearLegacyGoogleProviderTokens(userId) {
  if (!userId) {
    return;
  }

  const { error } = await getSupabaseAdminClient()
    .from(PROFILES_TABLE)
    .update({
      google_provider_token: null,
      google_provider_refresh_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error && !["42P01", "42703", "PGRST204"].includes(error.code || "")) {
    throw error;
  }
}

export async function revokeGoogleOAuthToken(token) {
  if (!token) {
    return;
  }

  const body = new URLSearchParams({
    token,
  });

  try {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error("[YouTube OAuth] Google revoke request failed", {
        status: response.status,
        responseText,
      });
    }
  } catch (error) {
    console.error("[YouTube OAuth] Failed to revoke Google token", {
      errorMessage: error?.message || String(error || ""),
    });
  }
}

export async function refreshGoogleAccessToken(userId) {
  const storedTokens = await getStoredGoogleOAuthTokens(userId);

  if (!storedTokens?.refresh_token) {
    console.warn("[YouTube OAuth] Missing stored Google refresh token", {
      userId,
      ...summarizeStoredTokens(storedTokens),
    });

    return buildTokenFailure({
      code: "google_refresh_token_missing",
      message: "No Google refresh token is stored for this user.",
      status: 409,
    });
  }

  const { clientId, clientSecret, hasClientId, hasClientSecret } = getGoogleOAuthServerConfig();

  if (!clientId || !clientSecret) {
    console.error("[YouTube OAuth] Server refresh is not fully configured", {
      userId,
      hasClientId,
      hasClientSecret,
      expectedEnv: "GOOGLE_CLIENT_SECRET",
    });

    return buildTokenFailure({
      code: "google_refresh_not_configured",
      message:
        "Google server refresh is not configured. Set GOOGLE_CLIENT_SECRET on the server to enable long-lived YouTube access.",
      status: 500,
      details: {
        hasClientId,
        hasClientSecret,
        hasStoredAccessToken: Boolean(storedTokens.access_token),
      },
    });
  }

  console.info("[YouTube OAuth] Refreshing Google access token", {
    userId,
    hasStoredAccessToken: Boolean(storedTokens.access_token),
    hasRefreshToken: true,
  });

  const requestBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: storedTokens.refresh_token,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: requestBody,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.access_token) {
    console.error("[YouTube OAuth] Google access token refresh failed", {
      userId,
      status: response.status,
      error: payload?.error || "",
      errorDescription: payload?.error_description || "",
    });

    return buildTokenFailure({
      code: "google_refresh_failed",
      message: payload?.error_description || payload?.error || "Failed to refresh Google access token.",
      status: response.status || 401,
      details: {
        googleError: payload?.error || "",
      },
    });
  }

  const expiresAt = toIsoExpiry(payload.expires_in);

  const { data, error } = await getTokensTable()
    .update({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || storedTokens.refresh_token,
      token_type: payload.token_type || storedTokens.token_type || null,
      scope: payload.scope || storedTokens.scope || null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  console.info("[YouTube OAuth] Google access token refreshed", {
    userId,
    expiresAt,
  });

  return {
    ok: true,
    accessToken: data.access_token,
    expiresAt: data.expires_at,
    refreshed: true,
  };
}

export async function getValidGoogleAccessToken(userId) {
  const storedTokens = await getStoredGoogleOAuthTokens(userId);

  if (!storedTokens) {
    console.warn("[YouTube OAuth] No stored Google OAuth tokens found", {
      userId,
    });

    return buildTokenFailure({
      code: "google_refresh_token_missing",
      message: "No stored Google YouTube authorization was found for this user.",
      status: 409,
    });
  }

  if (storedTokens.access_token && isAccessTokenStillFresh(storedTokens.expires_at)) {
    console.info("[YouTube OAuth] Using stored Google access token", {
      userId,
      ...summarizeStoredTokens(storedTokens),
      tokenSource: "stored-fresh-access-token",
    });

    return {
      ok: true,
      accessToken: storedTokens.access_token,
      expiresAt: storedTokens.expires_at,
      refreshed: false,
    };
  }

  const refreshResult = await refreshGoogleAccessToken(userId);
  if (refreshResult.ok) {
    console.info("[YouTube OAuth] Using refreshed Google access token", {
      userId,
      expiresAt: refreshResult.expiresAt || null,
      tokenSource: "refreshed-access-token",
    });

    return refreshResult;
  }

  if (refreshResult.code === "google_refresh_not_configured") {
    return refreshResult;
  }

  if (storedTokens.access_token) {
    console.info("[YouTube OAuth] Falling back to stored access token", {
      userId,
      reason: refreshResult.code,
      ...summarizeStoredTokens(storedTokens),
      tokenSource: "stored-stale-fallback",
    });

    return {
      ok: true,
      accessToken: storedTokens.access_token,
      expiresAt: storedTokens.expires_at,
      refreshed: false,
      staleFallback: true,
    };
  }

  return refreshResult;
}
