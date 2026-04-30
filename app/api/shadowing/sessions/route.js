import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonError(status, error) {
  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : String(error || "Unknown error"),
    },
    { status },
  );
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

export async function POST(request) {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user?.id) {
      return jsonError(401, error || new Error("You need to sign in to save shadowing sessions."));
    }

    const payload = await request.json().catch(() => ({}));
    const elapsedSeconds = Math.max(0, Math.round(Number(payload?.elapsedSeconds) || 0));
    const deckId = payload?.deckId ? String(payload.deckId) : null;

    if (!elapsedSeconds) {
      return jsonError(400, new Error("Missing completed shadowing session data."));
    }

    const adminClient = getSupabaseAdminClient();
    const { error: insertError } = await adminClient.from("shadowing_sessions").insert({
      user_id: user.id,
      deck_id: deckId,
      duration_seconds: elapsedSeconds,
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      return jsonError(500, insertError);
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return jsonError(500, error);
  }
}
