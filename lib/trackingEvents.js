import { supabase } from "@/lib/supabase";

export const TRACKING_EVENTS_TABLE = "tracking_events";
export const TRACKING_METRICS = ["listening", "reading", "shadowing", "writing", "gaming"];

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

export function createEmptyTrackingTotals() {
  return {
    listening: 0,
    reading: 0,
    shadowing: 0,
    writing: 0,
    gaming: 0,
  };
}

async function resolveTrackingUserId(preferredUserId, { logMissingUser = true } = {}) {
  if (preferredUserId) {
    return preferredUserId;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Failed to resolve the current Supabase user for tracking events", error);
    return null;
  }

  if (!data.user?.id) {
    if (logMissingUser) {
      console.error("No signed-in Supabase user is available for tracking event persistence");
    }
    return null;
  }

  return data.user.id;
}

async function insertTrackingEvent(metric, amount, metadata = {}) {
  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount) || safeAmount === 0) {
    return false;
  }

  if (!TRACKING_METRICS.includes(metric)) {
    console.error(`Unsupported tracking metric "${metric}"`);
    return false;
  }

  const userId = await resolveTrackingUserId(metadata.userId);
  if (!userId) {
    return false;
  }

  const { error } = await supabase.from(TRACKING_EVENTS_TABLE).insert({
    user_id: userId,
    metric,
    amount: safeAmount,
    unit: metadata.unit || TRACKING_UNITS[metric],
    kind: metadata.kind || (safeAmount < 0 ? "adjustment" : "session"),
    source: metadata.source || (safeAmount < 0 ? "adjustment" : "manual"),
    note: metadata.note || null,
    video_id: metadata.videoId || null,
    channel_id: metadata.channelId || null,
  });

  if (error) {
    console.error(`Failed to insert ${metric} tracking event`, error);
    return false;
  }

  return true;
}

export async function addTrackingEvent(metric, amount, metadata = {}) {
  return insertTrackingEvent(metric, Math.abs(Number(amount) || 0), metadata);
}

export async function reduceTrackingEvent(metric, amount, metadata = {}) {
  return insertTrackingEvent(metric, -Math.abs(Number(amount) || 0), metadata);
}

export async function fetchTrackingTotals(userId) {
  const resolvedUserId = await resolveTrackingUserId(userId, { logMissingUser: false });
  if (!resolvedUserId) {
    return createEmptyTrackingTotals();
  }

  const { data, error } = await supabase
    .from(TRACKING_EVENTS_TABLE)
    .select("metric, amount")
    .eq("user_id", resolvedUserId);

  if (error) {
    console.error("Failed to fetch tracking totals", error);
    return null;
  }

  return (data || []).reduce((totals, event) => {
    const metric = event.metric;
    if (!TRACKING_METRICS.includes(metric)) {
      return totals;
    }

    totals[metric] += Number(event.amount || 0);
    return totals;
  }, createEmptyTrackingTotals());
}
