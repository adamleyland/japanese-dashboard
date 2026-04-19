"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { mergeNormalizedGames } from "@/lib/gaming/normalizers";
import { applyIncludeOverrides } from "@/lib/gaming/selectors";
import { getGameStorageKey } from "@/lib/gaming/gaming-utils";
import { useSteamGames } from "@/hooks/useSteamGames";
import { useXboxGames } from "@/hooks/useXboxGames";

const GAMING_INCLUDE_STORAGE_KEY = "jp_gaming_include_overrides";

export function useGamingData() {
  const steamGames = useSteamGames();
  const xboxGames = useXboxGames();
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

    setIncludeOverrides((currentOverrides) => {
      const nextOverrides = { ...currentOverrides };

      if (includeInOverallTotal) {
        delete nextOverrides[storageKey];
      } else {
        nextOverrides[storageKey] = false;
      }

      return nextOverrides;
    });
  }, []);

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
