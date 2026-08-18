"use client";

import { useCallback, useEffect, useState } from "react";

export function useAchievements(game) {
  const [state, setState] = useState({ game: null, loading: true, error: null, warning: null });

  const load = useCallback(async (force = false) => {
    if (!game?.source || !game?.sourceGameId) return;
    setState((current) => ({ ...current, loading: true, error: null, warning: null }));
    try {
      const search = new URLSearchParams({
        provider: game.source,
        gameId: game.sourceGameId,
        title: game.title || "",
      });
      if (force) search.set("refresh", "1");
      const response = await fetch(`/api/gaming/achievements?${search}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to load achievements.");
      setState({ game: payload.game, loading: false, error: null, warning: payload.warning || null });
    } catch (error) {
      setState({ game: null, loading: false, error: error instanceof Error ? error.message : "Unable to load achievements.", warning: null });
    }
  }, [game?.source, game?.sourceGameId, game?.title]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return { ...state, load: () => load(false), refresh: () => load(true) };
}
