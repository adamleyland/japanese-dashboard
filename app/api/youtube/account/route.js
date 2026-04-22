import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  deleteStoredGoogleOAuthTokens,
  getStoredGoogleOAuthTokens,
  getValidGoogleAccessToken,
  refreshGoogleAccessToken,
  revokeGoogleOAuthToken,
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
  return reason === "manual-connect";
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const { client } = createSupabaseServerClient(cookieStore);
  const { data, error } = await client.auth.getUser();

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

  return {
    user: data.user ?? null,
    error: null,
  };
}

async function buildAccountResponse(userId, requestReason) {
  const tokenResult = await getValidGoogleAccessToken(userId);

  if (!tokenResult.ok) {
    return tokenResult;
  }

  try {
    const bundle = await fetchYouTubeAccountBundle(tokenResult.accessToken, [], {
      reason: requestReason,
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

    if (!canRetryWithFreshToken) {
      throw error;
    }

    const refreshedToken = await refreshGoogleAccessToken(userId);
    if (!refreshedToken.ok) {
      return refreshedToken;
    }

    const bundle = await fetchYouTubeAccountBundle(refreshedToken.accessToken, [], {
      reason: `${requestReason}:refreshed-token`,
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
  const { user, error } = await getAuthenticatedUser();

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
    const response = await buildAccountResponse(user.id, requestReason);

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
