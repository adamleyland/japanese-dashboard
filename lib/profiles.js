import { supabase } from "@/lib/supabase";

const PROFILES_TABLE = "profiles";
const PROFILE_MISSING_ROW_CODE = "PGRST116";
const PROFILE_MISSING_TABLE_CODE = "42P01";
const PROFILE_DUPLICATE_ROW_CODE = "23505";
const LISTENING_GOAL_COLUMN = "listening_goal";
const SHADOWING_GOAL_COLUMN = "shadowing_goal";
const GAMING_GOAL_COLUMN = "gaming_goal";
const PROFILE_BOOTSTRAP_SELECT_COLUMNS = "id";

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

function summarizeSupabaseError(error) {
  return {
    message: error?.message || "",
    code: error?.code || "",
    details: error?.details || "",
    hint: error?.hint || "",
  };
}

function logProfileError(message, error, context = {}) {
  console.error(`[Profiles] ${message}`, {
    ...summarizeSupabaseError(error),
    ...context,
  });
}

function logProfileInfo(message, context = {}) {
  console.info(`[Profiles] ${message}`, context);
}

function isMissingColumnError(error, columnName, tableName = PROFILES_TABLE) {
  const haystack = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack) {
    return false;
  }

  return (
    haystack.includes("column") &&
    haystack.includes(String(columnName || "").toLowerCase()) &&
    haystack.includes(String(tableName || "").toLowerCase()) &&
    (haystack.includes("does not exist") ||
      haystack.includes("not found") ||
      haystack.includes("schema cache"))
  );
}

function isDuplicateProfileError(error) {
  if (error?.code === PROFILE_DUPLICATE_ROW_CODE) {
    return true;
  }

  const normalizedMessage = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    normalizedMessage.includes("duplicate") ||
    normalizedMessage.includes("already exists") ||
    normalizedMessage.includes("unique constraint")
  );
}

function normalizeListeningGoalValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
}

function normalizeShadowingGoalValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
}

function normalizeGamingGoalValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
}

async function fetchProfileById(userId, client) {
  const supabaseClient = resolveSupabaseClient(client);
  const { data, error } = await supabaseClient
    .from(PROFILES_TABLE)
    .select(PROFILE_BOOTSTRAP_SELECT_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  return {
    data: data ?? null,
    error: error ?? null,
  };
}

export async function ensureUserProfile(user, client) {
  if (!user?.id) {
    return null;
  }

  const supabaseClient = resolveSupabaseClient(client);
  const { data: existingProfile, error: fetchError } = await fetchProfileById(user.id, supabaseClient);

  if (fetchError) {
    if (fetchError.code === PROFILE_MISSING_TABLE_CODE) {
      logProfileError(
        'The "profiles" table is missing. Run the latest Supabase migrations before relying on profile bootstrap.',
        fetchError,
        {
          userId: user.id,
          stage: "select-before-insert",
        },
      );
      return null;
    }

    logProfileError("Failed to fetch profile by user.id before bootstrap insert", fetchError, {
      userId: user.id,
      stage: "select-before-insert",
    });
  }

  if (existingProfile) {
    logProfileInfo("Using existing profile during bootstrap", {
      userId: user.id,
    });
    return existingProfile;
  }

  const profilePayload = buildProfilePayload(user);

  const { data: createdProfile, error: insertError } = await supabaseClient
    .from(PROFILES_TABLE)
    .insert(profilePayload)
    .select(PROFILE_BOOTSTRAP_SELECT_COLUMNS)
    .single();

  if (!insertError) {
    logProfileInfo("Created missing profile during bootstrap", {
      userId: user.id,
    });
    return createdProfile;
  }

  const duplicateLikeError = isDuplicateProfileError(insertError);
  logProfileError(
    duplicateLikeError
      ? "Profile insert reported an existing row; attempting recovery fetch"
      : "Failed to create profile for signed-in user",
    insertError,
    {
      userId: user.id,
      stage: "insert",
      duplicateLikeError,
      payload: profilePayload,
    },
  );

  const { data: recoveredProfile, error: recoveryError } = await fetchProfileById(user.id, supabaseClient);
  if (recoveryError) {
    if (recoveryError.code === PROFILE_MISSING_TABLE_CODE) {
      logProfileError(
        'The "profiles" table is missing while attempting profile recovery after insert failure.',
        recoveryError,
        {
          userId: user.id,
          stage: "recovery-select",
        },
      );
      return null;
    }

    logProfileError("Failed to re-fetch profile after insert failure", recoveryError, {
      userId: user.id,
      stage: "recovery-select",
      duplicateLikeError,
    });
    return null;
  }

  if (recoveredProfile) {
    logProfileInfo("Recovered existing profile after insert failure", {
      userId: user.id,
      duplicateLikeError,
    });
    return recoveredProfile;
  }

  return null;
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
    .select(PROFILE_BOOTSTRAP_SELECT_COLUMNS)
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

export async function fetchProfileListeningGoal(userId, client) {
  if (!userId) {
    return null;
  }

  const supabaseClient = resolveSupabaseClient(client);
  const { data, error } = await supabaseClient
    .from(PROFILES_TABLE)
    .select(LISTENING_GOAL_COLUMN)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === PROFILE_MISSING_TABLE_CODE) {
      logProfileError(
        'The "profiles" table is missing while fetching the listening goal.',
        error,
        {
          userId,
          stage: "fetch-listening-goal",
        },
      );
      return null;
    }

    if (error.code !== PROFILE_MISSING_ROW_CODE) {
      logProfileError("Failed to fetch listening goal from profile", error, {
        userId,
        stage: "fetch-listening-goal",
      });
    }

    return null;
  }

  return normalizeListeningGoalValue(data?.listening_goal);
}

export async function persistProfileListeningGoal(userId, listeningGoal, client) {
  if (!userId) {
    return null;
  }

  const normalizedListeningGoal = normalizeListeningGoalValue(listeningGoal);
  const supabaseClient = resolveSupabaseClient(client);
  const { data, error } = await supabaseClient
    .from(PROFILES_TABLE)
    .upsert(
      {
        id: userId,
        listening_goal: normalizedListeningGoal,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      },
    )
    .select(`id, ${LISTENING_GOAL_COLUMN}`)
    .single();

  if (error) {
    logProfileError("Failed to persist listening goal to profile", error, {
      userId,
      listeningGoal: normalizedListeningGoal,
      stage: "persist-listening-goal",
    });
    return null;
  }

  return data;
}

export async function fetchProfileShadowingGoal(userId, client) {
  if (!userId) {
    return null;
  }

  const supabaseClient = resolveSupabaseClient(client);
  const { data, error } = await supabaseClient
    .from(PROFILES_TABLE)
    .select(SHADOWING_GOAL_COLUMN)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === PROFILE_MISSING_TABLE_CODE) {
      logProfileError(
        'The "profiles" table is missing while fetching the shadowing goal.',
        error,
        {
          userId,
          stage: "fetch-shadowing-goal",
        },
      );
      return null;
    }

    if (isMissingColumnError(error, SHADOWING_GOAL_COLUMN)) {
      logProfileInfo(
        'The "profiles.shadowing_goal" column is missing. Run the latest Supabase migrations to persist the Shadowing goal; falling back to local state for now.',
        {
          userId,
          stage: "fetch-shadowing-goal",
          ...summarizeSupabaseError(error),
        },
      );
      return null;
    }

    if (error.code !== PROFILE_MISSING_ROW_CODE) {
      logProfileError("Failed to fetch shadowing goal from profile", error, {
        userId,
        stage: "fetch-shadowing-goal",
      });
    }

    return null;
  }

  return normalizeShadowingGoalValue(data?.shadowing_goal);
}

export async function persistProfileShadowingGoal(userId, shadowingGoal, client) {
  if (!userId) {
    return null;
  }

  const normalizedShadowingGoal = normalizeShadowingGoalValue(shadowingGoal);
  const supabaseClient = resolveSupabaseClient(client);
  const { data, error } = await supabaseClient
    .from(PROFILES_TABLE)
    .upsert(
      {
        id: userId,
        shadowing_goal: normalizedShadowingGoal,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      },
    )
    .select(`id, ${SHADOWING_GOAL_COLUMN}`)
    .single();

  if (error) {
    if (isMissingColumnError(error, SHADOWING_GOAL_COLUMN)) {
      logProfileInfo(
        'The "profiles.shadowing_goal" column is missing. Run the latest Supabase migrations to persist the Shadowing goal; continuing with local state only.',
        {
          userId,
          shadowingGoal: normalizedShadowingGoal,
          stage: "persist-shadowing-goal",
          ...summarizeSupabaseError(error),
        },
      );
      return null;
    }

    logProfileError("Failed to persist shadowing goal to profile", error, {
      userId,
      shadowingGoal: normalizedShadowingGoal,
      stage: "persist-shadowing-goal",
    });
    return null;
  }

  return data;
}

export async function fetchProfileGamingGoal(userId, client) {
  if (!userId) {
    return null;
  }

  const supabaseClient = resolveSupabaseClient(client);
  const { data, error } = await supabaseClient
    .from(PROFILES_TABLE)
    .select(GAMING_GOAL_COLUMN)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error, GAMING_GOAL_COLUMN)) {
      logProfileInfo(
        'The "profiles.gaming_goal" column is missing. Run the latest Supabase migrations to persist the gaming goal; falling back to local state for now.',
        {
          userId,
          stage: "fetch-gaming-goal",
          ...summarizeSupabaseError(error),
        },
      );
      return null;
    }

    if (error.code !== PROFILE_MISSING_ROW_CODE) {
      logProfileError("Failed to fetch gaming goal from profile", error, {
        userId,
        stage: "fetch-gaming-goal",
      });
    }

    return null;
  }

  return normalizeGamingGoalValue(data?.gaming_goal);
}

export async function persistProfileGamingGoal(userId, gamingGoal, client) {
  if (!userId) {
    return null;
  }

  const normalizedGamingGoal = normalizeGamingGoalValue(gamingGoal);
  const supabaseClient = resolveSupabaseClient(client);
  const { data, error } = await supabaseClient
    .from(PROFILES_TABLE)
    .upsert(
      {
        id: userId,
        gaming_goal: normalizedGamingGoal,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      },
    )
    .select(`id, ${GAMING_GOAL_COLUMN}`)
    .single();

  if (error) {
    if (isMissingColumnError(error, GAMING_GOAL_COLUMN)) {
      logProfileInfo(
        'The "profiles.gaming_goal" column is missing. Run the latest Supabase migrations to persist the gaming goal; continuing with local state only.',
        {
          userId,
          gamingGoal: normalizedGamingGoal,
          stage: "persist-gaming-goal",
          ...summarizeSupabaseError(error),
        },
      );
      return null;
    }

    logProfileError("Failed to persist gaming goal to profile", error, {
      userId,
      gamingGoal: normalizedGamingGoal,
      stage: "persist-gaming-goal",
    });
    return null;
  }

  return data;
}
