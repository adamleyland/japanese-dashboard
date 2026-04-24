import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  deleteStoredGoogleOAuthTokens,
  getStoredGoogleOAuthTokens,
  getValidGoogleAccessToken,
  refreshGoogleAccessToken,
  revokeGoogleOAuthToken,
  upsertGoogleOAuthTokens,
} from "@/lib/googleOAuthTokens";
import { fetchYouTubeAccountBundle } from "@/lib/youtubeServer";
import { logYoutubeApiCall } from "@/lib/youtubeDiagnostics";

const ACCOUNT_BUNDLE_CACHE_TTL_MS = 15 * 60 * 1000;
const accountBundleCache = new Map();
const inflightAccountBundleRequests = new Map();

function jsonError(status, code, message, source) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
      source,
    },
    { status },
  );
}

function getCacheKey(userId) {
  return String(userId || "");
}

function readCachedAccountBundle(userId) {
  const cacheKey = getCacheKey(userId);
  const cachedEntry = accountBundleCache.get(cacheKey);
  if (!cachedEntry) {
    return null;
  }

  if (Date.now() - cachedEntry.cachedAt > ACCOUNT_BUNDLE_CACHE_TTL_MS) {
    accountBundleCache.delete(cacheKey);
    return null;
  }

  return cachedEntry;
}

function writeCachedAccountBundle(userId, payload) {
  accountBundleCache.set(getCacheKey(userId), {
    cachedAt: Date.now(),
    payload,
  });
}

function clearCachedAccountBundle(userId) {
  accountBundleCache.delete(getCacheKey(userId));
  inflightAccountBundleRequests.delete(getCacheKey(userId));
}

function shouldBypassCache(reason) {
  return (
    reason === "manual-connect" ||
    reason === "reset-youtube-state" ||
    reason === "end_of_queue"
  );
}

function parseCsvParam(searchParams, key, limit = 100) {
  return [
    ...new Set(
      String(searchParams.get(key) || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].slice(0, limit);
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const { client } = createSupabaseServerClient(cookieStore);
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const { data, error } = await client.auth.getUser();

  if (sessionError) {
    console.error("[YouTube API] Failed to resolve Supabase session from cookies", {
      errorCode: sessionError.code || "",
      errorMessage: sessionError.message || "",
    });
  }

  if (error) {
    console.error("[YouTube API] Failed to resolve Supabase user from cookies", {
      errorCode: error.code || "",
      errorMessage: error.message || "",
    });
    return {
      user: null,
      error,
    };
  }

  console.info("[YouTube API] Resolved Supabase user from cookies", {
    hasUser: Boolean(data.user?.id),
    userId: data.user?.id || "",
    googleIdentityCount: Array.isArray(data.user?.identities)
      ? data.user.identities.filter((identity) => identity?.provider === "google").length
      : 0,
    hasProviderToken: Boolean(sessionData?.session?.provider_token),
    hasProviderRefreshToken: Boolean(sessionData?.session?.provider_refresh_token),
  });

  return {
    user: data.user ?? null,
    session: sessionData?.session ?? null,
    error: null,
  };
}

async function recoverGoogleTokensFromSession(userId, session) {
  const providerToken = session?.provider_token || "";
  const providerRefreshToken = session?.provider_refresh_token || "";

  if (!userId || !providerToken) {
    console.info("[YouTube API] Live Supabase session has no Google provider token to recover", {
      userId,
      hasProviderToken: Boolean(providerToken),
      hasProviderRefreshToken: Boolean(providerRefreshToken),
    });
    return false;
  }

  try {
    await upsertGoogleOAuthTokens({
      userId,
      email: session?.user?.email ?? null,
      providerToken,
      providerRefreshToken,
      tokenType: "Bearer",
      scope: session?.granted_scopes || "",
      expiresAt: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
    });

    console.info("[YouTube API] Recovered Google OAuth tokens from live Supabase session", {
      userId,
      hasProviderRefreshToken: Boolean(providerRefreshToken),
      grantedScopes: session?.granted_scopes || "",
    });

    return true;
  } catch (error) {
    console.error("[YouTube API] Failed to recover Google OAuth tokens from session", {
      userId,
      errorMessage: error?.message || String(error || ""),
    });
    return false;
  }
}

async function buildAccountResponse(userId, requestReason, session, queueOptions = {}) {
  let tokenResult = await getValidGoogleAccessToken(userId);

  if (!tokenResult.ok && tokenResult.code === "google_refresh_token_missing") {
    const recovered = await recoverGoogleTokensFromSession(userId, session);
    if (recovered) {
      tokenResult = await getValidGoogleAccessToken(userId);
    }
  }

  console.info("[YouTube API] Resolved Google token for account bundle request", {
    userId,
    requestReason,
    ok: Boolean(tokenResult?.ok),
    code: tokenResult?.code || "",
    refreshed: Boolean(tokenResult?.refreshed),
    staleFallback: Boolean(tokenResult?.staleFallback),
    expiresAt: tokenResult?.expiresAt || null,
  });

  if (!tokenResult.ok) {
    return tokenResult;
  }

  try {
    const bundle = await fetchYouTubeAccountBundle(tokenResult.accessToken, [], {
      reason: requestReason,
      ...queueOptions,
    });

    return {
      ok: true,
      payload: {
        accountProfile: bundle.accountProfile,
        subscribedChannels: bundle.subscribedChannels,
        accountVideos: bundle.accountVideos,
        quotaExceeded: bundle.quotaExceeded,
        tokenMeta: {
          expiresAt: tokenResult.expiresAt || null,
          refreshed: Boolean(tokenResult.refreshed),
          staleFallback: Boolean(tokenResult.staleFallback),
        },
      },
    };
  } catch (error) {
    const status = Number(error?.status || 0);
    const canRetryWithFreshToken = status === 401 || status === 403;

    console.error("[YouTube API] Initial account bundle fetch failed", {
      userId,
      requestReason,
      status,
      canRetryWithFreshToken,
      errorMessage: error?.message || String(error || ""),
      body: error?.errorInfo?.parsedBody || error?.errorInfo?.bodyText || null,
    });

    if (!canRetryWithFreshToken) {
      throw error;
    }

    const refreshedToken = await refreshGoogleAccessToken(userId);
    console.info("[YouTube API] Retrying account bundle after token refresh", {
      userId,
      requestReason,
      ok: Boolean(refreshedToken?.ok),
      code: refreshedToken?.code || "",
      expiresAt: refreshedToken?.expiresAt || null,
    });
    if (!refreshedToken.ok) {
      return refreshedToken;
    }

    const bundle = await fetchYouTubeAccountBundle(refreshedToken.accessToken, [], {
      reason: `${requestReason}:refreshed-token`,
      ...queueOptions,
    });

    return {
      ok: true,
      payload: {
        accountProfile: bundle.accountProfile,
        subscribedChannels: bundle.subscribedChannels,
        accountVideos: bundle.accountVideos,
        quotaExceeded: bundle.quotaExceeded,
        tokenMeta: {
          expiresAt: refreshedToken.expiresAt || null,
          refreshed: true,
          staleFallback: false,
        },
      },
    };
  }
}

export async function GET(request) {
  const { user, session, error } = await getAuthenticatedUser();

  if (error || !user?.id) {
    return jsonError(
      401,
      "supabase_session_missing",
      "No active Supabase session was found for YouTube restore.",
      "supabase",
    );
  }

  const requestUrl = new URL(request.url);
  const requestReason = requestUrl.searchParams.get("reason") || "unknown";
  const queueOptions = {
    selectedChannelIds: parseCsvParam(requestUrl.searchParams, "selectedChannelIds", 100),
    excludeVideoIds: parseCsvParam(requestUrl.searchParams, "excludeVideoIds", 100),
    recentVideoIds: parseCsvParam(requestUrl.searchParams, "recentVideoIds", 100),
  };
  const cacheBypass = shouldBypassCache(requestReason);
  const endpoint = "/api/youtube/account";

  logYoutubeApiCall({
    phase: "request",
    endpoint,
    reason: requestReason,
    caller: "youtubeAccountRoute.GET",
    transport: "server",
    details: {
      userId: user.id,
      cacheBypass,
      selectedChannelCount: queueOptions.selectedChannelIds.length,
      excludedVideoCount: queueOptions.excludeVideoIds.length,
      recentVideoCount: queueOptions.recentVideoIds.length,
    },
  });

  const cachedEntry = cacheBypass ? null : readCachedAccountBundle(user.id);
  if (cachedEntry) {
    logYoutubeApiCall({
      phase: "success",
      endpoint,
      reason: requestReason,
      caller: "youtubeAccountRoute.GET",
      transport: "server",
      cached: true,
      status: 200,
      details: {
        userId: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      ...cachedEntry.payload,
      servedFromCache: true,
      lastSyncedAt: cachedEntry.cachedAt,
    });
  }

  const cacheKey = getCacheKey(user.id);
  if (!cacheBypass && inflightAccountBundleRequests.has(cacheKey)) {
    const inflightResponse = await inflightAccountBundleRequests.get(cacheKey);

    logYoutubeApiCall({
      phase: inflightResponse?.ok ? "success" : "fail",
      endpoint,
      reason: requestReason,
      caller: "youtubeAccountRoute.GET",
      transport: "server",
      deduped: true,
      status: inflightResponse?.ok ? 200 : inflightResponse?.status || 500,
      details: {
        userId: user.id,
      },
    });

    if (!inflightResponse?.ok) {
      return jsonError(
        inflightResponse.status || 500,
        inflightResponse.code || "youtube_fetch_failed",
        inflightResponse.message || "Failed to load YouTube account data.",
        inflightResponse.source || "youtube",
      );
    }

    return NextResponse.json(inflightResponse);
  }

  const responsePromise = (async () => {
    const response = await buildAccountResponse(user.id, requestReason, session, queueOptions);

    if (!response.ok) {
      if (response.code === "google_refresh_not_configured") {
        console.error("[YouTube API] Missing GOOGLE_CLIENT_SECRET for YouTube server refresh", {
          userId: user.id,
          requestReason,
        });
      }

      return {
        ok: false,
        status: response.status || 400,
        code: response.code,
        message: response.message,
        source: response.source || "google",
      };
    }

    writeCachedAccountBundle(user.id, response.payload);

    return {
      ok: true,
      ...response.payload,
      servedFromCache: false,
      lastSyncedAt: Date.now(),
    };
  })();

  if (!cacheBypass) {
    inflightAccountBundleRequests.set(cacheKey, responsePromise);
  }

  try {
    const payload = await responsePromise;

    if (!payload.ok) {
      logYoutubeApiCall({
        phase: "fail",
        endpoint,
        reason: requestReason,
        caller: "youtubeAccountRoute.GET",
        transport: "server",
        status: payload.status,
        details: {
          userId: user.id,
          code: payload.code,
        },
      });

      return jsonError(
        payload.status,
        payload.code,
        payload.message,
        payload.source,
      );
    }

    console.info("[YouTube API] Account route returning connected payload", {
      userId: user.id,
      requestReason,
      servedFromCache: Boolean(payload.servedFromCache),
      hasAccountProfile: Boolean(payload.accountProfile),
      subscribedChannelCount: Array.isArray(payload.subscribedChannels)
        ? payload.subscribedChannels.length
        : 0,
      accountVideoCount: Array.isArray(payload.accountVideos) ? payload.accountVideos.length : 0,
      firstVideoId: payload.accountVideos?.[0]?.id || "",
    });
    logYoutubeApiCall({
      phase: "success",
      endpoint,
      reason: requestReason,
      caller: "youtubeAccountRoute.GET",
      transport: "server",
      status: 200,
      details: {
        userId: user.id,
      },
    });

    return NextResponse.json(payload);
  } catch (routeError) {
    console.error("[YouTube API] Failed to build account bundle", {
      userId: user.id,
      requestReason,
      status: routeError?.status || 0,
      errorMessage: routeError?.message || String(routeError || ""),
      body: routeError?.errorInfo?.parsedBody || routeError?.errorInfo?.bodyText || null,
    });
    logYoutubeApiCall({
      phase: "fail",
      endpoint,
      reason: requestReason,
      caller: "youtubeAccountRoute.GET",
      transport: "server",
      status: 502,
      details: {
        userId: user.id,
      },
    });

    return jsonError(
      502,
      "youtube_fetch_failed",
      routeError?.message || "Failed to load YouTube account data.",
      "youtube",
    );
  } finally {
    if (!cacheBypass) {
      inflightAccountBundleRequests.delete(cacheKey);
    }
  }
}

export async function DELETE() {
  const { user, error } = await getAuthenticatedUser();

  if (error || !user?.id) {
    return jsonError(
      401,
      "supabase_session_missing",
      "No active Supabase session was found for YouTube disconnect.",
      "supabase",
    );
  }

  try {
    const storedTokens = await getStoredGoogleOAuthTokens(user.id);

    if (storedTokens?.refresh_token) {
      await revokeGoogleOAuthToken(storedTokens.refresh_token);
    }

    if (storedTokens?.access_token) {
      await revokeGoogleOAuthToken(storedTokens.access_token);
    }

    await deleteStoredGoogleOAuthTokens(user.id);
    clearCachedAccountBundle(user.id);

    logYoutubeApiCall({
      phase: "success",
      endpoint: "/api/youtube/account",
      reason: "disconnect",
      caller: "youtubeAccountRoute.DELETE",
      transport: "server",
      status: 200,
      details: {
        userId: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (deleteError) {
    console.error("[YouTube API] Failed to disconnect stored Google tokens", {
      userId: user.id,
      errorMessage: deleteError?.message || String(deleteError || ""),
    });

    return jsonError(
      500,
      "youtube_disconnect_failed",
      "Failed to disconnect stored YouTube authorization.",
      "google",
    );
  }
}
