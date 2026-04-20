function maskValue(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  if (value.length <= 8) {
    return "***";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function summarizeSupabaseSession(session) {
  if (!session) {
    return {
      hasSession: false,
    };
  }

  return {
    hasSession: true,
    userId: maskValue(session.user?.id || ""),
    expiresAt: session.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : null,
    hasProviderToken: Boolean(session.provider_token),
    hasProviderRefreshToken: Boolean(session.provider_refresh_token),
  };
}

export function logAuthInfo(scope, message, details = {}) {
  console.info(`[Auth][${scope}] ${message}`, details);
}

export function logAuthError(scope, message, error, details = {}) {
  console.error(`[Auth][${scope}] ${message}`, {
    ...details,
    errorName: error?.name || "",
    errorCode: error?.code || "",
    errorMessage: error?.message || String(error || ""),
  });
}
