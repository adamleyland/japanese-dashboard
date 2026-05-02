import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const AUDIOBOOK_BASE_SELECT_COLUMNS = [
  "id",
  "slug",
  "title",
  "author",
  "narrator",
  "description",
  "cover_url",
  "cover_source",
  "audio_url",
  "duration_seconds",
  "language",
  "source",
  "created_at",
  "updated_at",
  "publisher",
  "series",
  "part",
  "published_date",
].join(", ");
const AUDIOBOOK_CHAPTER_SELECT_COLUMNS = [
  "chapters:audiobook_chapters(",
  "id, audiobook_id, chapter_index, title, start_seconds, end_seconds",
  ")",
].join("");
const AUDIOBOOK_SELECT_COLUMNS = [
  AUDIOBOOK_BASE_SELECT_COLUMNS,
  "source_filename",
  AUDIOBOOK_CHAPTER_SELECT_COLUMNS,
].join(", ");
const AUDIOBOOK_SELECT_COLUMNS_WITHOUT_SOURCE_FILENAME = [
  AUDIOBOOK_BASE_SELECT_COLUMNS,
  AUDIOBOOK_CHAPTER_SELECT_COLUMNS,
].join(", ");

function isMissingSourceFilenameColumnError(error) {
  const errorCode = String(error?.code || "");
  const errorMessage = String(error?.message || "");
  return (
    errorCode === "42703" ||
    errorCode === "PGRST204" ||
    errorMessage.includes("source_filename")
  );
}

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    let { data: audiobooks, error: audiobooksError } = await supabase
      .from("audiobooks")
      .select(AUDIOBOOK_SELECT_COLUMNS)
      .order("title", { ascending: true });

    if (audiobooksError && isMissingSourceFilenameColumnError(audiobooksError)) {
      ({ data: audiobooks, error: audiobooksError } = await supabase
        .from("audiobooks")
        .select(AUDIOBOOK_SELECT_COLUMNS_WITHOUT_SOURCE_FILENAME)
        .order("title", { ascending: true }));
    }

    if (audiobooksError) {
      return NextResponse.json(
        {
          ok: false,
          error: audiobooksError.message || "Failed to load audiobooks.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      audiobooks: Array.isArray(audiobooks) ? audiobooks : [],
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
