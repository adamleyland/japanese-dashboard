"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_READING_LIBRARY_TABLE } from "@/lib/reading/constants";
import { normalizeReadingItems } from "@/lib/reading/normalizers";

function getRowUserId(row) {
  return row?.user_id || row?.userId || row?.profile_id || row?.owner_id || null;
}

function filterRowsForUser(rows, authUserId) {
  const hasOwnedRows = rows.some((row) => Boolean(getRowUserId(row)));

  if (!hasOwnedRows) {
    return rows;
  }

  if (!authUserId) {
    return [];
  }

  return rows.filter((row) => getRowUserId(row) === authUserId);
}

export default function useReadingLibrary(options = {}) {
  const {
    authResolved = true,
    authUserId = "",
    tableName = DEFAULT_READING_LIBRARY_TABLE,
  } = options;
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

      const { data, error: nextError } = await supabase.from(tableName).select("*");

      if (!isActive) {
        return;
      }

      if (nextError) {
        setItems([]);
        setError(nextError.message || "Failed to load your reading list.");
        setLoading(false);
        return;
      }

      const filteredRows = filterRowsForUser(data || [], authUserId);
      setItems(normalizeReadingItems(filteredRows));
      setLoading(false);
    };

    void loadReadingItems();

    return () => {
      isActive = false;
    };
  }, [authResolved, authUserId, refreshToken, tableName]);

  return {
    items,
    loading,
    error,
    refresh,
    tableName,
  };
}

