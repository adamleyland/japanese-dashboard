"use client";

import { useCallback, useEffect, useState } from "react";
import rakutenImageUtils from "@/lib/rakutenImage";

const { getHighResRakutenImage } = rakutenImageUtils;

export default function useLingQStats(options = {}) {
  const { enabled = true } = options;
  const [stats, setStats] = useState({
    configured: false,
    totalWordsRead: null,
    estimatedReadingHours: null,
    bookTitle: null,
    chapterTitle: null,
    bookImage: null,
    bookProgress: null,
    lessonId: null,
    lessonUrl: null,
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
        const response = await fetch("/api/lingq", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          setStats((currentValue) => ({
            ...currentValue,
            configured:
              typeof payload?.configured === "boolean"
                ? payload.configured
                : currentValue.configured,
            loading: false,
            error: payload?.error || "Failed to load LingQ stats.",
            source: payload?.source || currentValue.source,
            fetchedAt: payload?.fetchedAt || new Date().toISOString(),
          }));
          return;
        }

        setStats({
          configured: Boolean(payload?.configured),
          totalWordsRead:
            typeof payload?.wordsRead === "number"
              ? payload.wordsRead
              : typeof payload?.totalWordsRead === "number"
                ? payload.totalWordsRead
                : null,
          estimatedReadingHours:
            typeof payload?.estimatedReadingHours === "number"
              ? payload.estimatedReadingHours
              : null,
          bookTitle: typeof payload?.bookTitle === "string" ? payload.bookTitle : null,
          chapterTitle:
            typeof payload?.chapterTitle === "string" ? payload.chapterTitle : null,
          bookImage:
            typeof payload?.bookImage === "string"
              ? getHighResRakutenImage(payload.bookImage)
              : null,
          bookProgress:
            typeof payload?.bookProgress === "number" ? payload.bookProgress : null,
          lessonId:
            typeof payload?.lessonId === "number" ? payload.lessonId : null,
          lessonUrl:
            typeof payload?.lessonUrl === "string" ? payload.lessonUrl : null,
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
