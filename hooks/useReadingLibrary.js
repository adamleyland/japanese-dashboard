"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_READING_LIBRARY_TABLE,
  READING_BOOKS_SELECT_COLUMNS,
} from "@/lib/reading/constants";
import { normalizeReadingItems } from "@/lib/reading/normalizers";

export default function useReadingLibrary(options = {}) {
  const { authResolved = true, tableName = DEFAULT_READING_LIBRARY_TABLE } = options;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
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
    tableName,
  };
}
