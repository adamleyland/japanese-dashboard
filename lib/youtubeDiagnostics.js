function buildTimestamp() {
  return new Date().toISOString();
}

export function logYoutubeApiCall({
  phase = "request",
  endpoint = "",
  reason = "unknown",
  caller = "unknown",
  method = "GET",
  transport = "server",
  status = null,
  cached = false,
  deduped = false,
  details = {},
} = {}) {
  const payload = {
    timestamp: buildTimestamp(),
    transport,
    caller,
    method,
    endpoint,
    reason,
    phase,
    status,
    cached,
    deduped,
    ...details,
  };

  const logger = phase === "fail" ? console.error : console.info;
  logger("[YouTube API] Call", payload);
}

export function logYoutubeBootstrap({
  phase = "start",
  reason = "unknown",
  caller = "unknown",
  userId = "",
  details = {},
} = {}) {
  const payload = {
    timestamp: buildTimestamp(),
    caller,
    reason,
    phase,
    userId,
    ...details,
  };

  const logger = phase === "fail" ? console.error : console.info;
  logger("[YouTube Bootstrap]", payload);
}
