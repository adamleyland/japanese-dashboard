import {
  getGameStorageKey,
  hasTrackedPlaytime,
  getSourceLabel,
  toFiniteNumber,
  toTimestamp,
} from "@/lib/gaming/gaming-utils";

export function isIncludedGame(game) {
  return game?.includeInOverallTotal !== false;
}

export function selectIncludedGames(games) {
  return games.filter((game) => isIncludedGame(game));
}

export function selectExcludedGames(games) {
  return games.filter((game) => !isIncludedGame(game));
}

export function selectTrackableGames(games) {
  return games.filter((game) => hasTrackedPlaytime(game));
}

export function selectIncludedTrackableGames(games) {
  return selectIncludedGames(games).filter((game) => hasTrackedPlaytime(game));
}

export function getTrackableGamesForTotals(games) {
  return selectIncludedTrackableGames(games);
}

function compareTitles(a, b) {
  return (a?.title || "").localeCompare(b?.title || "", undefined, {
    sensitivity: "base",
  });
}

function compareByFreshness(a, b) {
  const aTimestamp = toTimestamp(a?.lastPlayedAt);
  const bTimestamp = toTimestamp(b?.lastPlayedAt);

  if (aTimestamp && bTimestamp && aTimestamp !== bTimestamp) {
    return bTimestamp - aTimestamp;
  }

  if (aTimestamp && !bTimestamp) {
    return -1;
  }

  if (!aTimestamp && bTimestamp) {
    return 1;
  }

  const recentDifference =
    toFiniteNumber(b?.minutesPlayedRecent) - toFiniteNumber(a?.minutesPlayedRecent);
  if (recentDifference) {
    return recentDifference;
  }

  const totalDifference =
    toFiniteNumber(b?.minutesPlayedTotal) - toFiniteNumber(a?.minutesPlayedTotal);
  if (totalDifference) {
    return totalDifference;
  }

  return compareTitles(a, b);
}

export function applyIncludeOverrides(games, includeOverrides = {}) {
  return games.map((game) => {
    const storageKey = getGameStorageKey(game);
    const hasOverride = Object.prototype.hasOwnProperty.call(includeOverrides, storageKey);

    return {
      ...game,
      includeInOverallTotal: hasOverride
        ? Boolean(includeOverrides[storageKey])
        : game.includeInOverallTotal !== false,
    };
  });
}

export function computeOverallGamingTotal(games) {
  return games.reduce(
    (totals, game) => {
      const totalMinutes = toFiniteNumber(game.minutesPlayedTotal);

      if (isIncludedGame(game)) {
        if (hasTrackedPlaytime(game)) {
          totals.totalMinutes += totalMinutes;
          totals.trackableIncludedCount += 1;
        }
        totals.includedCount += 1;
      } else {
        totals.excludedCount += 1;
      }

      totals.totalCount += 1;
      return totals;
    },
    {
      totalMinutes: 0,
      includedCount: 0,
      excludedCount: 0,
      trackableIncludedCount: 0,
      totalCount: 0,
    },
  );
}

export function getCurrentlyPlayingGame(games) {
  // Local-game data is kept for future use but is not eligible for the
  // Currently Playing card while the local integration is hidden.
  const eligibleGames = games.filter((game) => game?.source !== "local");

  if (!eligibleGames.length) {
    return null;
  }

  return [...eligibleGames].sort(compareByFreshness)[0] || null;
}

export function selectCurrentlyPlayingGame(games) {
  return getCurrentlyPlayingGame(games);
}

export function getVisibleLibraryGames(
  games,
  { sortKey = "hours-played", sourceFilter = "all", viewMode = "included" } = {},
) {
  const baseGames =
    viewMode === "excluded" ? selectExcludedGames(games) : selectIncludedGames(games);
  const filteredGames =
    viewMode === "excluded" || sourceFilter === "all"
      ? baseGames
      : baseGames.filter((game) => game.source === sourceFilter);

  const sortedGames = [...filteredGames];

  if (sortKey === "alphabetical") {
    sortedGames.sort(compareTitles);
    return sortedGames;
  }

  if (sortKey === "recently-played") {
    sortedGames.sort(compareByFreshness);
    return sortedGames;
  }

  if (sortKey === "source") {
    sortedGames.sort((a, b) => {
      const sourceDifference = getSourceLabel(a.source).localeCompare(getSourceLabel(b.source));
      if (sourceDifference) {
        return sourceDifference;
      }

      return compareTitles(a, b);
    });
    return sortedGames;
  }

  sortedGames.sort((a, b) => {
    const totalDifference =
      toFiniteNumber(b?.minutesPlayedTotal) - toFiniteNumber(a?.minutesPlayedTotal);
    if (totalDifference) {
      return totalDifference;
    }

    return compareByFreshness(a, b);
  });

  return sortedGames;
}

export function selectVisibleGames(
  games,
  { sortKey = "hours-played", sourceFilter = "all", viewMode = "included" } = {},
) {
  return getVisibleLibraryGames(games, { sortKey, sourceFilter, viewMode });
}

export function selectTopGamesByHours(games, { limit = 5 } = {}) {
  return [...getTrackableGamesForTotals(games)]
    .sort(
      (a, b) =>
        toFiniteNumber(b?.minutesPlayedTotal) - toFiniteNumber(a?.minutesPlayedTotal) ||
        compareTitles(a, b),
    )
    .slice(0, limit);
}
