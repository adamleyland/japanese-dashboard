import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/profiles";
import { upsertGoogleOAuthTokens } from "@/lib/googleOAuthTokens";
import { logAuthError, logAuthInfo, summarizeSupabaseSession } from "@/lib/authLogging";

function buildRedirectUrl(request, params = {}) {
  const redirectUrl = new URL("/", request.url);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      redirectUrl.searchParams.set(key, value);
    }
  });

  return redirectUrl;
}

function redirectWithCookies(request, pendingCookies = [], params = {}) {
  const response = NextResponse.redirect(buildRedirectUrl(request, params));

  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}

function clearPkceVerifierCookies(cookieStore, pendingCookies = []) {
  const pkceCookieNames = cookieStore
    .getAll()
    .map((cookie) => cookie?.name || "")
    .filter((name) => name.endsWith("-code-verifier"));

  pkceCookieNames.forEach((name) => {
    const options = {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    };

    pendingCookies.push({ name, value: "", options });
    cookieStore.set(name, "", options);
  });

  return pkceCookieNames;
}

function deriveGoogleProviderExpiry() {
  return new Date(Date.now() + 55 * 60 * 1000).toISOString();
}

function mergeSupabaseSession(primarySession, fallbackSession) {
  if (!primarySession && !fallbackSession) {
    return null;
  }

  return {
    ...(fallbackSession || {}),
    ...(primarySession || {}),
    user: primarySession?.user || fallbackSession?.user || null,
    provider_token: primarySession?.provider_token || fallbackSession?.provider_token || "",
    provider_refresh_token:
      primarySession?.provider_refresh_token || fallbackSession?.provider_refresh_token || "",
    granted_scopes: primarySession?.granted_scopes || fallbackSession?.granted_scopes || "",
  };
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const authError = requestUrl.searchParams.get("error");
  const authErrorCode = requestUrl.searchParams.get("error_code");
  const authErrorDescription = requestUrl.searchParams.get("error_description");
  const cookieStore = await cookies();
  const pendingCookies = [];

  logAuthInfo("Callback", "Google auth callback received", {
    hasCode: Boolean(code),
    authError,
    authErrorCode,
  });

  if (authError) {
    const clearedPkceCookies = clearPkceVerifierCookies(cookieStore, pendingCookies);
    logAuthError("Callback", "Supabase Google auth callback returned an error", null, {
      authError,
      authErrorCode,
      authErrorDescription,
      clearedPkceCookieCount: clearedPkceCookies.length,
    });

    if (authErrorCode === "identity_already_exists") {
      return redirectWithCookies(request, pendingCookies, {
        auth_status: "google_identity_already_linked",
        auth_message: "Google is already linked. Restoring YouTube now.",
        auth_error_code: authErrorCode,
      });
    }

    return redirectWithCookies(request, pendingCookies, {
      auth_error: authError === "access_denied" ? "oauth_cancelled" : authError,
      auth_message: authErrorDescription || "Google auth could not be completed.",
      auth_error_code: authErrorCode || "",
    });
  }

  if (!code) {
    clearPkceVerifierCookies(cookieStore, pendingCookies);
    logAuthError("Callback", "Supabase Google auth callback is missing an auth code");

    return redirectWithCookies(request, pendingCookies, {
      auth_error: "missing_code",
    });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        flowType: "pkce",
      },
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          pendingCookies.push({ name, value, options });
          cookieStore.set(name, value, options);
        },
        remove(name, options) {
          const removeOptions = {
            ...options,
            maxAge: 0,
          };

          pendingCookies.push({ name, value: "", options: removeOptions });
          cookieStore.set(name, "", removeOptions);
        },
      },
    },
  );
  const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const clearedPkceCookies = clearPkceVerifierCookies(cookieStore, pendingCookies);
    logAuthError("Callback", "Failed to exchange Supabase auth code for session", error);
    logAuthInfo("Callback", "Cleared PKCE verifier cookies after exchange failure", {
      clearedPkceCookieCount: clearedPkceCookies.length,
      errorCode: error.code || "",
    });

    return redirectWithCookies(request, pendingCookies, {
      auth_error: error.code || "oauth_exchange_failed",
      auth_message: error.message || "Google auth could not be completed.",
    });
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    logAuthError(
      "Callback",
      "Failed to read Supabase session after Google auth callback",
      sessionError,
    );
  }

  const exchangedSession = exchangeData?.session ?? null;
  const session = mergeSupabaseSession(exchangedSession, sessionData?.session ?? null);
  const providerToken = session?.provider_token || "";
  const providerRefreshToken = session?.provider_refresh_token || "";
  logAuthInfo("Callback", "Google auth callback session restored", {
    session: summarizeSupabaseSession(session),
    exchangeSession: summarizeSupabaseSession(exchangedSession),
    fallbackSession: summarizeSupabaseSession(sessionData?.session ?? null),
    grantedScopes: session?.granted_scopes || "",
    hasProviderToken: Boolean(providerToken),
    hasProviderRefreshToken: Boolean(providerRefreshToken),
  });

  if (!providerToken) {
    logAuthError(
      "Callback",
      "Google auth callback completed without a provider access token",
      null,
      {
        grantedScopes: session?.granted_scopes || "",
        hasSession: Boolean(session),
        hasUser: Boolean(session?.user?.id),
      },
    );
  }

  if (session?.user?.id) {
    const ensuredProfile = await ensureUserProfile(session.user, supabase);
    logAuthInfo("Callback", "Profile bootstrap completed for Google auth callback", {
      userId: session.user.id,
      hasProfile: Boolean(ensuredProfile),
    });
    try {
      await upsertGoogleOAuthTokens({
        userId: session.user.id,
        email: session.user.email ?? null,
        providerToken,
        providerRefreshToken,
        tokenType: "Bearer",
        scope: session?.granted_scopes || "",
        expiresAt: providerToken ? deriveGoogleProviderExpiry() : null,
      });
      logAuthInfo("Callback", "Persisted Google OAuth tokens for YouTube", {
        userId: session.user.id,
        hasProviderToken: Boolean(providerToken),
        hasProviderRefreshToken: Boolean(providerRefreshToken),
        grantedScopes: session?.granted_scopes || "",
      });
    } catch (tokenPersistError) {
      logAuthError(
        "Callback",
        "Failed to persist Google OAuth tokens to private storage",
        tokenPersistError,
      );
    }
  } else {
    logAuthError("Callback", "Missing session user after Google auth callback");
  }

  return redirectWithCookies(request, pendingCookies, {
    auth_status: "google_authenticated",
  });
}
