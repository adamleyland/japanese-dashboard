import { supabase } from "@/lib/supabase";

const GRAMMAR_ATTEMPTS_TABLE = "writing_grammar_attempts";
const GRAMMAR_ATTEMPTS_CACHE_KEY = "jp_writing_grammar_attempts_v1";
const SELECT_COLUMNS = [
  "id",
  "user_id",
  "entry_id",
  "grammar_point_id",
  "grammar_level",
  "source",
  "attempted",
  "used",
  "quality_score",
  "correctness_score",
  "naturalness_score",
  "evidence",
  "feedback",
  "created_at",
  "updated_at",
].join(", ");

export async function readGrammarAttempts(userId = "") {
  if (!userId) return { attempts: [], error: null, fromCache: false };

  const cachedAttempts = readCache(userId);
  const { data, error } = await supabase
    .from(GRAMMAR_ATTEMPTS_TABLE)
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { attempts: cachedAttempts, error, fromCache: cachedAttempts.length > 0 };
  }

  const attempts = (data || []).map(normalizeAttempt).filter(Boolean);
  writeCache(userId, attempts);
  return { attempts, error: null, fromCache: false };
}

export async function persistGrammarAttempt({ userId, entryId, grammarPoint, assessment, source = "prompted" }) {
  if (!userId || !entryId || !grammarPoint?.id || !assessment) {
    return { attempt: null, error: new Error("Grammar progress data is incomplete.") };
  }

  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    entry_id: entryId,
    grammar_point_id: grammarPoint.id,
    grammar_level: grammarPoint.level,
    source: source === "detected" ? "detected" : "prompted",
    attempted: Boolean(assessment.attempted),
    used: Boolean(assessment.used),
    quality_score: clampScore(assessment.qualityScore),
    correctness_score: clampScore(assessment.correctnessScore),
    naturalness_score: clampScore(assessment.naturalnessScore),
    evidence: String(assessment.evidence || "").trim() || null,
    feedback: String(assessment.feedback || "").trim() || null,
    updated_at: now,
  };
  const { data, error } = await supabase
    .from(GRAMMAR_ATTEMPTS_TABLE)
    .upsert(payload, { onConflict: "user_id,entry_id,grammar_point_id" })
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    const localAttempt = normalizeAttempt({ ...payload, id: `local-${entryId}-${grammarPoint.id}`, created_at: now });
    upsertCache(userId, localAttempt);
    return { attempt: localAttempt, error };
  }

  const attempt = normalizeAttempt(data);
  upsertCache(userId, attempt);
  return { attempt, error: null };
}

export async function deleteGrammarAttemptsForEntry(userId, entryId) {
  if (!userId || !entryId) return;
  writeCache(userId, readCache(userId).filter((attempt) => attempt.entryId !== entryId));
  await supabase
    .from(GRAMMAR_ATTEMPTS_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("entry_id", entryId);
}

function normalizeAttempt(row) {
  if (!row?.grammar_point_id) return null;
  return {
    id: String(row.id || ""),
    userId: String(row.user_id || ""),
    entryId: String(row.entry_id || ""),
    grammarPointId: String(row.grammar_point_id || ""),
    grammarLevel: String(row.grammar_level || ""),
    source: String(row.source || "prompted"),
    attempted: Boolean(row.attempted),
    used: Boolean(row.used),
    qualityScore: clampScore(row.quality_score),
    correctnessScore: clampScore(row.correctness_score),
    naturalnessScore: clampScore(row.naturalness_score),
    evidence: String(row.evidence || ""),
    feedback: String(row.feedback || ""),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || row.created_at || "",
  };
}

function getCacheKey(userId) {
  return `${GRAMMAR_ATTEMPTS_CACHE_KEY}:${userId}`;
}

function readCache(userId) {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(getCacheKey(userId)) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeCache(userId, attempts) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getCacheKey(userId), JSON.stringify(attempts));
}

function upsertCache(userId, attempt) {
  const current = readCache(userId);
  const next = [attempt, ...current.filter((item) => !(
    item.entryId === attempt.entryId && item.grammarPointId === attempt.grammarPointId
  ))];
  writeCache(userId, next);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}
