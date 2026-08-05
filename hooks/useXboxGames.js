"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeXboxGamesResponse } from "@/lib/gaming/normalizers";

export function useXboxGames({ enabled = true } = {}) {
  const endpoint = "/api/gaming/xbox";
  const [refreshCount, setRefreshCount] = useState(0);
  const [state, setState] = useState({
    games: [],
    loading: true,
    error: null,
    configured: true,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ games: [], loading: false, error: null, configured: false });
      return undefined;
    }

    const abortController = new AbortController();

    async function loadXboxGames() {
      setState((currentState) => ({
        ...currentState,
        loading: true,
        error: null,
      }));

      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: abortController.signal,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || payload?.message || "Unable to load Xbox games.");
        }

        const games =
          Array.isArray(payload?.games) && payload.games.every((game) => game?.source === "xbox")
            ? payload.games
            : normalizeXboxGamesResponse(payload);

        setState({
          games,
          loading: false,
          error: null,
          configured: true,
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setState({
          games: [],
          loading: false,
          error: error instanceof Error ? error.message : "Unable to load Xbox games.",
          configured: true,
        });
      }
    }

    // TODO: Replace the generic endpoint contract with authenticated Xbox profile data when Xbox account linking is added.
    void loadXboxGames();

    return () => {
      abortController.abort();
    };
  }, [enabled, endpoint, refreshCount]);

  const refresh = useCallback(() => {
    setRefreshCount((count) => count + 1);
  }, []);

  return {
    ...state,
    refresh,
  };
}

export default useXboxGames;
