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

const GAMING_INCLUDE_STORAGE_KEY = "jp_gaming_include_overrides";

export function useGamingData(options = {}) {
  const {
    authUserId: providedAuthUserId = null,
    authResolved: providedAuthResolved = false,
  } = options;
  const usesExternalAuthState = providedAuthUserId !== null;
  const steamGames = useSteamGames();
  const xboxGames = useXboxGames();
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
    () => mergeNormalizedGames(steamGames.games, xboxGames.games),
    [steamGames.games, xboxGames.games],
  );

  const games = useMemo(
    () => applyIncludeOverrides(mergedGames, includeOverrides),
    [includeOverrides, mergedGames],
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
  }, [steamGames, xboxGames]);

  return {
    games,
    hasHydrated: typeof window !== "undefined",
    loading: steamGames.loading || xboxGames.loading,
    error: [steamGames.error, xboxGames.error].filter(Boolean).join(" ") || null,
    setGameIncluded,
    toggleGameIncluded,
    refreshAll,
    sourceStatus: {
      steam: steamGames,
      xbox: xboxGames,
    },
  };
}

export default useGamingData;
