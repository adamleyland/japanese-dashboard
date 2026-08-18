"use client";
import { useEffect, useState } from "react";
export function useAchievementSummaries({ enabled = false } = {}) {
  const [state, setState] = useState({ summaries: {}, loading: false });
  useEffect(() => { if (!enabled) return; let active = true; fetch("/api/gaming/achievements?mode=summaries", { cache: "no-store" }).then((response) => response.json().then((payload) => ({ response, payload }))).then(({ response, payload }) => { if (!response.ok) throw new Error(payload.error); if (active) setState({ summaries: Object.fromEntries((payload.summaries || []).map((item) => [item.key, item])), loading: false }); }).catch(() => { if (active) setState({ summaries: {}, loading: false }); }); return () => { active = false; }; }, [enabled]);
  return state;
}
