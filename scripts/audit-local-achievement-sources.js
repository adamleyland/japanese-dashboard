const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

loadEnvFile(path.resolve(__dirname, "..", ".env.local"));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function executablePath(value) {
  const source = String(value || "").trim();
  const quoted = source.match(/^"([^"]+\.exe)"/i);
  if (quoted) return quoted[1];
  return (source.match(/^(.+?\.exe)(?:\s|$)/i)?.[1] || source).replace(/^"|"$/g, "");
}

function normalizedTitle(value) {
  return String(value || "").toLowerCase().replace(/[™®©]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function installationRoot(executable) {
  const gamesRoot = path.resolve(process.env.LOCAL_GAMES_ROOT || path.join(process.env.USERPROFILE || "", "Games"));
  let current = path.dirname(executable);
  while (path.dirname(current).toLowerCase().startsWith(gamesRoot.toLowerCase()) && path.dirname(current).toLowerCase() !== gamesRoot.toLowerCase()) {
    current = path.dirname(current);
  }
  return current;
}

const interestingFile = /^(?:steam_appid\.txt|steam_emu\.ini|steamconfig\.ini|valve\.ini|tenoke\.ini|configs\.app\.ini|configs\.user\.ini|achievements?\.(?:json|ini)|user_stats\.ini|flt\.ini|rune\.ini)$/i;
const skippedDirectory = /^(?:content|paks?|movies?|audio|sound|textures?|_commonredist|d3d12|dlc|redist|localization)$/i;

function findConfigurationFiles(root, maxDepth = 9) {
  const result = [];
  const queue = [{ directory: root, depth: 0 }];
  while (queue.length) {
    const { directory, depth } = queue.shift();
    let entries = [];
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isFile() && interestingFile.test(entry.name)) result.push(fullPath);
      if (entry.isDirectory() && depth < maxDepth && !skippedDirectory.test(entry.name)) queue.push({ directory: fullPath, depth: depth + 1 });
    }
  }
  return result;
}

function appIdFromFiles(files) {
  for (const file of files) {
    let contents = "";
    try { contents = fs.readFileSync(file, "utf8"); } catch { continue; }
    if (/steam_appid\.txt$/i.test(file)) {
      const id = contents.match(/\b\d{3,10}\b/)?.[0];
      if (id) return id;
    }
    const id = contents.match(/^\s*(?:AppId|SteamAppId|appid|id)\s*=\s*(\d{3,10})/im)?.[1];
    if (id) return id;
  }
  return "";
}

async function steamAppIdForTitle(title) {
  try {
    const query = new URLSearchParams({ term: title, l: "english", cc: "GB" });
    const response = await fetch(`https://store.steampowered.com/api/storesearch/?${query}`);
    if (!response.ok) return "";
    const payload = await response.json().catch(() => ({}));
    const items = Array.isArray(payload.items) ? payload.items : [];
    const normalized = normalizedTitle(title);
    return String(items.find((item) => normalizedTitle(item.name) === normalized)?.id || items[0]?.id || "");
  } catch {
    return "";
  }
}

function candidateStores(appId) {
  if (!appId) return [];
  const publicRoot = process.env.PUBLIC || "C:\\Users\\Public";
  const appData = process.env.APPDATA || "";
  const candidates = [
    ["rune", path.join(publicRoot, "Documents", "Steam", "RUNE", appId, "achievements.ini")],
    ["codex", path.join(publicRoot, "Documents", "Steam", "CODEX", appId, "achievements.ini")],
    ["gse", path.join(appData, "GSE Saves", appId, "achievements.json")],
    ["goldberg", path.join(appData, "Goldberg SteamEmu Saves", appId, "achievements.json")],
    ["flt", path.join(appData, "FLT", appId, "stats", "achievements.ini")],
  ];
  return candidates.map(([format, file]) => ({ format, file, exists: fs.existsSync(file), directoryExists: fs.existsSync(path.dirname(file)) }));
}

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.from("local_games").select("game_name, metadata").order("game_name");
  if (error) throw error;
  const results = [];
  for (const game of data || []) {
    const executable = executablePath(game.metadata?.executable_path);
    const root = executable ? installationRoot(executable) : "";
    const files = root && fs.existsSync(root) ? findConfigurationFiles(root) : [];
    const localAppId = String(game.metadata?.achievementProviderGameId || appIdFromFiles(files));
    const appId = localAppId || await steamAppIdForTitle(game.game_name);
    results.push({
      game: game.game_name,
      executable,
      root,
      appId,
      appIdSource: localAppId ? "local" : appId ? "store-search" : "missing",
      configurationFiles: files,
      stores: candidateStores(appId),
    });
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
