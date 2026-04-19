"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeSteamGamesResponse } from "@/lib/gaming/normalizers";

const DEFAULT_STEAM_ENDPOINT = "/api/gaming/steam";

export function useSteamGames() {
  const endpoint = process.env.NEXT_PUBLIC_STEAM_GAMES_ENDPOINT || DEFAULT_STEAM_ENDPOINT;
  const [refreshCount, setRefreshCount] = useState(0);
  const [state, setState] = useState({
    games: [],
    loading: true,
    error: null,
    configured: true,
  });

  useEffect(() => {
    const abortController = new AbortController();

    async function loadSteamGames() {
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
          throw new Error(payload?.error || payload?.message || "Unable to load Steam games.");
        }

        const games =
          Array.isArray(payload?.games) && payload.games.every((game) => game?.source === "steam")
            ? payload.games
            : normalizeSteamGamesResponse(payload);

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
          error: error instanceof Error ? error.message : "Unable to load Steam games.",
          configured: true,
        });
      }
    }

    void loadSteamGames();

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

export default useSteamGames;
