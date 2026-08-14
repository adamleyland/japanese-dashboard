import { supabase } from "@/lib/supabase";
import { getSafeAuthUser } from "@/lib/auth";

export const TRACKING_EVENTS_TABLE = "tracking_events";
export const TRACKING_METRICS = ["listening", "reading", "shadowing", "writing", "gaming"];
const TRACKING_PENDING_EVENTS_STORAGE_KEY = "jp_tracking_pending_events_v1";
const TRACKING_TOTALS_RPC_NAME = "get_tracking_totals";
const TRACKING_EVENT_KINDS = new Set(["session", "adjustment"]);
const TRACKING_TOTALS_FALLBACK_PAGE_SIZE = 1000;
const TRACKING_HISTORY_PAGE_SIZE = 50;

export const TRACKING_UNITS = {
  listening: "hours",
  reading: "words",
  shadowing: "hours",
  writing: "words",
  gaming: "hours",
};

// Expected public.tracking_events shape:
// - user_id uuid references auth.users(id)
// - metric text in ('listening','reading','shadowing','writing','gaming')
// - amount numeric, using positive adds and negative reductions
// - unit text in ('hours','words')
// - kind text in ('session','adjustment')
// - source/note/video_id/channel_id for lightweight event context
// - client_event_id text for idempotent client-side retries

export function createEmptyTrackingTotals() {
  return {
    listening: 0,
    reading: 0,
    shadowing: 0,
    writing: 0,
    gaming: 0,
  };
}

export function hasTrackingTotalsValue(totals) {
  return TRACKING_METRICS.some((metric) => Math.abs(Number(totals?.[metric] || 0)) > 0.000001);
}

function logTrackingInfo(message, payload = {}) {
  console.info(`[Tracking] ${message}`, payload);
}

function normalizeTrackingTotals(totals) {
  return TRACKING_METRICS.reduce((result, metric) => {
    result[metric] = Number(totals?.[metric] || 0);
    return result;
  }, createEmptyTrackingTotals());
}

function canUseLocalStorage() {
  return typeof window !== "undefined";
}

function createClientEventId() {
  return `tracking_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTextValue(value, fallback = "") {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue || fallback;
  }

  if (value == null) {
    return fallback;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue || fallback;
}

function normalizeNullableTextValue(value) {
  const normalizedValue = normalizeTextValue(value, "");
  return normalizedValue || null;
}

function normalizeCreatedAtValue(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const createdAtDate = new Date(value);
  if (Number.isNaN(createdAtDate.getTime())) {
    return new Date().toISOString();
  }

  return createdAtDate.toISOString();
}

function normalizeAmountValue(event) {
  const rawAmount = event?.amount ?? event?.delta ?? 0;
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount === 0) {
    return null;
  }

  return amount;
}

function normalizeMetricValue(metric) {
  const normalizedMetric = normalizeTextValue(metric, "");
  return TRACKING_METRICS.includes(normalizedMetric) ? normalizedMetric : "";
}

function normalizeTrackingKindValue(kind, amount) {
  const normalizedKind = normalizeTextValue(kind, "");
  if (TRACKING_EVENT_KINDS.has(normalizedKind)) {
    return normalizedKind;
  }

  if (normalizedKind === "manual") {
    return "session";
  }

  return amount < 0 ? "adjustment" : "session";
}

function normalizeTrackingEventForStorage(event, fallbackUserId = null) {
  const metric = normalizeMetricValue(event?.metric);
  if (!metric) {
    return null;
  }

  const amount = normalizeAmountValue(event);
  if (amount == null) {
    return null;
  }

  const userId = normalizeTextValue(event?.user_id ?? event?.userId ?? fallbackUserId, "");
  const unit = normalizeTextValue(event?.unit, TRACKING_UNITS[metric]);
  const kind = normalizeTrackingKindValue(event?.kind, amount);
  const source = normalizeTextValue(
    event?.source,
    amount < 0 ? "adjustment" : "manual",
  );
  const clientEventId = normalizeTextValue(
    event?.client_event_id ?? event?.clientEventId,
    createClientEventId(),
  );

  return {
    client_event_id: clientEventId,
    user_id: userId || null,
    metric,
    amount,
    unit,
    kind,
    source,
    note: normalizeNullableTextValue(event?.note),
    video_id: normalizeNullableTextValue(event?.video_id ?? event?.videoId),
    channel_id: normalizeNullableTextValue(event?.channel_id ?? event?.channelId),
    created_at: normalizeCreatedAtValue(event?.created_at ?? event?.createdAt),
  };
}

function serializeTrackingError(error) {
  if (!error) {
    return {};
  }

  const ownPropertyNames = Object.getOwnPropertyNames(error);
  const ownEntries = ownPropertyNames.reduce((result, key) => {
    result[key] = error[key];
    return result;
  }, {});

  return {
    message: error?.message || "",
    details: error?.details || "",
    hint: error?.hint || "",
    code: error?.code || "",
    name: error?.name || "",
    constructorName: error?.constructor?.name || "",
    ownKeys: ownPropertyNames,
    ownEntries,
  };
}

function logSupabaseTrackingError(context, error, payload) {
  console.error(`[Tracking] ${context}`, {
    ...serializeTrackingError(error),
    payload,
    rawError: error,
  });
}

function isDuplicateTrackingEventError(error) {
  return error?.code === "23505";
}

function readPendingTrackingEvents() {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(TRACKING_PENDING_EVENTS_STORAGE_KEY);
    const parsedValue = JSON.parse(rawValue || "[]");

    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (error) {
    console.error("Failed to parse pending tracking events from localStorage", error);
    return [];
  }
}

function writePendingTrackingEvents(events) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
    TRACKING_PENDING_EVENTS_STORAGE_KEY,
    JSON.stringify(Array.isArray(events) ? events : []),
  );
}

function normalizePendingTrackingEventsForStorage(events, fallbackUserId = null) {
  const normalizedEvents = [];
  const seenEventKeys = new Set();

  for (const event of Array.isArray(events) ? events : []) {
    const normalizedEvent = normalizeTrackingEventForStorage(event, fallbackUserId);
    if (!normalizedEvent) {
      continue;
    }

    const dedupeKey = [
      normalizedEvent.user_id || "",
      normalizedEvent.metric,
      normalizedEvent.client_event_id,
    ].join("::");

    if (seenEventKeys.has(dedupeKey)) {
      continue;
    }

    seenEventKeys.add(dedupeKey);
    normalizedEvents.push(normalizedEvent);
  }

  return normalizedEvents;
}

function readNormalizedPendingTrackingEvents(fallbackUserId = null) {
  const rawEvents = readPendingTrackingEvents();
  const normalizedEvents = normalizePendingTrackingEventsForStorage(rawEvents, fallbackUserId);

  const shouldRewriteQueue =
    rawEvents.length !== normalizedEvents.length ||
    rawEvents.some((event, index) => JSON.stringify(event) !== JSON.stringify(normalizedEvents[index]));

  if (shouldRewriteQueue) {
    writePendingTrackingEvents(normalizedEvents);
  }

  return normalizedEvents;
}

function queuePendingTrackingEvent(eventPayload) {
  const normalizedEvent = normalizeTrackingEventForStorage(eventPayload);
  if (!normalizedEvent) {
    return false;
  }

  const pendingEvents = readNormalizedPendingTrackingEvents();
  const nextEvents = pendingEvents.filter((event) => {
    return !(
      event?.client_event_id === normalizedEvent.client_event_id &&
      event?.metric === normalizedEvent.metric &&
      String(event?.user_id || "") === String(normalizedEvent.user_id || "")
    );
  });
  nextEvents.push(normalizedEvent);
  writePendingTrackingEvents(nextEvents);
  logTrackingInfo("Queued pending tracking event in localStorage", {
    metric: normalizedEvent.metric,
    amount: normalizedEvent.amount,
    userId: normalizedEvent.user_id,
    clientEventId: normalizedEvent.client_event_id,
    queueLength: nextEvents.length,
  });
  return true;
}

function removePendingTrackingEvents(eventsToRemove) {
  if (!eventsToRemove?.length) {
    return;
  }

  const removalSet = new Set(
    eventsToRemove.map((event) =>
      [
        String(event?.user_id || ""),
        String(event?.metric || ""),
        String(event?.client_event_id || ""),
      ].join("::"),
    ),
  );

  const nextEvents = readNormalizedPendingTrackingEvents().filter((event) => {
    const eventKey = [
      String(event?.user_id || ""),
      String(event?.metric || ""),
      String(event?.client_event_id || ""),
    ].join("::");
    return !removalSet.has(eventKey);
  });
  writePendingTrackingEvents(nextEvents);
  logTrackingInfo("Removed tracking events from local pending queue", {
    removedCount: eventsToRemove.length,
    remainingCount: nextEvents.length,
  });
}

function buildTrackingEventPayload(metric, amount, metadata = {}, userId = null) {
  return normalizeTrackingEventForStorage(
    {
      client_event_id: metadata.clientEventId,
      user_id: userId,
      metric,
      amount,
      unit: metadata.unit,
      kind: metadata.kind,
      source: metadata.source,
      note: metadata.note,
      video_id: metadata.videoId,
      channel_id: metadata.channelId,
      created_at: metadata.createdAt,
    },
    userId,
  );
}

async function resolveTrackingUserId(preferredUserId) {
  if (preferredUserId) {
    return preferredUserId;
  }

  const user = await getSafeAuthUser();

  if (!user?.id) {
    return null;
  }

  return user.id;
}

async function persistTrackingEvent(eventPayload) {
  const normalizedPayload = normalizeTrackingEventForStorage(eventPayload);
  if (!normalizedPayload?.user_id) {
    console.error("[Tracking] persistTrackingEvent called without a user_id", {
      payload: normalizedPayload,
    });
    return false;
  }

  logTrackingInfo("Persisting tracking event to Supabase", {
    metric: normalizedPayload.metric,
    amount: normalizedPayload.amount,
    userId: normalizedPayload.user_id,
    kind: normalizedPayload.kind,
    source: normalizedPayload.source,
    clientEventId: normalizedPayload.client_event_id,
    createdAt: normalizedPayload.created_at,
  });

  const { error } = await supabase.from(TRACKING_EVENTS_TABLE).insert(normalizedPayload);

  if (error) {
    if (isDuplicateTrackingEventError(error)) {
      logTrackingInfo("Tracking event already existed in Supabase, treating as success", {
        metric: normalizedPayload.metric,
        amount: normalizedPayload.amount,
        userId: normalizedPayload.user_id,
        clientEventId: normalizedPayload.client_event_id,
      });
      return true;
    }

    logSupabaseTrackingError("Failed to persist tracking event", error, normalizedPayload);
    return false;
  }

  logTrackingInfo("Persisted tracking event to Supabase", {
    metric: normalizedPayload.metric,
    amount: normalizedPayload.amount,
    userId: normalizedPayload.user_id,
    clientEventId: normalizedPayload.client_event_id,
  });
  return true;
}

async function insertTrackingEvent(metric, amount, metadata = {}) {
  const normalizedMetric = normalizeMetricValue(metric);
  if (!normalizedMetric) {
    console.error(`Unsupported tracking metric "${metric}"`);
    return false;
  }

  const userId = await resolveTrackingUserId(metadata.userId);
  const eventPayload = buildTrackingEventPayload(normalizedMetric, amount, metadata, userId);
  if (!eventPayload) {
    return false;
  }

  if (!userId) {
    return queuePendingTrackingEvent(eventPayload);
  }

  const success = await persistTrackingEvent(eventPayload);
  if (success) {
    await flushPendingTrackingEvents(userId);
    return true;
  }

  return queuePendingTrackingEvent(eventPayload);
}

export async function addTrackingEvent(metric, amount, metadata = {}) {
  return insertTrackingEvent(metric, Math.abs(Number(amount) || 0), metadata);
}

export async function reduceTrackingEvent(metric, amount, metadata = {}) {
  return insertTrackingEvent(metric, -Math.abs(Number(amount) || 0), metadata);
}

export function getPendingTrackingTotals(userId = "") {
  const totals = createEmptyTrackingTotals();
  const normalizedUserId = String(userId || "");

  for (const event of readNormalizedPendingTrackingEvents(userId || null)) {
    const eventUserId = String(event.user_id || "");
    if (normalizedUserId && eventUserId && eventUserId !== normalizedUserId) {
      continue;
    }

    totals[event.metric] += Number(event.amount || 0);
  }

  return totals;
}

export async function flushPendingTrackingEvents(preferredUserId = "") {
  const userId = await resolveTrackingUserId(preferredUserId);
  if (!userId) {
    return {
      ok: false,
      flushedCount: 0,
      remainingCount: readNormalizedPendingTrackingEvents().length,
    };
  }

  const pendingEvents = readNormalizedPendingTrackingEvents(userId);
  const flushableEvents = pendingEvents
    .map((event) => normalizeTrackingEventForStorage(event, userId))
    .filter(Boolean)
    .filter((event) => !event.user_id || event.user_id === userId)
    .map((event) => ({
      ...event,
      user_id: userId,
    }));

  if (!flushableEvents.length) {
    return {
      ok: true,
      flushedCount: 0,
      remainingCount: pendingEvents.length,
    };
  }

  logTrackingInfo("Flushing pending tracking events to Supabase", {
    userId,
    queuedCount: flushableEvents.length,
  });

  let flushedCount = 0;

  for (const eventPayload of flushableEvents) {
    const { error } = await supabase.from(TRACKING_EVENTS_TABLE).insert(eventPayload);

    if (error && !isDuplicateTrackingEventError(error)) {
      logSupabaseTrackingError("Failed to flush pending tracking events", error, eventPayload);
      return {
        ok: false,
        flushedCount,
        remainingCount: pendingEvents.length,
      };
    }

    flushedCount += 1;
  }

  removePendingTrackingEvents(flushableEvents);

  logTrackingInfo("Finished flushing pending tracking events", {
    userId,
    flushedCount,
    remainingCount: readNormalizedPendingTrackingEvents().length,
  });

  return {
    ok: true,
    flushedCount,
    remainingCount: readNormalizedPendingTrackingEvents().length,
  };
}

async function fetchTrackingTotalsViaRpc(resolvedUserId) {
  const { data, error } = await supabase.rpc(TRACKING_TOTALS_RPC_NAME, {
    p_user_id: resolvedUserId,
  });

  if (error) {
    logSupabaseTrackingError("Failed to fetch tracking totals from aggregate RPC", error, {
      userId: resolvedUserId,
      readSource: "supabase-rpc",
    });
    return null;
  }

  logTrackingInfo("Raw tracking totals RPC result", {
    userId: resolvedUserId,
    rows: Array.isArray(data) ? data : [],
  });

  const totals = createEmptyTrackingTotals();
  for (const row of data || []) {
    const metric = normalizeMetricValue(row?.metric);
    if (!metric) {
      continue;
    }

    const rawTotal = row?.total ?? row?.total_amount ?? row?.amount_total ?? 0;
    totals[metric] = Number(rawTotal || 0);
  }

  return {
    totals: normalizeTrackingTotals(totals),
    readSource: "supabase-rpc",
    pageCount: 1,
    rowCount: Array.isArray(data) ? data.length : 0,
  };
}

async function fetchTrackingTotalsViaRows(resolvedUserId) {
  const totals = createEmptyTrackingTotals();
  let pageCount = 0;
  let rowCount = 0;
  let from = 0;

  while (true) {
    const to = from + TRACKING_TOTALS_FALLBACK_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(TRACKING_EVENTS_TABLE)
      .select("metric, amount")
      .eq("user_id", resolvedUserId)
      .range(from, to);

    pageCount += 1;

    if (error) {
      logSupabaseTrackingError("Failed to fetch tracking totals from row fallback", error, {
        userId: resolvedUserId,
        readSource: "supabase-row-scan",
        pageCount,
        from,
        to,
      });
      return null;
    }

    const rows = Array.isArray(data) ? data : [];
    rowCount += rows.length;

    rows.forEach((row) => {
      const metric = normalizeMetricValue(row?.metric);
      if (!metric) {
        return;
      }

      totals[metric] += Number(row?.amount || 0);
    });

    if (rows.length < TRACKING_TOTALS_FALLBACK_PAGE_SIZE) {
      break;
    }

    from += TRACKING_TOTALS_FALLBACK_PAGE_SIZE;
  }

  return {
    totals: normalizeTrackingTotals(totals),
    readSource: "supabase-row-scan",
    pageCount,
    rowCount,
  };
}

export async function fetchTrackingTotalsWithSource(userId) {
  const resolvedUserId = await resolveTrackingUserId(userId);
  if (!resolvedUserId) {
    return {
      totals: createEmptyTrackingTotals(),
      readSource: "no-auth-user",
      pageCount: 0,
      rowCount: 0,
    };
  }

  const rpcSnapshot = await fetchTrackingTotalsViaRpc(resolvedUserId);
  if (rpcSnapshot) {
    logTrackingInfo("Loaded tracking totals for user", {
      userId: resolvedUserId,
      readSource: rpcSnapshot.readSource,
      rowCount: rpcSnapshot.rowCount,
      listening: rpcSnapshot.totals.listening,
      reading: rpcSnapshot.totals.reading,
      shadowing: rpcSnapshot.totals.shadowing,
      writing: rpcSnapshot.totals.writing,
      gaming: rpcSnapshot.totals.gaming,
    });
    return rpcSnapshot;
  }

  console.warn("[Tracking] Tracking totals RPC unavailable; falling back to tracking_events scan", {
    userId: resolvedUserId,
    rpcName: TRACKING_TOTALS_RPC_NAME,
  });
  const rowSnapshot = await fetchTrackingTotalsViaRows(resolvedUserId);

  if (rowSnapshot) {
    logTrackingInfo("Loaded tracking totals for user via row fallback", {
      userId: resolvedUserId,
      readSource: rowSnapshot.readSource,
      pageCount: rowSnapshot.pageCount,
      rowCount: rowSnapshot.rowCount,
      listening: rowSnapshot.totals.listening,
      reading: rowSnapshot.totals.reading,
      shadowing: rowSnapshot.totals.shadowing,
      writing: rowSnapshot.totals.writing,
      gaming: rowSnapshot.totals.gaming,
    });
  }

  return rowSnapshot;
}

export async function fetchTrackingTotals(userId) {
  const snapshot = await fetchTrackingTotalsWithSource(userId);
  return snapshot?.totals || null;
}

export async function fetchListeningManualHistory(userId, limit = TRACKING_HISTORY_PAGE_SIZE) {
  const resolvedUserId = await resolveTrackingUserId(userId);
  const safeLimit = Math.min(Math.max(Math.floor(Number(limit) || TRACKING_HISTORY_PAGE_SIZE), 1), 100);
  const pendingEntries = readNormalizedPendingTrackingEvents(resolvedUserId || null)
    .filter((event) => event.metric === "listening" && Number(event.amount) > 0)
    .map((event) => ({
      id: event.client_event_id,
      amount: Number(event.amount || 0),
      createdAt: event.created_at,
      source: event.source || "manual",
    }));

  if (!resolvedUserId) {
    return pendingEntries
      .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
      .slice(0, safeLimit);
  }

  const { data, error } = await supabase
    .from(TRACKING_EVENTS_TABLE)
    .select("client_event_id, amount, created_at, source")
    .eq("user_id", resolvedUserId)
    .eq("metric", "listening")
    .gt("amount", 0)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    logSupabaseTrackingError("Failed to fetch manual listening history", error, { userId: resolvedUserId, limit: safeLimit });
    return pendingEntries.slice(0, safeLimit);
  }

  const storedEntries = (data || []).map((event) => ({
    id: event.client_event_id,
    amount: Number(event.amount || 0),
    createdAt: event.created_at,
    source: event.source || "manual",
  }));

  const seenIds = new Set(storedEntries.map((event) => event.id));
  return [...storedEntries, ...pendingEntries.filter((event) => !seenIds.has(event.id))]
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
    .slice(0, safeLimit);
}

export async function fetchTrackingActivityByDateRange(userId, startDate, endDate) {
  const resolvedUserId = await resolveTrackingUserId(userId);
  if (!resolvedUserId || !startDate || !endDate) {
    return {};
  }

  const { data, error } = await supabase
    .from(TRACKING_EVENTS_TABLE)
    .select("metric, amount, created_at")
    .eq("user_id", resolvedUserId)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString());

  if (error) {
    console.error("Failed to fetch tracking activity by date", error);
    return {};
  }

  return (data || []).reduce((activity, event) => {
    if (!event?.created_at || !TRACKING_METRICS.includes(event.metric)) {
      return activity;
    }

    const isoDate = event.created_at.slice(0, 10);
    if (!activity[isoDate]) {
      activity[isoDate] = {
        total: 0,
        metrics: {},
      };
    }

    const amount = Number(event.amount || 0);
    activity[isoDate].total += amount;
    activity[isoDate].metrics[event.metric] =
      (activity[isoDate].metrics[event.metric] || 0) + amount;

    return activity;
  }, {});
}
