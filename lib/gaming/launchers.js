import { getGameStorageKey, toSafeString } from "@/lib/gaming/gaming-utils";

export function buildSteamLaunchUrl(appId) {
  return appId ? `steam://run/${appId}` : null;
}

export function buildXboxLaunchUrl(rawGame = {}) {
  return (
    toSafeString(rawGame.launchUrl) ||
    toSafeString(rawGame.launchUri) ||
    toSafeString(rawGame.deepLink) ||
    null
  );
}

export function canLaunchGame(game) {
  return Boolean(game?.launchUrl);
}

export function openGameLauncher(game) {
  if (typeof window === "undefined" || !canLaunchGame(game)) {
    return false;
  }

  const launchUrl = game.launchUrl;

  if (/^https?:\/\//i.test(launchUrl)) {
    window.open(launchUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  window.location.assign(launchUrl);
  return true;
}

export function getLaunchAriaLabel(game) {
  return `Launch ${game?.title || "game"} from ${game?.source || getGameStorageKey(game)}`;
}
