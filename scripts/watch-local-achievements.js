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
const { DatabaseSync } = require("node:sqlite");
const { createClient } = require("@supabase/supabase-js");

loadEnvFile(path.resolve(__dirname, "..", ".env.local"));

const watchMode = process.argv.includes("--watch");
const watchedFiles = new Map();
const pendingSyncs = new Map();
const steamAppIdsByTitle = new Map();
const localConfigurationFilesByExecutable = new Map();
const OVERLAY_EVENT_PREFIX = "ACHIEVEMENT_OVERLAY_EVENT:";
const GOG_GALAXY_STORAGE_DB = path.join(process.env.ProgramData || "C:\\ProgramData", "GOG.com", "Galaxy", "storage", "galaxy-2.0.db");
const GOG_GALAXY_APPLICATIONS_ROOT = path.join(process.env.LOCALAPPDATA || "", "GOG.com", "Galaxy", "Applications");
const UPLAY_SAVE_IDS_BY_TITLE = new Map([
  [normalizedGameTitle("Assassin's Creed Black Flag Resynced"), "66088"],
]);
let liveNotificationsEnabled = false;

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

function installationRootForGame(game) {
  const exe = executablePath(game?.metadata?.executable_path);
  if (!exe) return "";
  const gamesRoot = path.resolve(process.env.LOCAL_GAMES_ROOT || path.join(process.env.USERPROFILE || "", "Games"));
  const relative = path.relative(gamesRoot, exe);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return path.dirname(exe);
  const segments = relative.split(path.sep).filter(Boolean);
  const rootSegments = segments[0]?.toLowerCase() === "c" && segments.length > 2 ? segments.slice(0, 2) : segments.slice(0, 1);
  return path.join(gamesRoot, ...rootSegments);
}

function localConfigurationFilesForGame(game) {
  const exe = executablePath(game?.metadata?.executable_path);
  if (!exe) return [];
  if (localConfigurationFilesByExecutable.has(exe)) return localConfigurationFilesByExecutable.get(exe);
  const root = installationRootForGame(game);
  const matches = [];
  const queue = root ? [{ directory: root, depth: 0 }] : [];
  const interestingFile = /^(?:steam_appid\.txt|steam_emu\.ini|steamconfig\.ini|valve\.ini|tenoke\.ini|upc_r2\.ini|universelan\.ini)$/i;
  const skippedDirectory = /^(?:content|paks?|movies?|audio|sound|textures?|_commonredist|d3d12|dlc|redist|localization)$/i;
  while (queue.length) {
    const { directory, depth } = queue.shift();
    let entries = [];
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isFile() && interestingFile.test(entry.name)) matches.push(fullPath);
      if (entry.isDirectory() && depth < 9 && !skippedDirectory.test(entry.name)) queue.push({ directory: fullPath, depth: depth + 1 });
    }
  }
  localConfigurationFilesByExecutable.set(exe, matches);
  return matches;
}

function localAchievementProviderHint(game) {
  const files = localConfigurationFilesForGame(game);
  if (files.some((file) => /[\\/]tenoke\.ini$/i.test(file))) return "tenoke";
  if (files.some((file) => /[\\/]upc_r2\.ini$/i.test(file))) return "uplay";
  for (const file of files.filter((candidate) => /[\\/]steam_emu\.ini$/i.test(candidate))) {
    try {
      if (/\bRUNE\b|Documents[\\/]Steam[\\/]RUNE/i.test(fs.readFileSync(file, "utf8"))) return "rune";
    } catch {}
  }
  if (files.some((file) => /[\\/]steam_settings[\\/]/i.test(file))) return "gse";
  const exe = executablePath(game?.metadata?.executable_path);
  if (exe) {
    const executableName = path.basename(exe, path.extname(exe));
    const unitySteamApi = path.join(path.dirname(exe), `${executableName}_Data`, "Plugins", "x86_64", "steam_api64.dll");
    try {
      const signature = fs.readFileSync(unitySteamApi).toString("latin1");
      if (signature.includes("achievements.json") && signature.includes("steam_settings")) return "goldberg";
    } catch {}
  }
  return "";
}

function achievementDefinitionFileForGame(game) {
  const configured = String(game?.metadata?.achievement_definition_file || "").trim();
  if (configured) return configured;
  const discovered = localConfigurationFilesForGame(game).find((candidate) => /[\\/]tenoke\.ini$/i.test(candidate));
  if (discovered) return discovered;
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
  const appIdFiles = [
    path.join(gameDirectory, "steam_appid.txt"),
    path.join(gameDirectory, "steam_settings", "steam_appid.txt"),
  ];
  for (const appIdFile of appIdFiles) {
    if (fs.existsSync(appIdFile)) {
      const appId = fs.readFileSync(appIdFile, "utf8").match(/\b\d+\b/)?.[0];
      if (appId) return appId;
    }
  }
  for (const filename of ["steam_emu.ini", "SteamConfig.ini", "valve.ini"]) {
    const configFile = path.join(gameDirectory, filename);
    if (!fs.existsSync(configFile)) continue;
    const appId = fs.readFileSync(configFile, "utf8").match(/^\s*(?:AppId|SteamAppId)\s*=\s*(\d+)/im)?.[1];
    if (appId) return appId;
  }
  for (const configFile of localConfigurationFilesForGame(game)) {
    let contents = "";
    try { contents = fs.readFileSync(configFile, "utf8"); } catch { continue; }
    const appId = /steam_appid\.txt$/i.test(configFile)
      ? contents.match(/\b\d{3,10}\b/)?.[0]
      : contents.match(/^\s*(?:AppId|SteamAppId|id)\s*=\s*(\d{3,10})/im)?.[1];
    if (appId) return appId;
  }
  return "";
}

function achievementSourceForGame(game, fallbackAppId = "") {
  const configuredProgress = String(game?.metadata?.achievement_progress_file || "").trim();
  const exe = executablePath(game?.metadata?.executable_path);
  if (!exe || !fs.existsSync(exe)) return null;
  const gogSource = gogGameplaySourceForGame(game);
  if (gogSource) return gogSource;
  const gameDirectory = path.dirname(exe);
  const definitionFile = achievementDefinitionFileForGame(game);
  const localDefinition = definitionFile && fs.existsSync(definitionFile)
    ? parseAchievementDefinitions(fs.readFileSync(definitionFile, "utf8"))
    : null;
  const appId = localDefinition?.appId || readSteamAppId(game, gameDirectory) || String(fallbackAppId || "");
  const providerHint = localAchievementProviderHint(game);
  const steamDataFile = path.join(gameDirectory, "SteamData", "user_stats.ini");
  const publicDirectory = process.env.PUBLIC || path.join(path.parse(gameDirectory).root, "Users", "Public");
  const runeFile = appId
    ? path.join(publicDirectory, "Documents", "Steam", "RUNE", appId, "achievements.ini")
    : "";
  const gseDirectory = appId && process.env.APPDATA
    ? path.join(process.env.APPDATA, "GSE Saves", appId)
    : "";
  const gseFile = gseDirectory ? path.join(gseDirectory, "achievements.json") : "";
  const goldbergDirectory = appId && process.env.APPDATA
    ? path.join(process.env.APPDATA, "Goldberg SteamEmu Saves", appId)
    : "";
  const goldbergFile = goldbergDirectory ? path.join(goldbergDirectory, "achievements.json") : "";
  const uplaySaveId = UPLAY_SAVE_IDS_BY_TITLE.get(normalizedGameTitle(game?.game_name)) || "";
  const uplayFile = uplaySaveId && process.env.APPDATA
    ? path.join(process.env.APPDATA, "Goldberg UplayEmu Saves", uplaySaveId, "achievements.json")
    : "";
  const universeLanFile = universeLanAchievementFileForGame(game);
  const candidates = [
    universeLanFile && { progressFile: universeLanFile, format: "universelan-achievements-ini" },
    configuredProgress && { progressFile: configuredProgress, format: game?.metadata?.achievement_progress_format || "auto" },
    fs.existsSync(steamDataFile) && { progressFile: steamDataFile, format: "steamdata-user-stats" },
    runeFile && (fs.existsSync(runeFile) || providerHint === "rune") && { progressFile: runeFile, format: "rune-achievements-ini" },
    gseFile && (fs.existsSync(gseFile) || fs.existsSync(gseDirectory) || providerHint === "gse") && { progressFile: gseFile, format: "gse-achievements-json" },
    goldbergFile && (fs.existsSync(goldbergFile) || fs.existsSync(goldbergDirectory) || providerHint === "goldberg") && { progressFile: goldbergFile, format: "goldberg-achievements-json" },
    uplayFile && providerHint === "uplay" && { progressFile: uplayFile, format: "uplay-achievements-json" },
  ].filter(Boolean);
  if (!candidates.length) return null;
  return { ...candidates[0], definitionFile, appId };
}

function universeLanAchievementFileForGame(game) {
  for (const configFile of localConfigurationFilesForGame(game).filter((candidate) => /[\\/]universelan\.ini$/i.test(candidate))) {
    let contents = "";
    try { contents = fs.readFileSync(configFile, "utf8"); } catch { continue; }
    const configuredRoot = contents.match(/^\s*GameDataPath\s*=\s*(.+?)\s*$/im)?.[1]?.trim().replace(/^"|"$/g, "") || "UniverseLANData";
    const dataRoot = path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.resolve(path.dirname(configFile), configuredRoot);
    const achievementsFile = path.join(dataRoot, "Achievements.ini");
    if (fs.existsSync(achievementsFile) || fs.existsSync(dataRoot)) return achievementsFile;
  }
  return "";
}

function normalizedGameTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/\b(game of the year|goty|complete|definitive|deluxe|ultimate) edition\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function openReadOnlyDatabase(filePath) {
  return new DatabaseSync(filePath, { readOnly: true });
}

function gogGameplaySourceForGame(game) {
  if (!fs.existsSync(GOG_GALAXY_STORAGE_DB) || !fs.existsSync(GOG_GALAXY_APPLICATIONS_ROOT)) return null;
  let database;
  try {
    database = openReadOnlyDatabase(GOG_GALAXY_STORAGE_DB);
    const productStatement = database.prepare(`
      SELECT pa.productId, pa.clientId, ibp.installationPath, ld.title
      FROM ProductAuthorizations pa
      LEFT JOIN InstalledBaseProducts ibp ON ibp.productId = pa.productId
      LEFT JOIN LimitedDetails ld ON ld.productId = pa.productId
    `);
    productStatement.setReadBigInts(true);
    const products = productStatement.all();
    const wantedTitle = normalizedGameTitle(game?.game_name);
    const executable = executablePath(game?.metadata?.executable_path).toLowerCase();
    const product = products.find((row) => {
      const installPath = String(row?.installationPath || "").toLowerCase();
      return (installPath && executable.startsWith(installPath)) || normalizedGameTitle(row?.title) === wantedTitle;
    });
    if (!product?.clientId) return null;
    const gameplayRoot = path.join(GOG_GALAXY_APPLICATIONS_ROOT, String(product.clientId), "Gameplay");
    let users = [];
    try { users = fs.readdirSync(gameplayRoot, { withFileTypes: true }); } catch { return null; }
    for (const user of users) {
      if (!user.isDirectory()) continue;
      const progressFile = path.join(gameplayRoot, user.name, "gameplay.db");
      if (fs.existsSync(progressFile)) {
        return {
          progressFile,
          format: "gog-galaxy-sqlite",
          definitionFile: "",
          appId: "",
          gogProductId: String(product.productId || ""),
        };
      }
    }
  } catch {
    return null;
  } finally {
    try { database?.close(); } catch {}
  }
  return null;
}

async function findSteamAppIdByTitle(title) {
  const cacheKey = normalizedGameTitle(title);
  if (!cacheKey) return "";
  if (steamAppIdsByTitle.has(cacheKey)) return steamAppIdsByTitle.get(cacheKey);
  try {
    const query = new URLSearchParams({ term: title, l: "english", cc: "GB" });
    const response = await fetch(`https://store.steampowered.com/api/storesearch/?${query}`);
    const payload = await response.json().catch(() => ({}));
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const exact = items.find((item) => normalizedGameTitle(item?.name) === cacheKey);
    const appId = String((exact || items[0])?.id || "");
    steamAppIdsByTitle.set(cacheKey, appId);
    return appId;
  } catch (error) {
    console.warn(`${title}: Steam App ID discovery failed: ${error.message}`);
    steamAppIdsByTitle.set(cacheKey, "");
    return "";
  }
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

function parseUniverseLanAchievements(contents) {
  const unlocks = [];
  let currentId = "";
  let state = {};
  const flush = () => {
    if (!currentId || !/^(?:1|true|yes)$/i.test(String(state.unlocked || ""))) return;
    const timestamp = Number(state.unlocktime);
    unlocks.push({
      id: currentId,
      unlockedAt: Number.isFinite(timestamp) && timestamp > 0
        ? new Date(timestamp * 1000).toISOString()
        : new Date().toISOString(),
    });
  };
  for (const line of contents.split(/\r?\n/)) {
    const heading = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (heading) {
      flush();
      currentId = heading[1];
      state = {};
      continue;
    }
    if (currentId) Object.assign(state, parseIniValues(line));
  }
  flush();
  return unlocks;
}

function parseGseAchievements(contents) {
  const values = JSON.parse(contents);
  const entries = Array.isArray(values)
    ? values.map((state) => [state?.id || state?.name || state?.AchievementId || state?.achievementId, state])
    : Object.entries(values || {});
  return entries.flatMap(([id, state]) => {
    if (!id || !state || typeof state !== "object") return [];
    const timestampValue = state.earned_time ?? state.earnedTime ?? state.unlock_time ?? state.UnlockTime ?? state.unlockTime ?? state.timestamp ?? state.time;
    const numericTimestamp = Number(timestampValue);
    const parsedTimestamp = typeof timestampValue === "string" && !/^\d+(?:\.\d+)?$/.test(timestampValue)
      ? Date.parse(timestampValue)
      : Number.isFinite(numericTimestamp) && numericTimestamp > 0
        ? numericTimestamp * (numericTimestamp > 10_000_000_000 ? 1 : 1000)
        : 0;
    const earnedValue = state.earned ?? state.achieved ?? state.Achieved ?? state.unlocked ?? state.Unlocked;
    const earned = earnedValue === true || earnedValue === 1 || /^(?:1|true|yes)$/i.test(String(earnedValue || "")) || parsedTimestamp > 0;
    if (!earned) return [];
    return [{
      id: String(id),
      unlockedAt: Number.isFinite(parsedTimestamp) && parsedTimestamp > 0
        ? new Date(parsedTimestamp).toISOString()
        : new Date().toISOString(),
    }];
  });
}

function parsePortableAchievementDefinitions(contents) {
  const values = JSON.parse(contents);
  const entries = Array.isArray(values)
    ? values.map((state) => [state?.id || state?.name || state?.AchievementId || state?.achievementId, state])
    : Object.entries(values || {});
  return entries.flatMap(([id, state]) => {
    if (!id || !state || typeof state !== "object") return [];
    const name = state.displayName || state.DisplayName || state.title || state.Title || state.name || state.Name || id;
    return [{
      id: String(id),
      name: typeof name === "object" ? String(name.english || name.en || id) : String(name),
      description: String(state.description || state.Description || ""),
      iconUrl: state.icon_url || state.iconUrl || state.icon || null,
      iconLockedUrl: state.icon_gray || state.icon_locked_url || state.iconLockedUrl || null,
      hidden: state.hidden === true || state.Hidden === true,
    }];
  });
}

function readGogGameplayAchievements(filePath) {
  const database = openReadOnlyDatabase(filePath);
  try {
    const rows = database.prepare(`
      SELECT key, name, description, visible_while_locked, unlock_time,
             image_url_locked, image_url_unlocked, rarity
      FROM achievement
      ORDER BY id ASC
    `).all();
    return rows.map((row) => ({
      id: String(row.key || ""),
      name: String(row.name || row.key || ""),
      description: String(row.description || ""),
      hidden: Number(row.visible_while_locked) !== 1,
      iconUrl: String(row.image_url_unlocked || "") || null,
      iconLockedUrl: String(row.image_url_locked || row.image_url_unlocked || "") || null,
      rarityPercentage: Number.isFinite(Number(row.rarity)) ? Number(row.rarity) : null,
      unlockedAt: row.unlock_time && Number.isFinite(Date.parse(row.unlock_time))
        ? new Date(row.unlock_time).toISOString()
        : null,
    })).filter((achievement) => achievement.id);
  } finally {
    database.close();
  }
}

function parseProgress(contents, format) {
  if (format === "rune-achievements-ini") return parseRuneAchievements(contents);
  if (format === "universelan-achievements-ini") return parseUniverseLanAchievements(contents);
  if (["gse-achievements-json", "goldberg-achievements-json", "uplay-achievements-json"].includes(format)) return parseGseAchievements(contents);
  const steamData = parseUserStats(contents);
  return steamData.length || format !== "auto" ? steamData : parseRuneAchievements(contents);
}

function parseProgressFile(source) {
  if (source.format === "gog-galaxy-sqlite") {
    return readGogGameplayAchievements(source.progressFile)
      .filter((achievement) => achievement.unlockedAt)
      .map((achievement) => ({ id: achievement.id, unlockedAt: achievement.unlockedAt }));
  }
  return parseProgress(fs.readFileSync(source.progressFile, "utf8"), source.format);
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
  if (source.format === "gog-galaxy-sqlite" && fs.existsSync(source.progressFile)) {
    definition = {
      appId: "",
      provider: "gog-galaxy",
      achievements: readGogGameplayAchievements(source.progressFile),
    };
  }
  if (source.format === "uplay-achievements-json" && fs.existsSync(source.progressFile)) {
    const localAchievements = parsePortableAchievementDefinitions(fs.readFileSync(source.progressFile, "utf8"));
    if (localAchievements.length) {
      definition = { appId: source.appId, provider: "uplay", achievements: localAchievements };
    }
  }
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
    definition_provider: definition.provider || (definition.appId ? "steam" : "local-file"),
    definition_game_id: source.gogProductId || definition.appId || game.client_game_id,
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
    rarity_percentage: achievement.rarityPercentage,
    progress_target: 1,
    metadata: {
      hidden: achievement.hidden,
      definitionSource: definition.provider || (source.definitionFile ? "local-steam-metadata" : "steam-api"),
    },
    updated_at: now,
  }));
  const { error: definitionsError } = await admin.from("achievements")
    .upsert(rows, { onConflict: "achievement_game_id,provider_achievement_id" });
  if (definitionsError) throw definitionsError;
  if (definition.appId) {
    const { error: metadataError } = await admin.from("local_games").update({
      metadata: {
        ...(game.metadata || {}),
        achievementProvider: definition.provider || "steam",
        achievementProviderGameId: definition.appId,
        achievement_progress_file: source.progressFile,
        achievement_progress_format: source.format,
      },
    }).eq("user_id", userId).eq("client_game_id", game.client_game_id);
    if (metadataError) throw metadataError;
  }
  if (source.format === "gog-galaxy-sqlite") {
    const { error: metadataError } = await admin.from("local_games").update({
      metadata: {
        ...(game.metadata || {}),
        achievementProvider: "gog-galaxy",
        achievementProviderGameId: source.gogProductId,
        achievement_progress_file: source.progressFile,
        achievement_progress_format: source.format,
      },
    }).eq("user_id", userId).eq("client_game_id", game.client_game_id);
    if (metadataError) throw metadataError;
  }
  return { id: achievementGame.id, count: rows.length, appId: definition.appId };
}

async function syncGame(admin, userId, game, source) {
  const imported = await ensureAchievementDefinitions(admin, userId, game, source);
  if (!fs.existsSync(source.progressFile)) {
    console.log(`${game.game_name}: ${imported?.count || 0} definitions ready; waiting for ${source.format} progress.`);
    return { updated: 0, newlyUnlocked: 0 };
  }
  const unlocks = parseProgressFile(source);

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
    .select("id, provider_achievement_id, name, description, icon_url, rarity_percentage, unlocked, unlocked_at, progress_target")
    .eq("achievement_game_id", achievementGame.id);
  if (achievementsError) throw achievementsError;

  const now = new Date().toISOString();
  const events = [];
  const notifications = [];
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
      notifications.push({
        gameTitle: game.game_name,
        gameArtworkUrl: game.cover_image_url || null,
        achievementName: achievement.name,
        description: achievement.description || "Achievement unlocked",
        iconUrl: achievement.icon_url || null,
        rarityPercentage: achievement.rarity_percentage,
        unlockedAt: unlock.unlockedAt,
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
  if (liveNotificationsEnabled) {
    for (const notification of notifications) {
      process.stdout.write(`${OVERLAY_EVENT_PREFIX}${JSON.stringify(notification)}\n`);
    }
  }
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
  const discoveries = [];
  for (const game of games || []) {
    let source = achievementSourceForGame(game);
    if (!source) {
      const appId = await findSteamAppIdByTitle(game.game_name);
      source = achievementSourceForGame(game, appId);
    }
    if (source?.progressFile) discoveries.push({ game, source });
  }
  return discoveries;
}

async function reconcileWatchers(admin, userId, syncNewSources = true) {
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
    if (liveNotificationsEnabled && syncNewSources) await syncGame(admin, userId, game, source);
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

  liveNotificationsEnabled = true;
  await reconcileWatchers(admin, userId, false);
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

module.exports = {
  achievementSourceForGame,
  parseAchievementDefinitions,
  parseGseAchievements,
  parseUniverseLanAchievements,
  parseRuneAchievements,
  parseUserStats,
  readGogGameplayAchievements,
};
