import { addTrackingEvent, fetchTrackingTotals, reduceTrackingEvent } from "@/lib/trackingEvents";

export async function addListeningMinutes(minutes, metadata = {}) {
  const hours = Math.abs(Number(minutes) || 0) / 60;
  return addTrackingEvent("listening", hours, metadata);
}

export async function reduceListeningMinutes(minutes, metadata = {}) {
  const hours = Math.abs(Number(minutes) || 0) / 60;
  return reduceTrackingEvent("listening", hours, metadata);
}

export async function fetchListeningTotal(userId) {
  const totals = await fetchTrackingTotals(userId);
  if (!totals) {
    return null;
  }

  return totals.listening * 60;
}
