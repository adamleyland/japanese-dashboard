/*
 * Imports Windows Steam non-Steam shortcuts and their locally recorded playtime.
 *
 * Usage:
 *   npm run sync:steam-local              # preview only
 *   npm run sync:steam-local -- --write   # write to Supabase
 */

const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

// Resolve from the project rather than the terminal's current folder so this also works in Task Scheduler.
loadEnvFile(path.resolve(__dirname, "..", ".env.local"));

const watchChanges = process.argv.includes("--watch");
const writeChanges = process.argv.includes("--write") || watchChanges;

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

function getSteamRoot() {
  const configuredRoot = String(process.env.STEAM_ROOT || "").trim();
  const candidates = [
    configuredRoot,
    "C:\\Program Files (x86)\\Steam",
    "C:\\Program Files\\Steam",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, "userdata"))) || "";
}

function getSteamUserDataDirectory(steamRoot) {
  const userDataRoot = path.join(steamRoot, "userdata");
  const configuredId = String(process.env.STEAM_USER_DATA_ID || "").trim();
  const ids = configuredId
    ? [configuredId]
    : fs.readdirSync(userDataRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
      .map((entry) => entry.name);

  const matchingId = ids.find((id) => fs.existsSync(path.join(userDataRoot, id, "config", "shortcuts.vdf")));
  if (!matchingId) throw new Error("Could not find Steam shortcuts.vdf. Add a non-Steam shortcut in Steam first.");
  return path.join(userDataRoot, matchingId);
}

function readCString(buffer, offset) {
  const end = buffer.indexOf(0, offset);
  if (end === -1) throw new Error("Invalid Steam shortcuts.vdf: missing string terminator.");
  return { value: buffer.toString("utf8", offset, end), offset: end + 1 };
}

function parseBinaryVdfObject(buffer, initialOffset = 0) {
  const result = {};
  let offset = initialOffset;

  while (offset < buffer.length) {
    const type = buffer[offset++];
    if (type === 0x08) return { value: result, offset };

    const keyResult = readCString(buffer, offset);
    const key = keyResult.value;
    offset = keyResult.offset;

    if (type === 0x00) {
      const child = parseBinaryVdfObject(buffer, offset);
      result[key] = child.value;
      offset = child.offset;
    } else if (type === 0x01) {
      const stringResult = readCString(buffer, offset);
      result[key] = stringResult.value;
      offset = stringResult.offset;
    } else if (type === 0x02) {
      if (offset + 4 > buffer.length) throw new Error("Invalid Steam shortcuts.vdf: truncated integer.");
      result[key] = buffer.readInt32LE(offset);
      offset += 4;
    } else {
      throw new Error(`Unsupported Steam shortcuts.vdf value type ${type} for ${key}.`);
    }
  }

  throw new Error("Invalid Steam shortcuts.vdf: missing object terminator.");
}

function parseBinaryVdf(buffer) {
  const root = parseBinaryVdfObject(buffer).value;
  return root.shortcuts || {};
}

function tokenizeKeyValues(text) {
  const tokens = [];
  const matcher = /"((?:\\.|[^"\\])*)"|([{}])/g;
  let match;
  while ((match = matcher.exec(text))) {
    tokens.push(match[2] || match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  }
  return tokens;
}

function parseKeyValuesObject(tokens, index = 0) {
  const result = {};
  let cursor = index;
  while (cursor < tokens.length && tokens[cursor] !== "}") {
    const key = tokens[cursor++];
    const next = tokens[cursor++];
    if (next === "{") {
      const child = parseKeyValuesObject(tokens, cursor);
      result[key] = child.value;
      cursor = child.index;
    } else {
      result[key] = next;
    }
  }
  return { value: result, index: cursor + 1 };
}

function parseTextVdf(text) {
  const tokens = tokenizeKeyValues(text);
  const rootName = tokens.shift();
  if (!rootName || tokens.shift() !== "{") throw new Error("Invalid Steam localconfig.vdf.");
  return parseKeyValuesObject(tokens).value;
}

function getLocalPlaytimeMinutes(localConfig, signedAppId) {
  const apps = localConfig?.Software?.Valve?.Steam?.apps || {};
  const record = apps[String(signedAppId)] || {};
  return Math.max(0, Number(record.Playtime || 0));
}

function toUnsignedAppId(value) {
  return Number(value) >>> 0;
}

function toIsoFromSteamTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp * 1000).toISOString()
    : null;
}

function normalizeTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchSteamGridJson(endpoint, apiKey) {
  const response = await fetch(`https://www.steamgriddb.com/api/v2${endpoint}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || `SteamGridDB request failed (${response.status}).`);
  }
  return payload?.data || [];
}

async function findSteamGridArtwork(title, apiKey) {
  if (!apiKey) return null;

  try {
    const matches = await fetchSteamGridJson(
      `/search/autocomplete/${encodeURIComponent(title)}`,
      apiKey,
    );
    if (!matches.length) return null;

    const normalizedTitle = normalizeTitle(title);
    const game = matches.find((match) => normalizeTitle(match?.name) === normalizedTitle) || matches[0];
    if (!game?.id) return null;

    const [grids, heroes] = await Promise.all([
      fetchSteamGridJson(`/grids/game/${game.id}?dimensions=600x900`, apiKey),
      fetchSteamGridJson(`/heroes/game/${game.id}`, apiKey),
    ]);
    const portraitGrids = grids.filter((grid) => Number(grid?.height) > Number(grid?.width));
    const cover = portraitGrids[0] || grids[0];
    const hero = heroes.find((item) => Number(item?.width) > Number(item?.height)) || heroes[0];
    return (cover?.url || hero?.url)
      ? {
          coverUrl: cover?.url || null,
          heroUrl: hero?.url || null,
          gameId: game.id,
          gameName: game.name || title,
          gridId: cover?.id || null,
          heroId: hero?.id || null,
        }
      : null;
  } catch (error) {
    console.warn(`Artwork lookup skipped for ${title}: ${error.message}`);
    return null;
  }
}

function getSteamDataFiles() {
  const steamRoot = getSteamRoot();
  if (!steamRoot) throw new Error("Steam was not found. Set STEAM_ROOT in .env.local if it is installed elsewhere.");

  const userDataDirectory = getSteamUserDataDirectory(steamRoot);
  return {
    shortcutsPath: path.join(userDataDirectory, "config", "shortcuts.vdf"),
    localConfigPath: path.join(userDataDirectory, "config", "localconfig.vdf"),
  };
}

function readSteamShortcuts(files = getSteamDataFiles()) {
  const shortcuts = parseBinaryVdf(fs.readFileSync(files.shortcutsPath));
  const localConfig = parseTextVdf(fs.readFileSync(files.localConfigPath, "utf8"));

  return Object.values(shortcuts)
    .filter((shortcut) => shortcut && typeof shortcut === "object")
    .map((shortcut) => {
      const signedAppId = Number(shortcut.appid);
      const appId = toUnsignedAppId(signedAppId);
      const minutes = getLocalPlaytimeMinutes(localConfig, signedAppId);
      return {
        client_game_id: `steam-shortcut:${appId}`,
        game_name: String(shortcut.AppName || "Untitled Steam shortcut").trim(),
        total_playtime_seconds: Math.round(minutes * 60),
        last_played_at: toIsoFromSteamTimestamp(shortcut.LastPlayTime),
        platforms: ["Windows", "Steam shortcut"],
        metadata_provider: "steam-local",
        metadata: {
          steam_app_id: appId,
          steam_signed_app_id: signedAppId,
          executable_path: shortcut.Exe || "",
          start_directory: shortcut.StartDir || "",
          icon_path: shortcut.icon || "",
          steam_playtime_minutes: minutes,
        },
      };
    })
    .filter((game) => game.game_name);
}

function normalizedExecutablePath(value) {
  const source = String(value || "").trim();
  const quoted = source.match(/^"([^"]+\.exe)"/i);
  const plain = source.match(/^(.+?\.exe)(?:\s|$)/i);
  const executable = quoted?.[1] || plain?.[1] || source.replace(/^"|"$/g, "");
  try {
    return path.resolve(executable).toLowerCase();
  } catch {
    return executable.toLowerCase();
  }
}

function findExistingLocalGame(game, existingById, existingByExecutable) {
  return existingById.get(game.client_game_id)
    || existingByExecutable.get(normalizedExecutablePath(game.metadata?.executable_path))
    || null;
}

async function syncGames(games) {
  const userId = requiredEnv("LOCAL_GAMES_USER_ID");
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: existing, error: existingError } = await supabase
    .from("local_games")
    .select("client_game_id, cover_image_url, metadata")
    .eq("user_id", userId);
  if (existingError) throw existingError;

  const existingById = new Map((existing || []).map((game) => [game.client_game_id, game]));
  const existingByExecutable = new Map((existing || []).flatMap((game) => {
    const executable = normalizedExecutablePath(game.metadata?.executable_path);
    return executable ? [[executable, game]] : [];
  }));
  const steamGridDbKey = String(process.env.STEAMGRIDDB_API_KEY || "").trim();
  const rows = [];

  for (const game of games) {
    const existingGame = findExistingLocalGame(game, existingById, existingByExecutable);
    const artwork = existingGame?.cover_image_url && existingGame?.metadata?.heroArtworkUrl
      ? null
      : await findSteamGridArtwork(game.game_name, steamGridDbKey);
    rows.push({
      ...game,
      // Keep the existing dashboard identity when a Steam shortcut is renamed.
      // Steam may generate a new shortcut AppID from its title and executable.
      client_game_id: existingGame?.client_game_id || game.client_game_id,
      user_id: userId,
      cover_image_url: existingGame?.cover_image_url || artwork?.coverUrl || null,
      metadata: {
        ...(existingGame?.metadata || {}),
        ...game.metadata,
        ...(artwork
          ? {
              steamgriddb_game_id: artwork.gameId,
              steamgriddb_game_name: artwork.gameName,
              steamgriddb_grid_id: artwork.gridId,
              steamgriddb_hero_id: artwork.heroId,
              heroArtworkUrl: existingGame?.metadata?.heroArtworkUrl || artwork.heroUrl || null,
            }
          : {}),
      },
    });
  }
  const { error } = await supabase.from("local_games").upsert(rows, { onConflict: "user_id,client_game_id" });
  if (error) throw error;
}

async function syncOnce({ verbose = true } = {}) {
  const games = readSteamShortcuts();
  if (!games.length) throw new Error("No Steam non-Steam shortcuts were found.");

  if (verbose) {
    console.table(games.map((game) => ({
      title: game.game_name,
      steamAppId: game.metadata.steam_app_id,
      minutesPlayed: game.total_playtime_seconds / 60,
      lastPlayed: game.last_played_at || "Never",
    })));
  }

  if (!writeChanges) {
    console.log("Preview only. Run `npm run sync:steam-local -- --write` to save these games to Supabase.");
    return games;
  }

  await syncGames(games);
  console.log(`Synced ${games.length} Steam shortcut game(s) to Supabase.`);
  return games;
}

async function main() {
  await syncOnce({ verbose: !watchChanges });
  if (!watchChanges) return;

  const files = getSteamDataFiles();
  let pendingSync = null;
  let activeSync = Promise.resolve();
  const scheduleSync = (reason) => {
    clearTimeout(pendingSync);
    pendingSync = setTimeout(() => {
      activeSync = activeSync.catch(() => {}).then(() => syncOnce({ verbose: false }));
      activeSync.catch((error) => console.error(`Steam local-game ${reason} sync failed: ${error.message}`));
    }, 1_500);
  };

  for (const filePath of [files.shortcutsPath, files.localConfigPath]) {
    fs.watchFile(filePath, { interval: 2_000 }, (current, previous) => {
      if (current.mtimeMs !== previous.mtimeMs || current.size !== previous.size) scheduleSync("file-change");
    });
  }
  setInterval(() => scheduleSync("periodic"), 5 * 60_000);
  console.log(`Watching Steam shortcuts for title and library changes: ${files.shortcutsPath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Steam local-game sync failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  findExistingLocalGame,
  normalizedExecutablePath,
  parseBinaryVdf,
  readSteamShortcuts,
};
