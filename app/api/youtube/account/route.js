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

async function buildAccountResponse(userId) {
  const tokenResult = await getValidGoogleAccessToken(userId);

  if (!tokenResult.ok) {
    return tokenResult;
  }

  try {
    const bundle = await fetchYouTubeAccountBundle(tokenResult.accessToken);

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

    const bundle = await fetchYouTubeAccountBundle(refreshedToken.accessToken);

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

  console.info("[YouTube API] Account bundle requested", {
    userId: user.id,
    requestReason,
  });

  try {
    const response = await buildAccountResponse(user.id);

    if (!response.ok) {
      if (response.code === "google_refresh_not_configured") {
        console.error("[YouTube API] Missing GOOGLE_CLIENT_SECRET for YouTube server refresh", {
          userId: user.id,
          requestReason,
        });
      }

      return jsonError(
        response.status || 400,
        response.code,
        response.message,
        response.source || "google",
      );
    }

    return NextResponse.json({
      ok: true,
      ...response.payload,
      lastSyncedAt: Date.now(),
    });
  } catch (routeError) {
    console.error("[YouTube API] Failed to build account bundle", {
      userId: user.id,
      requestReason,
      status: routeError?.status || 0,
      errorMessage: routeError?.message || String(routeError || ""),
      body: routeError?.errorInfo?.parsedBody || routeError?.errorInfo?.bodyText || null,
    });

    return jsonError(
      502,
      "youtube_fetch_failed",
      routeError?.message || "Failed to load YouTube account data.",
      "youtube",
    );
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
