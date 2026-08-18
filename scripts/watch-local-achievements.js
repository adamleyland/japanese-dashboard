/*
 * Watches structured achievement files beside imported Steam shortcuts and
 * persists unlocks to Supabase. It only reads local files.
 *
 * Usage:
 *   npm run sync:local-achievements            # scan once
 *   npm run watch:local-achievements           # keep watching
 */

const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

loadEnvFile(path.resolve(__dirname, "..", ".env.local"));

const watchMode = process.argv.includes("--watch");
const watchedFiles = new Map();
const pendingSyncs = new Map();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing ${name} in .env.local.`);
  return value;
}

function executablePath(value) {
  const source = String(value || "").trim();
  const quoted = source.match(/^"([^"]+\.exe)"/i);
  if (quoted) return quoted[1];
  const plain = source.match(/^(.+?\.exe)(?:\s|$)/i);
  return (plain?.[1] || source).replace(/^"|"$/g, "");
}

function achievementDefinitionFileForGame(game) {
  const configured = String(game?.metadata?.achievement_definition_file || "").trim();
  if (configured) return configured;
  const exe = executablePath(game?.metadata?.executable_path);
  if (!exe) return "";
  const gameDirectory = path.dirname(exe);
  const dataDirectory = path.join(gameDirectory, `${path.basename(exe, path.extname(exe))}_Data`, "Plugins");
  const candidates = [
    path.join(dataDirectory, "x86_64", "tenoke.ini"),
    path.join(dataDirectory, "x86", "tenoke.ini"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function readSteamAppId(game, gameDirectory) {
  const configured = String(game?.metadata?.achievementProviderGameId || "").trim();
  if (/^\d+$/.test(configured)) return configured;
  const appIdFile = path.join(gameDirectory, "steam_appid.txt");
  if (fs.existsSync(appIdFile)) {
    const appId = fs.readFileSync(appIdFile, "utf8").match(/\b\d+\b/)?.[0];
    if (appId) return appId;
  }
  for (const filename of ["steam_emu.ini", "SteamConfig.ini", "valve.ini"]) {
    const configFile = path.join(gameDirectory, filename);
    if (!fs.existsSync(configFile)) continue;
    const appId = fs.readFileSync(configFile, "utf8").match(/^\s*(?:AppId|SteamAppId)\s*=\s*(\d+)/im)?.[1];
    if (appId) return appId;
  }
  return "";
}

function achievementSourceForGame(game) {
  const configuredProgress = String(game?.metadata?.achievement_progress_file || "").trim();
  const exe = executablePath(game?.metadata?.executable_path);
  if (!exe) return null;
  const gameDirectory = path.dirname(exe);
  const definitionFile = achievementDefinitionFileForGame(game);
  const localDefinition = definitionFile && fs.existsSync(definitionFile)
    ? parseAchievementDefinitions(fs.readFileSync(definitionFile, "utf8"))
    : null;
  const appId = localDefinition?.appId || readSteamAppId(game, gameDirectory);
  const steamDataFile = path.join(gameDirectory, "SteamData", "user_stats.ini");
  const publicDirectory = process.env.PUBLIC || path.join(path.parse(gameDirectory).root, "Users", "Public");
  const runeFile = appId
    ? path.join(publicDirectory, "Documents", "Steam", "RUNE", appId, "achievements.ini")
    : "";
  const candidates = [
    configuredProgress && { progressFile: configuredProgress, format: game?.metadata?.achievement_progress_format || "auto" },
    fs.existsSync(steamDataFile) && { progressFile: steamDataFile, format: "steamdata-user-stats" },
    runeFile && fs.existsSync(runeFile) && { progressFile: runeFile, format: "rune-achievements-ini" },
  ].filter(Boolean);
  if (!candidates.length) return null;
  return { ...candidates[0], definitionFile, appId };
}

function parseIniValues(body) {
  const values = {};
  for (const line of body.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    let value = line.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (key && !key.startsWith("#") && !key.startsWith(";")) values[key] = value;
  }
  return values;
}

function parseAchievementDefinitions(contents) {
  const sections = new Map();
  let currentSection = "";
  for (const line of contents.split(/\r?\n/)) {
    const heading = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (heading) {
      currentSection = heading[1];
      if (!sections.has(currentSection)) sections.set(currentSection, {});
      continue;
    }
    if (!currentSection) continue;
    Object.assign(sections.get(currentSection), parseIniValues(line));
  }

  const appId = sections.get("TENOKE")?.id?.match(/^\d+/)?.[0] || "";
  const achievements = [];
  for (const [section, values] of sections) {
    const sectionMatch = section.match(/^ACHIEVEMENTS\.([^\.]+)$/);
    if (!sectionMatch) continue;
    const id = sectionMatch[1];
    const name = sections.get(`ACHIEVEMENTS.${id}.name`)?.english || id;
    const description = sections.get(`ACHIEVEMENTS.${id}.desc`)?.english || "";
    const imageRoot = appId
      ? `https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/${appId}`
      : "";
    achievements.push({
      id,
      name,
      description,
      iconUrl: imageRoot && values.icon ? `${imageRoot}/${values.icon}` : null,
      iconLockedUrl: imageRoot && values.icon_gray ? `${imageRoot}/${values.icon_gray}` : null,
      hidden: values.hidden === "1",
    });
  }
  return { appId, achievements };
}

function parseUserStats(contents) {
  const unlocks = [];
  const rowPattern = /"([^"]+)"\s*=\s*\{([^}]*)\}/g;
  let match;
  while ((match = rowPattern.exec(contents))) {
    const body = match[2];
    if (!/\bunlocked\s*=\s*true\b/i.test(body)) continue;
    const timestamp = Number(body.match(/\btime\s*=\s*(\d+)/i)?.[1]);
    unlocks.push({
      id: match[1],
      unlockedAt: Number.isFinite(timestamp) && timestamp > 0
        ? new Date(timestamp * 1000).toISOString()
        : new Date().toISOString(),
    });
  }
  return unlocks;
}

function parseRuneAchievements(contents) {
  const sections = new Map();
  let currentSection = "";
  for (const line of contents.split(/\r?\n/)) {
    const heading = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (heading) {
      currentSection = heading[1];
      if (!sections.has(currentSection)) sections.set(currentSection, {});
      continue;
    }
    if (currentSection) Object.assign(sections.get(currentSection), parseIniValues(line));
  }
  const index = sections.get("SteamAchievements") || {};
  const ids = Object.entries(index)
    .filter(([key]) => /^\d+$/.test(key))
    .map(([, value]) => value);
  return ids.flatMap((id) => {
    const state = sections.get(id) || {};
    if (state.achieved !== "1" && !/^true$/i.test(state.achieved || "")) return [];
    const timestamp = Number(state.unlocktime);
    return [{
      id,
      unlockedAt: Number.isFinite(timestamp) && timestamp > 0
        ? new Date(timestamp * 1000).toISOString()
        : new Date().toISOString(),
    }];
  });
}

function parseProgress(contents, format) {
  if (format === "rune-achievements-ini") return parseRuneAchievements(contents);
  const steamData = parseUserStats(contents);
  return steamData.length || format !== "auto" ? steamData : parseRuneAchievements(contents);
}

function steamIcon(appId, value) {
  const source = String(value || "").trim();
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) return source;
  const filename = /\.[a-z0-9]+$/i.test(source) ? source : `${source}.jpg`;
  return `https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/${appId}/${filename}`;
}

async function fetchSteamDefinitions(appId) {
  const key = requiredEnv("STEAM_API_KEY");
  const query = new URLSearchParams({ key, appid: appId, l: "english" });
  const response = await fetch(`https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?${query}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Steam achievement definitions returned ${response.status}.`);
  const definitions = payload?.game?.availableGameStats?.achievements || [];
  return {
    appId,
    achievements: definitions.map((definition) => ({
      id: definition.name,
      name: definition.displayName || definition.name,
      description: definition.description || "",
      iconUrl: steamIcon(appId, definition.icon),
      iconLockedUrl: steamIcon(appId, definition.icongray),
      hidden: definition.hidden === 1,
    })),
  };
}

async function ensureAchievementDefinitions(admin, userId, game, source) {
  let definition = source.definitionFile && fs.existsSync(source.definitionFile)
    ? parseAchievementDefinitions(fs.readFileSync(source.definitionFile, "utf8"))
    : null;
  if (!definition?.achievements.length && source.appId) definition = await fetchSteamDefinitions(source.appId);
  if (!definition?.achievements.length) return null;

  const now = new Date().toISOString();
  const { data: achievementGame, error: gameError } = await admin.from("achievement_games").upsert({
    user_id: userId,
    provider: "local",
    provider_game_id: game.client_game_id,
    game_name: game.game_name,
    platform: "local",
    cover_artwork_url: game.cover_image_url || null,
    source_game_key: game.client_game_id,
    definition_provider: definition.appId ? "steam" : "local-file",
    definition_game_id: definition.appId || game.client_game_id,
    tracking_mode: "local-companion",
    last_sync_error: null,
    updated_at: now,
  }, { onConflict: "user_id,provider,provider_game_id" }).select("id").single();
  if (gameError) throw gameError;

  const rows = definition.achievements.map((achievement) => ({
    achievement_game_id: achievementGame.id,
    provider_achievement_id: achievement.id,
    name: achievement.name,
    description: achievement.description,
    icon_url: achievement.iconUrl,
    icon_locked_url: achievement.iconLockedUrl,
    progress_target: 1,
    metadata: { hidden: achievement.hidden, definitionSource: source.definitionFile ? "local-steam-metadata" : "steam-api" },
    updated_at: now,
  }));
  const { error: definitionsError } = await admin.from("achievements")
    .upsert(rows, { onConflict: "achievement_game_id,provider_achievement_id" });
  if (definitionsError) throw definitionsError;
  if (definition.appId) {
    const { error: metadataError } = await admin.from("local_games").update({
      metadata: {
        ...(game.metadata || {}),
        achievementProvider: "steam",
        achievementProviderGameId: definition.appId,
        achievement_progress_file: source.progressFile,
        achievement_progress_format: source.format,
      },
    }).eq("user_id", userId).eq("client_game_id", game.client_game_id);
    if (metadataError) throw metadataError;
  }
  return { id: achievementGame.id, count: rows.length, appId: definition.appId };
}

async function syncGame(admin, userId, game, source) {
  const unlocks = parseProgress(fs.readFileSync(source.progressFile, "utf8"), source.format);
  const imported = await ensureAchievementDefinitions(admin, userId, game, source);

  const { data: achievementGame, error: gameError } = await admin.from("achievement_games")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "local")
    .eq("provider_game_id", game.client_game_id)
    .maybeSingle();
  if (gameError) throw gameError;
  if (!achievementGame) {
    console.warn(`${game.game_name}: no local achievement definitions were found; open its expanded dashboard view to try Steam definitions.`);
    return { updated: 0, newlyUnlocked: 0 };
  }

  const unlockById = new Map(unlocks.map((item) => [item.id.toLowerCase(), item]));
  const { data: achievements, error: achievementsError } = await admin.from("achievements")
    .select("id, provider_achievement_id, unlocked, unlocked_at, progress_target")
    .eq("achievement_game_id", achievementGame.id);
  if (achievementsError) throw achievementsError;

  const now = new Date().toISOString();
  const events = [];
  for (const achievement of achievements || []) {
    const unlock = unlockById.get(achievement.provider_achievement_id.toLowerCase());
    if (!unlock) continue;
    const { error } = await admin.from("achievements").update({
      unlocked: true,
      unlocked_at: achievement.unlocked_at || unlock.unlockedAt,
      progress_current: achievement.progress_target || 1,
      updated_at: now,
    }).eq("id", achievement.id);
    if (error) throw error;
    if (!achievement.unlocked) {
      events.push({
        achievement_id: achievement.id,
        user_id: userId,
        source: source.format,
        unlocked_at: unlock.unlockedAt,
        metadata: { format: source.format },
      });
    }
  }

  if (events.length) {
    const { error } = await admin.from("achievement_unlock_events")
      .upsert(events, { onConflict: "achievement_id,unlocked_at" });
    if (error) throw error;
  }
  await admin.from("achievement_games").update({
    tracking_mode: "local-companion",
    last_synced_at: now,
    last_sync_error: null,
    updated_at: now,
  }).eq("id", achievementGame.id);

  console.log(`${game.game_name}: ${imported?.count || achievements?.length || 0} definitions, ${unlocks.length} unlock(s) found, ${events.length} newly recorded.`);
  return { updated: unlocks.length, newlyUnlocked: events.length };
}

function scheduleSync(admin, userId, game, source) {
  clearTimeout(pendingSyncs.get(source.progressFile));
  pendingSyncs.set(source.progressFile, setTimeout(() => {
    pendingSyncs.delete(source.progressFile);
    syncGame(admin, userId, game, source).catch((error) => {
      console.error(`${game.game_name}: achievement sync failed: ${error.message}`);
    });
  }, 500));
}

async function discoverGames(admin, userId) {
  const { data: games, error } = await admin.from("local_games")
    .select("client_game_id, game_name, cover_image_url, metadata")
    .eq("user_id", userId);
  if (error) throw error;
  return (games || []).map((game) => ({ game, source: achievementSourceForGame(game) }))
    .filter((item) => item.source?.progressFile && fs.existsSync(item.source.progressFile));
}

async function reconcileWatchers(admin, userId) {
  const games = await discoverGames(admin, userId);
  for (const { game, source } of games) {
    if (watchedFiles.has(source.progressFile)) continue;
    fs.watchFile(source.progressFile, { interval: 1500 }, (current, previous) => {
      if (current.mtimeMs !== previous.mtimeMs || current.size !== previous.size) {
        scheduleSync(admin, userId, game, source);
      }
    });
    watchedFiles.set(source.progressFile, game.client_game_id);
    console.log(`Watching ${game.game_name}: ${source.progressFile}`);
  }
  return games;
}

async function main() {
  const userId = requiredEnv("LOCAL_GAMES_USER_ID");
  const admin = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const games = await discoverGames(admin, userId);
  if (!games.length) {
    console.log("No supported local achievement files were found.");
  }
  for (const { game, source } of games) {
    await syncGame(admin, userId, game, source);
  }
  if (!watchMode) return;

  await reconcileWatchers(admin, userId);
  setInterval(() => {
    reconcileWatchers(admin, userId).catch((error) => console.error(`Watcher discovery failed: ${error.message}`));
  }, 60_000);
  console.log("Local achievement watcher is running. Press Ctrl+C to stop.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Local achievement watcher failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { parseAchievementDefinitions, parseRuneAchievements, parseUserStats };
