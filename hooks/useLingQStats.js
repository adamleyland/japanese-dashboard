"use client";

import { useCallback, useEffect, useState } from "react";

export default function useLingQStats(options = {}) {
  const { enabled = true } = options;
  const [stats, setStats] = useState({
    configured: false,
    totalWordsRead: null,
    loading: enabled,
    error: null,
    source: "lingq",
    fetchedAt: null,
  });
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((currentValue) => currentValue + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStats((currentValue) => ({
        ...currentValue,
        loading: false,
      }));
      return;
    }

    const controller = new AbortController();

    const loadLingQStats = async () => {
      setStats((currentValue) => ({
        ...currentValue,
        loading: true,
        error: null,
      }));

      try {
        const response = await fetch("/api/reading/lingq", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load LingQ stats.");
        }

        setStats({
          configured: Boolean(payload?.configured),
          totalWordsRead:
            typeof payload?.totalWordsRead === "number" ? payload.totalWordsRead : null,
          loading: false,
          error: null,
          source: payload?.source || "lingq",
          fetchedAt: payload?.fetchedAt || new Date().toISOString(),
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setStats((currentValue) => ({
          ...currentValue,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load LingQ stats.",
        }));
      }
    };

    void loadLingQStats();

    return () => {
      controller.abort();
    };
  }, [enabled, refreshToken]);

  return {
    ...stats,
    hasStats: typeof stats.totalWordsRead === "number",
    refresh,
  };
}

