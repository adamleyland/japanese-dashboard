import { NextResponse } from "next/server";

const OPENXBL_TITLE_HISTORY_ENDPOINT = "https://xbl.io/api/v2/player/titleHistory";
const OPENXBL_STATS_ENDPOINT = "https://xbl.io/api/v2/achievements/stats";

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
  ];

  return candidateArrays.find((value) => Array.isArray(value)) || [];
}

function getArtworkCandidates(title = {}) {
  const directCandidates = [
    title.displayImage,
    title.artworkUrl,
    title.headerArtworkUrl,
    title.portraitArtworkUrl,
    title.tileImageUrl,
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
      title?.titleHistory?.lastTimePlayed ||
      title?.titleHistory?.lastPlayedAt ||
      title?.activity?.lastPlayedAt,
  );
}

function getXboxDevices(title = {}) {
  const devices = title.devices || title.availableOn || title.platforms || [];
  return Array.isArray(devices) ? devices.filter(Boolean) : [];
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
  const sourceGameId = toIdentifier(title.titleId || title.modernTitleId || title.name);
  const appId = Number(title.titleId);
  const { minutesPlayedTotal, foundMinutesPlayed } = await getMinutesPlayedForTitle(
    apiKey,
    sourceGameId,
  );

  return {
    game: {
      source: "xbox",
      sourceGameId,
      appId: Number.isFinite(appId) ? appId : null,
      title: title.name || "Unknown game",
      artworkUrl: getXboxArtwork(title),
      headerArtworkUrl: getXboxHeaderArtwork(title),
      portraitArtworkUrl: getXboxPortraitArtwork(title),
      minutesPlayedTotal,
      minutesPlayedRecent: 0,
      lastPlayedAt: getXboxLastPlayedAt(title),
      includeInOverallTotal: true,
      launchUrl: null,
      platform: "xbox",
      devices: getXboxDevices(title),
      isStreamable: getXboxIsStreamable(title),
      achievement: title.achievement ?? null,
      raw: title,
    },
    foundMinutesPlayed,
  };
}

export async function GET() {
  const apiKey = process.env.XBL_API_KEY;
  const xuid = process.env.XBL_XUID;

  if (!apiKey || !xuid) {
    return NextResponse.json(
      { error: "Missing XBL_API_KEY or XBL_XUID" },
      { status: 500 },
    );
  }

  try {
    const titleHistoryResponse = await fetch(`${OPENXBL_TITLE_HISTORY_ENDPOINT}/${xuid}`, {
      headers: getOpenXblHeaders(apiKey),
      cache: "no-store",
    });

    const payload = await titleHistoryResponse.json().catch(() => ({}));

    if (!titleHistoryResponse.ok) {
      return NextResponse.json(
        {
          error: extractErrorText(payload, "Failed to fetch Xbox title history"),
        },
        { status: titleHistoryResponse.status },
      );
    }

    const titles = extractTitleHistoryTitles(payload).filter((title) => title?.type === "Game");
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
        totalTitleCount: titles.length,
        normalizedCount: games.length,
        minutesPlayedFoundCount,
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
