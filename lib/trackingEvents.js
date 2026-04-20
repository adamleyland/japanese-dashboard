import { supabase } from "@/lib/supabase";
import { getSafeAuthUser } from "@/lib/auth";

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
  const resolvedUserId = await resolveTrackingUserId(userId);
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
