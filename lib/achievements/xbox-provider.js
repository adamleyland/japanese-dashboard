import { fetchJson, toIsoDate, toNumber } from "@/lib/achievements/server-utils";

const OPENXBL_API = "https://xbl.io/api/v2";

function credentials() {
  const apiKey = String(process.env.XBL_API_KEY || "").trim();
  const xuid = String(process.env.XBL_XUID || "").trim();
  if (!apiKey || !xuid) throw new Error("Xbox achievements need XBL_API_KEY and XBL_XUID in .env.local.");
  return { apiKey, xuid };
}

function headers(apiKey) {
  return { "x-authorization": apiKey, "Accept-Language": "en-GB" };
}

function firstArray(payload, paths) {
  for (const path of paths) {
    let value = payload;
    for (const key of path) value = value?.[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function rewardValue(item, type) {
  const reward = (item?.rewards || []).find((candidate) => String(candidate?.type || "").toLowerCase() === type);
  return toNumber(reward?.value);
}

function mediaUrl(item) {
  return (item?.mediaAssets || []).find((asset) => asset?.url)?.url || item?.iconUrl || item?.imageUrl || null;
}

function progressValues(item, unlocked) {
  const requirements = item?.progression?.requirements || [];
  const current = requirements.reduce((sum, requirement) => sum + (toNumber(requirement?.current, 0) || 0), 0);
  const target = requirements.reduce((sum, requirement) => sum + (toNumber(requirement?.target, 0) || 0), 0);
  return { current: unlocked ? target || 1 : current, target: target || 1 };
}

export async function getXboxAchievementSnapshot({ titleId, fallbackTitle = "" }) {
  const { apiKey, xuid } = credentials();
  const payload = await fetchJson(`${OPENXBL_API}/achievements/player/${encodeURIComponent(xuid)}/${encodeURIComponent(titleId)}`, { headers: headers(apiKey) });
  const items = firstArray(payload, [["achievements"], ["content", "achievements"], ["data", "achievements"], ["items"]]);
  if (!items.length) throw new Error(`No Xbox achievements were returned for ${fallbackTitle || titleId}.`);
  const titleAssociation = items[0]?.titleAssociations?.[0] || {};

  return {
    gameName: titleAssociation.name || payload?.name || fallbackTitle || `Xbox title ${titleId}`,
    platform: "xbox",
    coverArtworkUrl: payload?.displayImage || payload?.imageUrl || null,
    definitionProvider: "xbox",
    definitionGameId: String(titleId),
    trackingMode: "provider",
    achievements: items.map((item) => {
      const state = String(item?.progressState || item?.state || "").toLowerCase();
      const unlocked = state === "achieved" || state === "unlocked" || toNumber(item?.progressPercentage) === 100;
      const progress = progressValues(item, unlocked);
      return {
        id: item?.id || item?.achievementId,
        name: item?.name || "Xbox achievement",
        description: item?.description || item?.lockedDescription || null,
        iconUrl: mediaUrl(item),
        iconLockedUrl: mediaUrl(item),
        unlocked,
        unlockedAt: unlocked ? toIsoDate(item?.progression?.timeUnlocked || item?.timeUnlocked) : null,
        rarityPercentage: toNumber(item?.rarity?.currentPercentage ?? item?.rarityPercentage),
        gamerscore: rewardValue(item, "gamerscore"),
        progressCurrent: progress.current,
        progressTarget: progress.target,
        metadata: { secret: Boolean(item?.isSecret), achievementType: item?.achievementType || null },
      };
    }).filter((item) => item.id),
  };
}
