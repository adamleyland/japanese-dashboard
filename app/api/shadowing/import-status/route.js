import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { readShadowingImportStatus } from "@/lib/shadowingImportStatus";

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

export async function GET(request) {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user?.id) {
      return jsonError(401, error || new Error("You need to sign in to view shadowing import progress."));
    }

    const sessionId = String(request.nextUrl.searchParams.get("sessionId") || "").trim();
    if (!sessionId) {
      return jsonError(400, new Error("Missing import session id."));
    }

    const status = readShadowingImportStatus(sessionId, user.id);
    if (!status) {
      return jsonError(404, new Error("Shadowing import session not found."));
    }

    return NextResponse.json({
      ok: true,
      status,
    });
  } catch (routeError) {
    return jsonError(500, routeError);
  }
}
