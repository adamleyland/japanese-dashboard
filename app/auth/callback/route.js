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

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const authError = requestUrl.searchParams.get("error");
  const authErrorDescription = requestUrl.searchParams.get("error_description");

  if (authError) {
    logAuthError("Callback", "Supabase Google auth callback returned an error", null, {
      authError,
      authErrorDescription,
    });

    return redirectWithCookies(request, [], {
      auth_error: authError === "access_denied" ? "oauth_cancelled" : authError,
      auth_message: authErrorDescription || "Google auth could not be completed.",
    });
  }

  if (!code) {
    logAuthError("Callback", "Supabase Google auth callback is missing an auth code");

    return redirectWithCookies(request, [], {
      auth_error: "missing_code",
    });
  }

  const cookieStore = await cookies();
  const pendingCookies = [];
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
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logAuthError("Callback", "Failed to exchange Supabase auth code for session", error);

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

  const session = sessionData?.session ?? null;
  const providerToken = session?.provider_token || "";
  const providerRefreshToken = session?.provider_refresh_token || "";
  logAuthInfo("Callback", "Google auth callback session restored", {
    session: summarizeSupabaseSession(session),
  });

  if (session?.user?.id) {
    await ensureUserProfile(session.user, supabase);
    try {
      await upsertGoogleOAuthTokens({
        userId: session.user.id,
        email: session.user.email ?? null,
        providerToken,
        providerRefreshToken,
        tokenType: "Bearer",
        scope: session?.granted_scopes || "",
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
