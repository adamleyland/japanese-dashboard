import { fetchJson, normalizeGameTitle } from "@/lib/achievements/server-utils";

const STEAM_API = "https://api.steampowered.com";
const STORE_SEARCH = "https://store.steampowered.com/api/storesearch/";

function steamIcon(appId, hash) {
  const value = String(hash || "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const filename = /\.[a-z0-9]+$/i.test(value) ? value : `${value}.jpg`;
  return `https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/${appId}/${filename}`;
}

function requireSteamKey() {
  const key = String(process.env.STEAM_API_KEY || "").trim();
  if (!key) throw new Error("Steam achievements need STEAM_API_KEY in .env.local.");
  return key;
}

function decodeSteamText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function getRevealedAchievementDescriptions({ steamId, appId }) {
  const response = await fetch(
    `https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/stats/${encodeURIComponent(appId)}/achievements/?l=english`,
    { cache: "no-store", headers: { "Accept-Language": "en-GB", "User-Agent": "Mozilla/5.0" } },
  );
  if (!response.ok) return new Map();
  const html = await response.text();
  const descriptions = new Map();
  const achievementPattern = /<h3[^>]*class="[^"]*ellipsis[^"]*"[^>]*>([\s\S]*?)<\/h3>\s*<h5[^>]*>([\s\S]*?)<\/h5>/gi;
  let match;
  while ((match = achievementPattern.exec(html))) {
    const name = decodeSteamText(match[1]);
    const description = decodeSteamText(match[2]);
    if (name && description) descriptions.set(name, description);
  }
  return descriptions;
}

export async function findSteamAppByTitle(title) {
  const payload = await fetchJson(`${STORE_SEARCH}?${new URLSearchParams({ term: title, l: "english", cc: "GB" })}`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const normalized = normalizeGameTitle(title);
  return items.find((item) => normalizeGameTitle(item?.name) === normalized) || null;
}

export async function getSteamAchievementSnapshot({ appId, includePlayerProgress = true, fallbackTitle = "" }) {
  const key = requireSteamKey();
  const schemaUrl = `${STEAM_API}/ISteamUserStats/GetSchemaForGame/v2/?${new URLSearchParams({ key, appid: String(appId), l: "english" })}`;
  const rarityUrl = `${STEAM_API}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?${new URLSearchParams({ gameid: String(appId) })}`;
  const schemaPromise = fetchJson(schemaUrl);
  const rarityPromise = fetchJson(rarityUrl).catch(() => ({}));
  const requests = [schemaPromise, rarityPromise];

  if (includePlayerProgress) {
    const steamId = String(process.env.STEAM_USER_ID || "").trim();
    if (!steamId) throw new Error("Steam achievements need STEAM_USER_ID in .env.local.");
    requests.push(fetchJson(`${STEAM_API}/ISteamUserStats/GetPlayerAchievements/v1/?${new URLSearchParams({ key, steamid: steamId, appid: String(appId), l: "english" })}`));
  }

  const [schemaPayload, rarityPayload, playerPayload] = await Promise.all(requests);
  const schema = schemaPayload?.game?.availableGameStats?.achievements || [];
  if (!schema.length) throw new Error(`No Steam achievement definition was found for ${fallbackTitle || `app ${appId}`}.`);
  const player = playerPayload?.playerstats || {};
  if (includePlayerProgress && player.success === false) {
    throw new Error(player.error || "Steam did not return achievement progress. Check that Game details are public and the game belongs to this Steam account.");
  }
  const progressById = new Map((player.achievements || []).map((item) => [item.apiname, item]));
  const rarityById = new Map((rarityPayload?.achievementpercentages?.achievements || []).map((item) => [item.name, item.percent]));
  const revealedDescriptions = includePlayerProgress
    ? await getRevealedAchievementDescriptions({ steamId: process.env.STEAM_USER_ID, appId }).catch(() => new Map())
    : new Map();

  return {
    gameName: player.gameName || schemaPayload?.game?.gameName || fallbackTitle || `Steam app ${appId}`,
    platform: "pc",
    coverArtworkUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    definitionProvider: "steam",
    definitionGameId: String(appId),
    trackingMode: includePlayerProgress ? "provider" : "local-companion",
    achievements: schema.map((definition) => {
      const progress = progressById.get(definition.name);
      const unlocked = progress?.achieved === 1;
      return {
        id: definition.name,
        name: definition.displayName || definition.name,
        description: definition.description || (unlocked ? revealedDescriptions.get(definition.displayName || definition.name) : null) || null,
        iconUrl: steamIcon(appId, definition.icon),
        iconLockedUrl: steamIcon(appId, definition.icongray),
        unlocked,
        unlockedAt: unlocked && progress.unlocktime ? new Date(progress.unlocktime * 1000).toISOString() : null,
        rarityPercentage: rarityById.get(definition.name) ?? null,
        progressCurrent: unlocked ? 1 : 0,
        progressTarget: 1,
        preserveExistingProgress: !includePlayerProgress,
        metadata: { steamApiName: definition.name, hidden: definition.hidden === 1 },
      };
    }),
  };
}
