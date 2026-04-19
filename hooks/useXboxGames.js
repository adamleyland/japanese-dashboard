"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeXboxGamesResponse } from "@/lib/gaming/normalizers";

export function useXboxGames() {
  const endpoint = process.env.NEXT_PUBLIC_XBOX_GAMES_ENDPOINT || "";
  const [refreshCount, setRefreshCount] = useState(0);
  const [state, setState] = useState({
    games: [],
    loading: false,
    error: null,
    configured: Boolean(endpoint),
  });

  useEffect(() => {
    if (!endpoint) {
      setState({
        games: [],
        loading: false,
        error: null,
        configured: false,
      });
      return;
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
          throw new Error(payload?.message || "Unable to load Xbox games.");
        }

        setState({
          games: normalizeXboxGamesResponse(payload),
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
  }, [endpoint, refreshCount]);

  const refresh = useCallback(() => {
    setRefreshCount((count) => count + 1);
  }, []);

  return {
    ...state,
    refresh,
  };
}

export default useXboxGames;
