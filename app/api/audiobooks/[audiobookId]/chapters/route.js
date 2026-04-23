import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const { data, error } = await supabase
      .from("audiobook_chapters")
      .select("id, audiobook_id, chapter_index, title, start_seconds, end_seconds")
      .eq("audiobook_id", audiobookId)
      .order("chapter_index", { ascending: true });

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
      chapters: Array.isArray(data) ? data.map(normalizeChapterRow) : [],
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
