import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const MODERN_CHAPTER_SELECT_COLUMNS =
  "id, audiobook_id, chapter_index, title, start_seconds, end_seconds";
const LEGACY_CHAPTER_SELECT_COLUMNS = "id, audiobook_id, title, start_seconds, created_at";

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeChapterRow(row, index) {
  const startSeconds = Math.max(0, toSafeNumber(row?.start_seconds, 0));
  const endCandidate = row?.end_seconds;
  const endSeconds =
    endCandidate == null || endCandidate === ""
      ? null
      : (() => {
          const parsed = Number(endCandidate);
          return Number.isFinite(parsed) && parsed > startSeconds ? parsed : null;
        })();
  const chapterIndex = Math.max(0, Math.floor(toSafeNumber(row?.chapter_index, index)));

  return {
    id: String(row?.id || `chapter-${chapterIndex + 1}`),
    audiobookId: String(row?.audiobook_id || ""),
    chapterIndex,
    title: String(row?.title || `Chapter ${chapterIndex + 1}`),
    startSeconds,
    endSeconds,
  };
}

function isLegacyChapterSchemaError(error) {
  const errorCode = String(error?.code || "");
  const errorMessage = String(error?.message || "");
  return (
    errorCode === "42703" ||
    errorCode === "PGRST204" ||
    errorMessage.includes("chapter_index") ||
    errorMessage.includes("end_seconds")
  );
}

export async function GET(_request, context) {
  const { audiobookId } = await context.params;

  if (!audiobookId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing audiobook id.",
      },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdminClient();
    let usedLegacySchema = false;
    let { data, error } = await supabase
      .from("audiobook_chapters")
      .select(MODERN_CHAPTER_SELECT_COLUMNS)
      .eq("audiobook_id", audiobookId)
      .order("chapter_index", { ascending: true });

    if (error && isLegacyChapterSchemaError(error)) {
      usedLegacySchema = true;
      ({ data, error } = await supabase
        .from("audiobook_chapters")
        .select(LEGACY_CHAPTER_SELECT_COLUMNS)
        .eq("audiobook_id", audiobookId)
        .order("start_seconds", { ascending: true }));
    }

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to load audiobook chapters.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      audiobookId,
      chapters: Array.isArray(data)
        ? data.map((row, index) =>
            normalizeChapterRow(
              usedLegacySchema
                ? {
                    ...row,
                    chapter_index: index,
                    end_seconds: null,
                  }
                : row,
              index,
            ),
          )
        : [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load audiobook chapters.",
      },
      { status: 500 },
    );
  }
}
