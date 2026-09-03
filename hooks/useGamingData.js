"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSafeAuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  addExcludedGame,
  fetchExcludedGames,
  removeExcludedGame,
} from "@/lib/exclusions";
import { mergeNormalizedGames } from "@/lib/gaming/normalizers";
import { applyIncludeOverrides } from "@/lib/gaming/selectors";
import { getGameStorageKey } from "@/lib/gaming/gaming-utils";
import { useSteamGames } from "@/hooks/useSteamGames";
import { useXboxGames } from "@/hooks/useXboxGames";
import { useLocalGames } from "@/hooks/useLocalGames";
import { useAchievementSummaries } from "@/hooks/useAchievementSummaries";

const GAMING_INCLUDE_STORAGE_KEY = "jp_gaming_include_overrides";

export function useGamingData(options = {}) {
  const {
    authUserId: providedAuthUserId = null,
    authResolved: providedAuthResolved = false,
  } = options;
  const usesExternalAuthState = providedAuthUserId !== null;
  const [internalAuthState, setInternalAuthState] = useState({
    authUserId: "",
    authResolved: false,
  });
  const authUserId = usesExternalAuthState
    ? providedAuthUserId || ""
    : internalAuthState.authUserId;
  const authResolved = usesExternalAuthState
    ? Boolean(providedAuthResolved)
    : internalAuthState.authResolved;
  const hasAuthenticatedUser = authResolved && Boolean(authUserId);
  const steamGames = useSteamGames({ enabled: hasAuthenticatedUser });
  const xboxGames = useXboxGames({ enabled: hasAuthenticatedUser });
  const localGames = useLocalGames({ authUserId, authResolved });
  const achievementSummaries = useAchievementSummaries({ enabled: hasAuthenticatedUser });
  const [includeOverrides, setIncludeOverrides] = useState(() => {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const storedValue = window.localStorage.getItem(GAMING_INCLUDE_STORAGE_KEY);
      if (!storedValue) {
        return {};
      }

      const parsedValue = JSON.parse(storedValue);
      return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
    } catch (error) {
      console.error("Failed to read persisted gaming include overrides", error);
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      GAMING_INCLUDE_STORAGE_KEY,
      JSON.stringify(includeOverrides),
    );
  }, [includeOverrides]);

  useEffect(() => {
    if (usesExternalAuthState) {
      return;
    }

    let isActive = true;

    const resolveAuthUser = async () => {
      const user = await getSafeAuthUser();

      if (!isActive) {
        return;
      }

      setInternalAuthState({
        authUserId: user?.id || "",
        authResolved: true,
      });
    };

    void resolveAuthUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) {
        return;
      }

      setInternalAuthState({
        authUserId: session?.user?.id || "",
        authResolved: true,
      });
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [usesExternalAuthState]);

  useEffect(() => {
    if (!authResolved || !authUserId) {
      return;
    }

    let isActive = true;

    const loadExcludedGames = async () => {
      try {
        const excludedGames = await fetchExcludedGames(authUserId);

        if (!isActive) {
          return;
        }

        const nextOverrides = excludedGames.reduce((overrides, row) => {
          if (!row?.source || !row?.source_game_id) {
            return overrides;
          }

          overrides[`${row.source}:${row.source_game_id}`] = false;
          return overrides;
        }, {});

        setIncludeOverrides(nextOverrides);
      } catch (error) {
        console.error("Failed to load excluded games from Supabase", error);
      }
    };

    void loadExcludedGames();

    return () => {
      isActive = false;
    };
  }, [authResolved, authUserId]);

  const mergedGames = useMemo(
    () => mergeNormalizedGames(steamGames.games, xboxGames.games, localGames.games),
    [localGames.games, steamGames.games, xboxGames.games],
  );

  const games = useMemo(
    () => applyIncludeOverrides(mergedGames, includeOverrides),
    [includeOverrides, mergedGames],
  );

  const steamDeckGames = useMemo(
    () => localGames.games.filter((game) => game.source === "steam-deck"),
    [localGames.games],
  );
  const desktopLocalGames = useMemo(
    () => localGames.games.filter((game) => game.source === "local"),
    [localGames.games],
  );

  const setGameIncluded = useCallback((game, includeInOverallTotal) => {
    const storageKey = getGameStorageKey(game);
    const previousIncluded = Object.prototype.hasOwnProperty.call(includeOverrides, storageKey)
      ? Boolean(includeOverrides[storageKey])
      : game.includeInOverallTotal !== false;

    setIncludeOverrides((currentOverrides) => {
      const nextOverrides = { ...currentOverrides };

      if (includeInOverallTotal) {
        delete nextOverrides[storageKey];
      } else {
        nextOverrides[storageKey] = false;
      }

      return nextOverrides;
    });

    if (!authUserId) {
      return;
    }

    const syncExcludedGame = async () => {
      try {
        if (includeInOverallTotal) {
          await removeExcludedGame(authUserId, game.source, game.sourceGameId);
        } else {
          await addExcludedGame(authUserId, game.source, game.sourceGameId);
        }
      } catch (error) {
        console.error("Failed to sync excluded game to Supabase", error);
        setIncludeOverrides((currentOverrides) => {
          const nextOverrides = { ...currentOverrides };

          if (previousIncluded) {
            delete nextOverrides[storageKey];
          } else {
            nextOverrides[storageKey] = false;
          }

          return nextOverrides;
        });
      }
    };

    void syncExcludedGame();
  }, [authUserId, includeOverrides]);

  const toggleGameIncluded = useCallback(
    (game) => {
      const storageKey = getGameStorageKey(game);
      const currentIncluded = Object.prototype.hasOwnProperty.call(includeOverrides, storageKey)
        ? Boolean(includeOverrides[storageKey])
        : game.includeInOverallTotal !== false;

      setGameIncluded(game, !currentIncluded);
    },
    [includeOverrides, setGameIncluded],
  );

  const refreshAll = useCallback(() => {
    steamGames.refresh();
    xboxGames.refresh();
    localGames.refresh();
  }, [localGames, steamGames, xboxGames]);

  const updateLocalArtwork = useCallback(async (game, { coverImageUrl, heroArtworkUrl, logoArtworkUrl }) => {
    if (!["local", "steam-deck"].includes(game?.source)) return;
    const response = await fetch("/api/gaming/local/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId: game.sourceGameId, name: game.title, coverImageUrl, metadataProvider: game.metadataProvider || "manual", metadata: { ...(game.raw?.metadata || {}), heroArtworkUrl, logoArtworkUrl } }) });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to save artwork."); localGames.refresh();
  }, [localGames]);
  const deleteLocalGame = useCallback(async (game) => {
    if (!["local", "steam-deck"].includes(game?.source)) return;
    const response = await fetch(`/api/gaming/local/games?gameId=${encodeURIComponent(game.sourceGameId)}`, { method: "DELETE" });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to delete local game."); localGames.refresh();
  }, [localGames]);

  return {
    games,
    hasHydrated: typeof window !== "undefined",
    loading: steamGames.loading || xboxGames.loading || localGames.loading,
    error: [steamGames.error, xboxGames.error, localGames.error].filter(Boolean).join(" ") || null,
    setGameIncluded,
    toggleGameIncluded,
    refreshAll,
    sourceStatus: {
      steam: steamGames,
      xbox: xboxGames,
      local: { ...localGames, games: desktopLocalGames },
      "steam-deck": {
        ...localGames,
        games: steamDeckGames,
        configured: steamDeckGames.length > 0,
      },
    },
    achievementSummaries: achievementSummaries.summaries,
    updateLocalArtwork,
    deleteLocalGame,
  };
}

export default useGamingData;
