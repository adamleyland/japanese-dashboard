import "server-only";

function readServerEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function getOptionalServerEnv(name) {
  return readServerEnv(name);
}

export function getRequiredServerEnv(name, context) {
  const value = readServerEnv(name);

  if (value) {
    return value;
  }

  const error = new Error(`Missing required server environment variable: ${name}`);
  error.code = "SERVER_ENV_MISSING";
  error.envName = name;
  error.context = context || "server";
  throw error;
}

export function getGoogleOAuthServerConfig() {
  const clientId =
    getOptionalServerEnv("GOOGLE_CLIENT_ID") ||
    getOptionalServerEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  const clientSecret = getOptionalServerEnv("GOOGLE_CLIENT_SECRET");

  return {
    clientId,
    clientSecret,
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
  };
}
