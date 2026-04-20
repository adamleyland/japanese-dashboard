import { supabase } from "@/lib/supabase";

const PROFILES_TABLE = "profiles";
const PROFILE_MISSING_ROW_CODE = "PGRST116";
const PROFILE_MISSING_TABLE_CODE = "42P01";

function resolveSupabaseClient(client) {
  return client || supabase;
}

function buildProfilePayload(user) {
  return {
    id: user.id,
    email: user.email ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function ensureUserProfile(user, client) {
  if (!user?.id) {
    return null;
  }

  const supabaseClient = resolveSupabaseClient(client);
  const { data: existingProfile, error: fetchError } = await supabaseClient
    .from(PROFILES_TABLE)
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchError) {
    if (fetchError.code === PROFILE_MISSING_TABLE_CODE) {
      console.error(
        'The "profiles" table is missing. Run the latest Supabase migrations before relying on profile bootstrap.',
        fetchError,
      );
      return null;
    }

    console.error("Failed to fetch profile by user.id", fetchError);
    return null;
  }

  if (existingProfile) {
    return existingProfile;
  }

  const { data: createdProfile, error: insertError } = await supabaseClient
    .from(PROFILES_TABLE)
    .insert(buildProfilePayload(user))
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: duplicateProfile, error: duplicateFetchError } = await supabaseClient
        .from(PROFILES_TABLE)
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (duplicateFetchError) {
        console.error("Failed to re-fetch profile after duplicate insert", duplicateFetchError);
        return null;
      }

      return duplicateProfile ?? null;
    }

    console.error("Failed to create profile for signed-in user", insertError);
    return null;
  }

  return createdProfile;
}

export async function persistGoogleProviderTokens(
  { userId, email, providerToken, providerRefreshToken },
  client,
) {
  if (!userId) {
    return null;
  }

  const supabaseClient = resolveSupabaseClient(client);
  const { data, error } = await supabaseClient
    .from(PROFILES_TABLE)
    .upsert({
      id: userId,
      email: email ?? null,
      google_provider_token: providerToken ?? null,
      google_provider_refresh_token: providerRefreshToken ?? null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "id",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to persist Google provider tokens", error);
    return null;
  }

  return data;
}

export async function fetchStoredGoogleAccessToken(userId, client) {
  if (!userId) {
    return "";
  }

  const supabaseClient = resolveSupabaseClient(client);
  const { data, error } = await supabaseClient
    .from(PROFILES_TABLE)
    .select("google_provider_token")
    .eq("id", userId)
    .maybeSingle();

  if (error && error.code !== PROFILE_MISSING_ROW_CODE) {
    console.error("Failed to fetch stored Google provider token", error);
    return "";
  }

  return data?.google_provider_token || "";
}
