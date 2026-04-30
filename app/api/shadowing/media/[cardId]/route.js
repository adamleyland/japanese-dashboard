import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHADOWING_MEDIA_BUCKET = "shadowing-audio";

function toResponse(message, status) {
  return new Response(message, { status });
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const { client } = createSupabaseServerClient(cookieStore);
  const { data, error } = await client.auth.getUser();

  if (error) {
    return {
      user: null,
      error,
    };
  }

  return {
    user: data.user ?? null,
    error: null,
  };
}

export async function GET(request, context) {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user?.id) {
      return toResponse("Unauthorized", 401);
    }

    const params = await context.params;
    const cardId = String(params?.cardId || "");
    const kind = request.nextUrl.searchParams.get("kind") === "vocabulary"
      ? "vocabulary"
      : "sentence";

    if (!cardId) {
      return toResponse("Missing card id", 400);
    }

    const adminClient = getSupabaseAdminClient();
    const { data: cardRow, error: cardError } = await adminClient
      .from("shadowing_cards")
      .select("user_id, sentence_audio_url, vocab_audio_url")
      .eq("id", cardId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (cardError) {
      return toResponse(cardError.message || "Failed to load shadowing media.", 500);
    }

    const mediaPath = kind === "vocabulary" ? cardRow?.vocab_audio_url : cardRow?.sentence_audio_url;

    if (!mediaPath) {
      return toResponse("Audio not found", 404);
    }

    const { data: mediaData, error: mediaError } = await adminClient.storage
      .from(SHADOWING_MEDIA_BUCKET)
      .download(mediaPath);

    if (mediaError || !mediaData) {
      return toResponse(mediaError?.message || "Failed to stream shadowing audio.", 404);
    }

    return new Response(mediaData, {
      status: 200,
      headers: {
        "Content-Type": mediaData.type || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return toResponse(error instanceof Error ? error.message : "Failed to stream audio.", 500);
  }
}
