import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/requestAuth";

const OPENXBL_TITLE_HISTORY_ENDPOINT = "https://xbl.io/api/v2/player/titleHistory";
const OPENXBL_STATS_ENDPOINT = "https://xbl.io/api/v2/achievements/stats";
const OPENXBL_ACTIVITY_FEED_ENDPOINT = "https://xbl.io/api/v2/activity/feed";
const OPENXBL_PRESENCE_ENDPOINT = "https://xbl.io/api/v2/presence";

function getOpenXblHeaders(apiKey) {
  return {
    "x-authorization": apiKey,
    Accept: "application/json",
    "Accept-Language": "en-GB",
  };
}

function ensureHttps(url) {
  if (!url || typeof url !== "string") {
    return null;
  }

  return url.startsWith("http://") ? url.replace("http://", "https://") : url;
}

function toIdentifier(value, fallback = "") {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

function toIsoDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "number") {
    const timestamp = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function clampMinutes(value) {
  const minutes = Number(value);
  return Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
}

function extractErrorText(payload, fallback) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const candidates = [payload.error, payload.message, payload.details, payload.reason];
  const match = candidates.find((value) => typeof value === "string" && value.trim());

  return match ? match.trim() : fallback;
}

function extractTitleHistoryTitles(payload) {
  const candidateArrays = [
    payload?.content?.titles,
    payload?.titles,
    payload?.content?.items,
    payload?.items,
    payload?.data?.titles,
    payload?.data?.items,
  ];

  return candidateArrays.find((value) => Array.isArray(value)) || [];
}

function extractActivityFeedItems(payload) {
  const candidateArrays = [
    payload?.content?.activityItems,
    payload?.activityItems,
    payload?.content?.items,
    payload?.items,
  ];

  return candidateArrays.find((value) => Array.isArray(value)) || [];
}

function extractPresenceTitles(payload) {
  const devices = Array.isArray(payload?.content?.devices)
    ? payload.content.devices
    : Array.isArray(payload?.devices)
      ? payload.devices
      : [];

  return devices.flatMap((device) => {
    const titles = Array.isArray(device?.titles) ? device.titles : [];
    const deviceType = toIdentifier(device?.type);

    return titles.map((title) => ({
      ...title,
      devices: deviceType ? [deviceType] : [],
      sourceHint: "presence",
    }));
  });
}

function isLikelyGameTitle(title = {}) {
  if (!title || typeof title !== "object") {
    return false;
  }

  if (title.sourceHint === "activity-feed" || title.sourceHint === "presence") {
    return Boolean(getXboxTitleId(title) && getXboxTitleName(title));
  }

  const type = toIdentifier(title.type || title.contentType).toLowerCase();

  if (!type) {
    return true;
  }

  return type.includes("game") || type.includes("title");
}

function getXboxTitleId(title = {}) {
  return toIdentifier(
    title.titleId ||
      title.id ||
      title.uploadTitleId ||
      title.modernTitleId ||
      title.productId ||
      title.scid ||
      title.name ||
      title.contentTitle,
  );
}

function getXboxTitleName(title = {}) {
  return (
    toIdentifier(title.name) ||
    toIdentifier(title.title) ||
    toIdentifier(title.contentTitle) ||
    toIdentifier(title.productTitle) ||
    toIdentifier(title.localizedName) ||
    "Unknown game"
  );
}

function dedupeTitles(titles = []) {
  const titlesById = new Map();

  titles.forEach((title) => {
    const titleId = getXboxTitleId(title);
    const titleName = getXboxTitleName(title);

    if (!titleId || !titleName) {
      return;
    }

    const key = titleId || titleName.toLowerCase();
    const existingTitle = titlesById.get(key);

    if (!existingTitle) {
      titlesById.set(key, title);
      return;
    }

    titlesById.set(key, {
      ...existingTitle,
      ...title,
      devices: [
        ...new Set([
          ...getXboxDevices(existingTitle),
          ...getXboxDevices(title),
        ]),
      ],
      lastPlayedAt: getXboxLastPlayedAt(title) || getXboxLastPlayedAt(existingTitle),
    });
  });

  return [...titlesById.values()];
}

function getArtworkCandidates(title = {}) {
  const directCandidates = [
    title.displayImage,
    title.artworkUrl,
    title.headerArtworkUrl,
    title.portraitArtworkUrl,
    title.tileImageUrl,
    title.imageUrl,
    title.contentImageUri,
    title.itemImage,
    title.screenshotThumbnail,
  ];

  const nestedCandidates = [
    title.images?.[0]?.url,
    title.images?.[0]?.uri,
    title.boxArt?.tileUrl,
    title.boxArt?.largeUrl,
    title.boxArt?.posterUrl,
    title.boxArt?.heroUrl,
  ];

  return [...directCandidates, ...nestedCandidates]
    .map((value) => ensureHttps(value))
    .filter((value, index, values) => value && values.indexOf(value) === index);
}

function getXboxArtwork(title = {}) {
  return getArtworkCandidates(title)[0] || null;
}

function getXboxHeaderArtwork(title = {}) {
  const candidates = [
    ensureHttps(title.headerArtworkUrl),
    ensureHttps(title.artworkUrl),
    ensureHttps(title.boxArt?.heroUrl),
    getXboxArtwork(title),
  ];

  return candidates.find((value) => value) || null;
}

function getXboxPortraitArtwork(title = {}) {
  const candidates = [
    ensureHttps(title.portraitArtworkUrl),
    ensureHttps(title.boxArt?.posterUrl),
    ensureHttps(title.boxArt?.largeUrl),
    getXboxHeaderArtwork(title),
    getXboxArtwork(title),
  ];

  return candidates.find((value) => value) || null;
}

function getXboxLastPlayedAt(title = {}) {
  return toIsoDate(
    title.lastPlayedAt ||
      title.lastTimePlayed ||
      title.date ||
      title.lastModified ||
      title?.titleHistory?.lastTimePlayed ||
      title?.titleHistory?.lastPlayedAt ||
      title?.activity?.lastPlayedAt,
  );
}

function getXboxDevices(title = {}) {
  const devices = title.devices || title.availableOn || title.platforms || [];
  return Array.isArray(devices) ? devices.filter(Boolean) : [];
}

function getXboxPlatform(title = {}) {
  const devices = getXboxDevices(title);
  const pcDevice = devices.find((device) => {
    if (typeof device !== "string") {
      return false;
    }

    const normalizedDevice = device.trim().toLowerCase();
    return (
      normalizedDevice === "pc" ||
      normalizedDevice.includes("windows") ||
      normalizedDevice.includes("desktop")
    );
  });

  if (pcDevice) {
    return "pc";
  }

  const xboxDevice = devices.find((device) => {
    if (typeof device !== "string") {
      return false;
    }

    return device.trim().toLowerCase().includes("xbox");
  });

  if (xboxDevice) {
    return "xbox";
  }

  if (typeof title.platform === "string" && title.platform.trim()) {
    return title.platform;
  }

  return "pc";
}

function getXboxIsStreamable(title = {}) {
  if (typeof title.isStreamable === "boolean") {
    return title.isStreamable;
  }

  if (typeof title.isGamePassStreamable === "boolean") {
    return title.isGamePassStreamable;
  }

  return false;
}

function collectStatsNodes(value, result = []) {
  if (!value || typeof value !== "object") {
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      collectStatsNodes(entry, result);
    });
    return result;
  }

  if (Array.isArray(value.stats)) {
    result.push(...value.stats);
  }

  Object.values(value).forEach((entry) => {
    collectStatsNodes(entry, result);
  });

  return result;
}

async function getMinutesPlayedForTitle(apiKey, titleId) {
  if (!titleId) {
    return { minutesPlayedTotal: 0, foundMinutesPlayed: false };
  }

  try {
    const response = await fetch(`${OPENXBL_STATS_ENDPOINT}/${titleId}`, {
      headers: getOpenXblHeaders(apiKey),
      cache: "no-store",
    });

    if (!response.ok) {
      return { minutesPlayedTotal: 0, foundMinutesPlayed: false };
    }

    const payload = await response.json().catch(() => ({}));
    const stats = collectStatsNodes(payload);
    const minutesPlayedStat = stats.find((stat) => stat?.name === "MinutesPlayed");
    const minutesPlayedTotal = clampMinutes(minutesPlayedStat?.value);

    return {
      minutesPlayedTotal,
      foundMinutesPlayed: Boolean(minutesPlayedStat && Number.isFinite(Number(minutesPlayedStat?.value))),
    };
  } catch {
    return { minutesPlayedTotal: 0, foundMinutesPlayed: false };
  }
}

async function normalizeXboxTitle(apiKey, title = {}) {
  const sourceGameId = getXboxTitleId(title);
  const appId = Number(title.titleId || title.id || title.uploadTitleId);
  const { minutesPlayedTotal, foundMinutesPlayed } = await getMinutesPlayedForTitle(
    apiKey,
    sourceGameId,
  );

  return {
    game: {
      source: "xbox",
      sourceGameId,
      appId: Number.isFinite(appId) ? appId : null,
      title: getXboxTitleName(title),
      artworkUrl: getXboxArtwork(title),
      headerArtworkUrl: getXboxHeaderArtwork(title),
      portraitArtworkUrl: getXboxPortraitArtwork(title),
      minutesPlayedTotal,
      minutesPlayedRecent: 0,
      lastPlayedAt: getXboxLastPlayedAt(title),
      includeInOverallTotal: true,
      launchUrl: null,
      platform: getXboxPlatform(title),
      devices: getXboxDevices(title),
      isStreamable: getXboxIsStreamable(title),
      achievement: title.achievement ?? null,
      raw: title,
    },
    foundMinutesPlayed,
  };
}

async function fetchOpenXblJson(apiKey, endpoint) {
  const response = await fetch(endpoint, {
    headers: getOpenXblHeaders(apiKey),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));

  return { response, payload };
}

async function getFallbackTitles(apiKey) {
  const [activityResult, presenceResult] = await Promise.allSettled([
    fetchOpenXblJson(apiKey, OPENXBL_ACTIVITY_FEED_ENDPOINT),
    fetchOpenXblJson(apiKey, OPENXBL_PRESENCE_ENDPOINT),
  ]);

  const activityItems =
    activityResult.status === "fulfilled" && activityResult.value.response.ok
      ? extractActivityFeedItems(activityResult.value.payload)
      : [];
  const presenceTitles =
    presenceResult.status === "fulfilled" && presenceResult.value.response.ok
      ? extractPresenceTitles(presenceResult.value.payload)
      : [];

  const activityTitles = activityItems
    .filter((item) => item?.titleId || item?.uploadTitleId)
    .map((item) => ({
      ...item,
      name: item.contentTitle || item.name || item.title,
      titleId: item.titleId || item.uploadTitleId,
      lastPlayedAt: item.date,
      sourceHint: "activity-feed",
    }));

  return {
    titles: dedupeTitles([...activityTitles, ...presenceTitles]).filter(isLikelyGameTitle),
    debug: {
      activityStatus:
        activityResult.status === "fulfilled"
          ? activityResult.value.response.status
          : "failed",
      activityItemCount: activityItems.length,
      presenceStatus:
        presenceResult.status === "fulfilled"
          ? presenceResult.value.response.status
          : "failed",
      presenceTitleCount: presenceTitles.length,
    },
  };
}

export async function GET(request) {
  const { user, error: authError } = await getRequestUser(request);
  if (authError || !user?.id) {
    return NextResponse.json({ error: "Sign in is required to view Xbox games." }, { status: 401 });
  }

  const apiKey = process.env.XBL_API_KEY;
  const xuid = process.env.XBL_XUID;

  if (!apiKey || !xuid) {
    return NextResponse.json(
      { error: "Missing XBL_API_KEY or XBL_XUID" },
      { status: 500 },
    );
  }

  try {
    const { response: titleHistoryResponse, payload } = await fetchOpenXblJson(
      apiKey,
      `${OPENXBL_TITLE_HISTORY_ENDPOINT}/${xuid}`,
    );

    if (!titleHistoryResponse.ok) {
      return NextResponse.json(
        {
          error: extractErrorText(payload, "Failed to fetch Xbox title history"),
        },
        { status: titleHistoryResponse.status },
      );
    }

    const titleHistoryTitles = extractTitleHistoryTitles(payload).filter(isLikelyGameTitle);
    const fallbackResult = titleHistoryTitles.length
      ? { titles: [], debug: null }
      : await getFallbackTitles(apiKey);
    const titles = titleHistoryTitles.length ? titleHistoryTitles : fallbackResult.titles;
    const normalizedResults = await Promise.all(
      titles.map((title) => normalizeXboxTitle(apiKey, title)),
    );

    const games = normalizedResults
      .map((entry) => entry.game)
      .filter((game) => Boolean(game?.sourceGameId) && Boolean(game?.title))
      .sort((a, b) => {
        const timestampDifference =
          (toTimestamp(b.lastPlayedAt) || 0) - (toTimestamp(a.lastPlayedAt) || 0);

        if (timestampDifference) {
          return timestampDifference;
        }

        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      });

    const minutesPlayedFoundCount = normalizedResults.filter(
      (entry) => entry.foundMinutesPlayed,
    ).length;

    return NextResponse.json({
      games,
      debug: {
        source: titleHistoryTitles.length ? "title-history" : "activity-presence-fallback",
        titleHistoryCount: titleHistoryTitles.length,
        totalTitleCount: titles.length,
        normalizedCount: games.length,
        minutesPlayedFoundCount,
        fallback: fallbackResult.debug,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Xbox route failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
