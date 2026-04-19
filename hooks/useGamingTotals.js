"use client";

import { useMemo } from "react";
import {
  computeOverallGamingTotal,
  getTrackableGamesForTotals,
  selectTopGamesByHours,
} from "@/lib/gaming/selectors";

export function useGamingTotals(games) {
  return useMemo(() => {
    const totals = computeOverallGamingTotal(games);
    const trackableGames = getTrackableGamesForTotals(games);

    return {
      ...totals,
      totalHours: totals.totalMinutes / 60,
      trackableGames,
      topGames: selectTopGamesByHours(games, { limit: 5 }),
    };
  }, [games]);
}

export default useGamingTotals;
