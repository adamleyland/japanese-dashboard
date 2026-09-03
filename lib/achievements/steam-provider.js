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

function achievementProgressTarget(description) {
  const match = String(description || "").match(/\b(\d[\d,]*(?:\.\d+)?)\b/);
  if (!match) return null;
  const target = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(target) && target > 1 ? target : null;
}

function steamProgressKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^\d+[_-]*/, "")
    .replace(/(?:[_-]?(?:achievement|progress|stat))+$/, "")
    .replace(/[^a-z0-9]/g, "");
}

function steamStatForAchievement(achievementName, statsByName) {
  const achievementKey = steamProgressKey(achievementName);
  if (achievementKey.length < 4) return null;
  for (const [name, value] of statsByName) {
    const statKey = steamProgressKey(name);
    if (statKey === achievementKey || statKey.endsWith(achievementKey)) return { name, value };
  }
  return null;
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

function titleTokens(value) {
  return new Set(normalizeGameTitle(value).split(" ").filter((token) => token.length > 1));
}

function titleMatchScore(title, candidateName) {
  const expected = normalizeGameTitle(title);
  const candidate = normalizeGameTitle(candidateName);
  if (!expected || !candidate) return 0;
  if (expected === candidate) return 1000;
  if (candidate.startsWith(expected) || expected.startsWith(candidate)) return 750;
  if (candidate.includes(expected) || expected.includes(candidate)) return 600;
  const expectedTokens = titleTokens(expected);
  const candidateTokens = titleTokens(candidate);
  const overlap = [...expectedTokens].filter((token) => candidateTokens.has(token)).length;
  return overlap ? Math.round((overlap / Math.max(expectedTokens.size, candidateTokens.size)) * 500) : 0;
}

export async function findSteamAppsByTitle(title) {
  const payload = await fetchJson(`${STORE_SEARCH}?${new URLSearchParams({ term: title, l: "english", cc: "GB" })}`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .map((item) => ({ ...item, matchScore: titleMatchScore(title, item?.name) }))
    .filter((item) => item?.id && item.matchScore >= 250)
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, 5);
}

export async function findSteamAppByTitle(title) {
  return (await findSteamAppsByTitle(title))[0] || null;
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
    requests.push(fetchJson(`${STEAM_API}/ISteamUserStats/GetUserStatsForGame/v2/?${new URLSearchParams({ key, steamid: steamId, appid: String(appId) })}`).catch(() => ({})));
  }

  const [schemaPayload, rarityPayload, playerPayload, userStatsPayload] = await Promise.all(requests);
  const schema = schemaPayload?.game?.availableGameStats?.achievements || [];
  if (!schema.length) throw new Error(`No Steam achievement definition was found for ${fallbackTitle || `app ${appId}`}.`);
  const player = playerPayload?.playerstats || {};
  if (includePlayerProgress && player.success === false) {
    throw new Error(player.error || "Steam did not return achievement progress. Check that Game details are public and the game belongs to this Steam account.");
  }
  const progressById = new Map((player.achievements || []).map((item) => [item.apiname, item]));
  const statsByName = new Map((userStatsPayload?.playerstats?.stats || []).map((item) => [String(item.name || ""), Number(item.value)]));
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
      const description = definition.description || (unlocked ? revealedDescriptions.get(definition.displayName || definition.name) : null) || null;
      const progressStat = steamStatForAchievement(definition.name, statsByName);
      const progressTarget = achievementProgressTarget(description);
      const hasTrackedProgress = progressStat && progressTarget;
      return {
        id: definition.name,
        name: definition.displayName || definition.name,
        description,
        iconUrl: steamIcon(appId, definition.icon),
        iconLockedUrl: steamIcon(appId, definition.icongray),
        unlocked,
        unlockedAt: unlocked && progress.unlocktime ? new Date(progress.unlocktime * 1000).toISOString() : null,
        rarityPercentage: rarityById.get(definition.name) ?? null,
        progressCurrent: hasTrackedProgress ? (unlocked ? progressTarget : Math.max(0, progressStat.value)) : (unlocked ? 1 : 0),
        progressTarget: hasTrackedProgress ? progressTarget : 1,
        preserveExistingProgress: !includePlayerProgress,
        metadata: { steamApiName: definition.name, hidden: definition.hidden === 1, progressStatName: hasTrackedProgress ? progressStat.name : null },
      };
    }),
  };
}
