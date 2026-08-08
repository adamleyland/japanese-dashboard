import "server-only";

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

function getLocalDevelopmentUser() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const userId = String(process.env.DEV_BYPASS_USER_ID || "").trim();
  return userId ? { id: userId, email: "local-development@dashboard.invalid" } : null;
}

/**
 * Resolves either the browser's Supabase cookie session or a Bearer access token.
 * Companion clients should send `Authorization: Bearer <Supabase access token>`.
 */
export async function getRequestUser(request) {
  const localDevelopmentUser = getLocalDevelopmentUser();
  if (localDevelopmentUser) {
    return { user: localDevelopmentUser, error: null };
  }

  const authorization = request.headers.get("authorization") || "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch?.[1]) {
    const { data, error } = await getSupabaseAdminClient().auth.getUser(bearerMatch[1]);
    return { user: data?.user ?? null, error };
  }

  const cookieStore = await cookies();
  const { client } = createSupabaseServerClient(cookieStore);
  const { data, error } = await client.auth.getUser();
  return { user: data?.user ?? null, error };
}
