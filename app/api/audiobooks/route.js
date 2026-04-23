import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeChapterRow(row, index) {
  const chapterIndex = Math.max(0, Math.floor(toSafeNumber(row?.chapter_index, index)));
  const startSeconds = Math.max(0, toSafeNumber(row?.start_seconds, 0));
  const endCandidate = row?.end_seconds;
  const endSeconds =
    endCandidate == null || endCandidate === ""
      ? null
      : (() => {
          const parsed = Number(endCandidate);
          return Number.isFinite(parsed) && parsed > startSeconds ? parsed : null;
        })();

  return {
    id: String(row?.id || `chapter-${chapterIndex + 1}`),
    audiobookId: String(row?.audiobook_id || ""),
    chapterIndex,
    title: String(row?.title || `Chapter ${chapterIndex + 1}`),
    startSeconds,
    endSeconds,
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const [{ data: audiobooks, error: audiobooksError }, { data: chapters, error: chaptersError }] =
      await Promise.all([
        supabase.from("audiobooks").select("*").order("title", { ascending: true }),
        supabase
          .from("audiobook_chapters")
          .select("id, audiobook_id, chapter_index, title, start_seconds, end_seconds")
          .order("audiobook_id", { ascending: true })
          .order("chapter_index", { ascending: true }),
      ]);

    if (audiobooksError) {
      return NextResponse.json(
        {
          ok: false,
          error: audiobooksError.message || "Failed to load audiobooks.",
        },
        { status: 500 },
      );
    }

    if (chaptersError) {
      return NextResponse.json(
        {
          ok: false,
          error: chaptersError.message || "Failed to load audiobook chapters.",
        },
        { status: 500 },
      );
    }

    const chapterMap = new Map();
    for (const chapter of chapters || []) {
      const audiobookId = String(chapter?.audiobook_id || "");
      if (!audiobookId) {
        continue;
      }

      const existing = chapterMap.get(audiobookId) || [];
      existing.push(normalizeChapterRow(chapter, existing.length));
      chapterMap.set(audiobookId, existing);
    }

    const payload = (audiobooks || []).map((audiobook) => ({
      ...audiobook,
      chapters: chapterMap.get(String(audiobook.id)) || [],
    }));

    return NextResponse.json({
      ok: true,
      audiobooks: payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load audiobooks.",
      },
      { status: 500 },
    );
  }
}
