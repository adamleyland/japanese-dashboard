import { supabase } from "@/lib/supabase";

const WRITING_TABLE = "writing_entries";
const WRITING_CACHE_STORAGE_KEY = "jp_writing_entries_cache_v1";
const WRITING_LIST_SELECT_COLUMNS = [
  "id",
  "user_id",
  "title",
  "preview",
  "character_count",
  "estimated_words",
  "estimated_minutes",
  "entry_local_date",
  "created_at",
  "updated_at",
].join(", ");
const WRITING_ENTRY_SELECT_COLUMNS = [
  "id",
  "user_id",
  "title",
  "body",
  "preview",
  "character_count",
  "estimated_words",
  "estimated_minutes",
  "entry_local_date",
  "created_at",
  "updated_at",
].join(", ");

function getScopedStorageKey(baseKey, userId = "") {
  return userId ? `${baseKey}:${userId}` : baseKey;
}

function canUseLocalStorage() {
  return typeof window !== "undefined";
}

function sortWritingEntries(entries) {
  return [...entries].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function normalizeWritingEntry(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  return {
    id: String(row.id || ""),
    userId: String(row.user_id || ""),
    title: typeof row.title === "string" ? row.title : "",
    body: typeof row.body === "string" ? row.body : "",
    preview: typeof row.preview === "string" ? row.preview : "",
    characterCount: Math.max(0, Number(row.character_count) || 0),
    estimatedWords: Math.max(0, Number(row.estimated_words) || 0),
    estimatedMinutes: Math.max(0, Number(row.estimated_minutes) || 0),
    entryLocalDate: typeof row.entry_local_date === "string" ? row.entry_local_date : "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || row.created_at || "",
  };
}

function normalizeWritingEntries(rows) {
  return sortWritingEntries((Array.isArray(rows) ? rows : []).map(normalizeWritingEntry).filter(Boolean));
}

function readCachedWritingEntries(userId = "") {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(
      getScopedStorageKey(WRITING_CACHE_STORAGE_KEY, userId),
    );
    const parsedValue = JSON.parse(rawValue || "[]");
    return sortWritingEntries(Array.isArray(parsedValue) ? parsedValue : []);
  } catch {
    return [];
  }
}

function writeCachedWritingEntries(entries, userId = "") {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
    getScopedStorageKey(WRITING_CACHE_STORAGE_KEY, userId),
    JSON.stringify(sortWritingEntries(Array.isArray(entries) ? entries : [])),
  );
}

function removeCachedWritingEntry(entryId, userId = "") {
  const nextEntries = readCachedWritingEntries(userId).filter((entry) => entry.id !== entryId);
  writeCachedWritingEntries(nextEntries, userId);
}

function toLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDatabasePayload(entry, userId) {
  const resolvedCreatedAt = entry?.createdAt || new Date().toISOString();
  const resolvedUpdatedAt = entry?.updatedAt || new Date().toISOString();

  return {
    id: entry.id,
    user_id: userId,
    title: entry.title || null,
    body: entry.body || "",
    preview: entry.preview || "",
    character_count: Math.max(0, Number(entry.characterCount) || 0),
    estimated_words: Math.max(0, Number(entry.estimatedWords) || 0),
    estimated_minutes: Math.max(0, Number(entry.estimatedMinutes) || 0),
    entry_local_date: entry.entryLocalDate || toLocalDateKey(resolvedCreatedAt),
    created_at: resolvedCreatedAt,
    updated_at: resolvedUpdatedAt,
  };
}

export async function readWritingEntries(userId = "") {
  if (!userId) {
    return {
      entries: [],
      fromCache: false,
      error: null,
    };
  }

  const cachedEntries = readCachedWritingEntries(userId);
  const { data, error } = await supabase
    .from(WRITING_TABLE)
    .select(WRITING_LIST_SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    return {
      entries: cachedEntries,
      fromCache: cachedEntries.length > 0,
      error,
    };
  }

  const cachedEntriesById = new Map(cachedEntries.map((entry) => [entry.id, entry]));
  const entries = normalizeWritingEntries(data || []).map((entry) => ({
    ...entry,
    body: cachedEntriesById.get(entry.id)?.body || "",
  }));
  writeCachedWritingEntries(entries, userId);

  return {
    entries,
    fromCache: false,
    error: null,
  };
}

export async function readWritingEntry(entryId, userId = "") {
  if (!userId || !entryId) {
    return {
      entry: null,
      error: new Error("Sign in to load writing entries."),
    };
  }

  const { data, error } = await supabase
    .from(WRITING_TABLE)
    .select(WRITING_ENTRY_SELECT_COLUMNS)
    .eq("id", entryId)
    .eq("user_id", userId)
    .single();

  if (error) {
    return {
      entry: null,
      error,
    };
  }

  const normalizedEntry = normalizeWritingEntry(data);
  const nextEntries = upsertWritingEntry(readCachedWritingEntries(userId), normalizedEntry);
  writeCachedWritingEntries(nextEntries, userId);

  return {
    entry: normalizedEntry,
    error: null,
  };
}

export async function persistWritingEntry(entry, userId = "", mode = "insert") {
  if (!userId) {
    return {
      entry: null,
      error: new Error("Sign in to save writing entries."),
    };
  }

  const payload = toDatabasePayload(entry, userId);
  const baseQuery = supabase.from(WRITING_TABLE);
  const query =
    mode === "update"
      ? baseQuery.update(payload).eq("id", payload.id).eq("user_id", userId)
      : baseQuery.insert(payload);

  const { data, error } = await query.select(WRITING_ENTRY_SELECT_COLUMNS).single();

  if (error) {
    return {
      entry: null,
      error,
    };
  }

  const normalizedEntry = normalizeWritingEntry(data);
  const nextEntries = upsertWritingEntry(readCachedWritingEntries(userId), normalizedEntry);
  writeCachedWritingEntries(nextEntries, userId);

  return {
    entry: normalizedEntry,
    error: null,
  };
}

export async function deleteWritingEntry(entryId, userId = "") {
  if (!userId) {
    return {
      ok: false,
      error: new Error("Sign in to delete writing entries."),
    };
  }

  const { error } = await supabase
    .from(WRITING_TABLE)
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId);

  if (error) {
    return {
      ok: false,
      error,
    };
  }

  removeCachedWritingEntry(entryId, userId);

  return {
    ok: true,
    error: null,
  };
}

export function upsertWritingEntry(entries, nextEntry) {
  return sortWritingEntries([nextEntry, ...entries.filter((entry) => entry.id !== nextEntry.id)]);
}

export function removeWritingEntry(entries, entryId) {
  return sortWritingEntries(entries.filter((entry) => entry.id !== entryId));
}

export function createWritingEntryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `writing-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
