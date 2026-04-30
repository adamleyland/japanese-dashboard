import { createServerClient } from "@supabase/ssr";
import { instrumentSupabaseClient } from "@/lib/supabaseQueryLogger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createSupabaseServerClient(cookieStore) {
  const pendingCookies = [];

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookies) {
        cookies.forEach((cookie) => {
          pendingCookies.push(cookie);
        });
      },
    },
    auth: {
      flowType: "pkce",
    },
  });

  return {
    client: instrumentSupabaseClient(client, {
      clientName: "server",
    }),
    pendingCookies,
  };
}
