"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeLocalGamesResponse } from "@/lib/gaming/local-games";

const LOCAL_GAMES_ENDPOINT = "/api/gaming/local";

export function useLocalGames({ authUserId = "", authResolved = false } = {}) {
  const [refreshCount, setRefreshCount] = useState(0);
  const [state, setState] = useState({
    games: [],
    loading: Boolean(authUserId),
    error: null,
    configured: false,
  });

  useEffect(() => {
    if (!authResolved || !authUserId) {
      setState({
        games: [],
        loading: false,
        error: null,
        configured: false,
      });
      return undefined;
    }

    const abortController = new AbortController();

    async function loadLocalGames() {
      setState((currentState) => ({
        ...currentState,
        loading: true,
        error: null,
        configured: true,
      }));

      try {
        const response = await fetch(LOCAL_GAMES_ENDPOINT, {
          cache: "no-store",
          signal: abortController.signal,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load local games.");
        }

        setState({
          games: normalizeLocalGamesResponse(payload),
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
          error: error instanceof Error ? error.message : "Unable to load local games.",
          configured: true,
        });
      }
    }

    void loadLocalGames();

    return () => abortController.abort();
  }, [authResolved, authUserId, refreshCount]);

  const refresh = useCallback(() => {
    setRefreshCount((count) => count + 1);
  }, []);

  return { ...state, refresh };
}

export default useLocalGames;
