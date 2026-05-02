import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const AUDIOBOOK_SELECT_COLUMNS = [
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
  "source_filename",
].join(", ");

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data: audiobooks, error: audiobooksError } = await supabase
      .from("audiobooks")
      .select(AUDIOBOOK_SELECT_COLUMNS)
      .order("title", { ascending: true });

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
