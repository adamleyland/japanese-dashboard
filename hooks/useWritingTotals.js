"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const WRITING_TOTALS_SELECT_COLUMNS = "id, estimated_words";

export default function useWritingTotals(options = {}) {
  const { authUserId = "", authResolved = true } = options;
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(Boolean(authResolved && authUserId));
  const [error, setError] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((currentValue) => currentValue + 1);
  }, []);

  useEffect(() => {
    if (!authResolved) {
      return;
    }

    let isActive = true;

    const loadWritingTotals = async () => {
      if (!authUserId) {
        if (!isActive) {
          return;
        }

        setEntries([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: nextError } = await supabase
        .from("writing_entries")
        .select(WRITING_TOTALS_SELECT_COLUMNS)
        .eq("user_id", authUserId);

      if (!isActive) {
        return;
      }

      if (nextError) {
        setEntries([]);
        setLoading(false);
        setError(nextError.message || "Failed to load writing totals.");
        return;
      }

      setEntries(Array.isArray(data) ? data : []);
      setLoading(false);
      setError(null);
    };

    void loadWritingTotals();

    return () => {
      isActive = false;
    };
  }, [authResolved, authUserId, refreshToken]);

  const totalWords = useMemo(() => {
    return entries.reduce(
      (sum, entry) => sum + Math.max(0, Number(entry?.estimated_words) || 0),
      0,
    );
  }, [entries]);

  return {
    totalWords,
    loading,
    error,
    refresh,
  };
}
