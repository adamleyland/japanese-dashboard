export const GAMING_SORT_OPTIONS = [
  { value: "hours-played", label: "Hours played" },
  { value: "recently-played", label: "Recently played" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "source", label: "Source" },
];

export const GAMING_SOURCE_FILTERS = [
  { value: "all", label: "All" },
  { value: "steam", label: "Steam" },
  { value: "xbox", label: "Xbox" },
];

export const DEFAULT_GAMING_SORT = "hours-played";
export const DEFAULT_GAMING_SOURCE_FILTER = "all";
export const DEFAULT_GAMING_LIBRARY_VIEW = "included";
export const DEFAULT_GAMING_LAYOUT_MODE = "list";

export function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function toIdentifier(value, fallback = "") {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

export function toIsoDate(value) {
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

export function toTimestamp(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getGameStorageKey(game) {
  return `${game?.source || "unknown"}:${game?.sourceGameId || "unknown"}`;
}

export function formatPlaytimeCompact(minutes) {
  const safeMinutes = Math.max(0, toFiniteNumber(minutes));
  const hours = safeMinutes / 60;

  return `${hours.toLocaleString(undefined, {
    minimumFractionDigits: hours >= 10 ? 0 : 1,
    maximumFractionDigits: 1,
  })}h`;
}

export function formatPlaytimeHours(
  minutes,
  { minimumFractionDigits = 1, maximumFractionDigits = 1 } = {},
) {
  const safeMinutes = Math.max(0, toFiniteNumber(minutes));
  const hours = safeMinutes / 60;

  return `${hours.toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  })}h`;
}

export function formatPlaytimeDetailed(minutes) {
  const safeMinutes = Math.max(0, Math.round(toFiniteNumber(minutes)));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (!hours) {
    return `${remainingMinutes}m`;
  }

  if (!remainingMinutes) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function formatRelativeLastPlayed(value) {
  const timestamp = toTimestamp(value);
  if (!timestamp) {
    return "No recent timestamp";
  }

  const deltaMs = Date.now() - timestamp;
  const deltaMinutes = Math.max(0, Math.round(deltaMs / 60000));

  if (deltaMinutes < 60) {
    return `${deltaMinutes || 0}m ago`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 7) {
    return `${deltaDays}d ago`;
  }

  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function getSourceLabel(source) {
  if (source === "steam") {
    return "Steam";
  }

  if (source === "xbox") {
    return "Xbox";
  }

  return "Unknown";
}

export function getPlatformLabel(platform) {
  const safePlatform = toSafeString(platform, "Unknown platform");
  const normalizedPlatform = safePlatform.toLowerCase();

  if (
    normalizedPlatform === "pc" ||
    normalizedPlatform.includes("windows") ||
    normalizedPlatform.includes("desktop")
  ) {
    return "PC";
  }

  if (normalizedPlatform === "xbox") {
    return "Xbox";
  }

  return safePlatform;
}

export function getDeviceLabel(game = {}) {
  const deviceCandidates = [
    ...(Array.isArray(game?.devices) ? game.devices : []),
    ...(Array.isArray(game?.availableOn) ? game.availableOn : []),
    ...(Array.isArray(game?.platforms) ? game.platforms : []),
  ];

  const pcDevice = deviceCandidates.find((device) => {
    const normalizedDevice = toSafeString(device).toLowerCase();
    return (
      normalizedDevice === "pc" ||
      normalizedDevice.includes("windows") ||
      normalizedDevice.includes("desktop")
    );
  });

  if (pcDevice) {
    return "PC";
  }

  const xboxDevice = deviceCandidates.find((device) => {
    const normalizedDevice = toSafeString(device).toLowerCase();
    return normalizedDevice.includes("xbox");
  });

  if (xboxDevice) {
    return "Xbox";
  }

  if (game?.source === "xbox") {
    return "PC";
  }

  return getPlatformLabel(game?.platform);
}

export function clampMinutes(minutes) {
  return Math.max(0, Math.round(toFiniteNumber(minutes)));
}

export function supportsTrackedPlaytime(game) {
  return toFiniteNumber(game?.minutesPlayedTotal) > 0;
}

export function hasTrackedPlaytime(game) {
  return supportsTrackedPlaytime(game);
}

export function getPreferredArtworkUrl(game) {
  return (
    toSafeString(game?.portraitArtworkUrl) ||
    toSafeString(game?.artworkUrl) ||
    toSafeString(game?.headerArtworkUrl) ||
    toSafeString(game?.iconArtworkUrl) ||
    null
  );
}

export function getArtworkCandidates(game, { variant = "default" } = {}) {
  const orderedCandidates =
    variant === "portrait"
      ? [
          toSafeString(game?.portraitArtworkUrl),
          toSafeString(game?.artworkUrl),
          toSafeString(game?.headerArtworkUrl),
          toSafeString(game?.iconArtworkUrl),
        ]
      : [
          toSafeString(game?.artworkUrl),
          toSafeString(game?.headerArtworkUrl),
          toSafeString(game?.iconArtworkUrl),
          toSafeString(game?.portraitArtworkUrl),
        ];

  return orderedCandidates.filter(
    (value, index, values) => value && values.indexOf(value) === index,
  );
}

export function formatPercentage(numerator, denominator) {
  const safeDenominator = Math.max(0, toFiniteNumber(denominator));
  if (!safeDenominator) {
    return "0%";
  }

  return `${Math.round((toFiniteNumber(numerator) / safeDenominator) * 100)}%`;
}
