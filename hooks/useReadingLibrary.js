"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_READING_LIBRARY_TABLE,
  READING_BOOKS_SELECT_COLUMNS,
  READING_STATUS_OPTIONS,
} from "@/lib/reading/constants";
import {
  getReadingStatusLabel,
  normalizeReadingItems,
} from "@/lib/reading/normalizers";

export default function useReadingLibrary(options = {}) {
  const { authResolved = true, tableName = DEFAULT_READING_LIBRARY_TABLE } = options;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [statusUpdatingIds, setStatusUpdatingIds] = useState({});

  const refresh = useCallback(() => {
    setRefreshToken((currentValue) => currentValue + 1);
  }, []);

  const updateStatus = useCallback(
    async (bookId, nextStatus) => {
      const resolvedBookId = String(bookId || "");
      const resolvedStatus = String(nextStatus || "").trim().toLowerCase();

      if (!resolvedBookId) {
        return { ok: false, error: "Missing book id." };
      }

      if (!READING_STATUS_OPTIONS.some((option) => option.key === resolvedStatus)) {
        return { ok: false, error: "Invalid reading status." };
      }

      const previousItems = items;
      const targetBook = previousItems.find((item) => item.id === resolvedBookId);
      if (!targetBook || targetBook.status === resolvedStatus) {
        return { ok: true };
      }

      const optimisticItems = previousItems.map((item) =>
        item.id === resolvedBookId
          ? {
              ...item,
              status: resolvedStatus,
              statusLabel: getReadingStatusLabel(resolvedStatus),
              updatedAt: new Date().toISOString(),
              raw: {
                ...item.raw,
                status: resolvedStatus,
              },
            }
          : item,
      );

      setStatusUpdatingIds((currentValue) => ({
        ...currentValue,
        [resolvedBookId]: true,
      }));
      setError(null);
      setItems(optimisticItems);

      const { error: updateError } = await supabase
        .from(tableName)
        .update({ status: resolvedStatus })
        .eq("id", resolvedBookId);

      if (updateError) {
        setItems(previousItems);
        setError(updateError.message || "Failed to update book status.");
        setStatusUpdatingIds((currentValue) => {
          const nextValue = { ...currentValue };
          delete nextValue[resolvedBookId];
          return nextValue;
        });

        return {
          ok: false,
          error: updateError.message || "Failed to update book status.",
        };
      }

      setStatusUpdatingIds((currentValue) => {
        const nextValue = { ...currentValue };
        delete nextValue[resolvedBookId];
        return nextValue;
      });
      refresh();

      return { ok: true };
    },
    [items, refresh, tableName],
  );

  useEffect(() => {
    if (!authResolved) {
      return;
    }

    let isActive = true;

    const loadReadingItems = async () => {
      setLoading(true);
      setError(null);

      const { data, error: nextError } = await supabase
        .from(tableName)
        .select(READING_BOOKS_SELECT_COLUMNS)
        .order("created_at", { ascending: false });

      if (!isActive) {
        return;
      }

      if (nextError) {
        setItems([]);
        setError(nextError.message || "Failed to load your reading list.");
        setLoading(false);
        return;
      }

      setItems(normalizeReadingItems(data || []));
      setLoading(false);
    };

    void loadReadingItems();

    return () => {
      isActive = false;
    };
  }, [authResolved, refreshToken, tableName]);

  return {
    items,
    loading,
    error,
    refresh,
    updateStatus,
    statusUpdatingIds,
    tableName,
  };
}
