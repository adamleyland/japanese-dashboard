"use client";

import { useMemo } from "react";
import { computeOverallGamingTotal, selectTopGamesByHours } from "@/lib/gaming/selectors";

export function useGamingTotals(games) {
  return useMemo(() => {
    const totals = computeOverallGamingTotal(games);

    return {
      ...totals,
      totalHours: totals.totalMinutes / 60,
      topGames: selectTopGamesByHours(games, { limit: 5 }),
    };
  }, [games]);
}

export default useGamingTotals;
