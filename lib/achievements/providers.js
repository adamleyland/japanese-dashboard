export const ACHIEVEMENT_PROVIDERS = Object.freeze({
  steam: { label: "Steam", supportsSync: true },
  xbox: { label: "Xbox", supportsSync: true },
  local: { label: "Local", supportsSync: true },
  manual: { label: "Manual", supportsSync: false },
});

export function getAchievementProviderLabel(provider) {
  return ACHIEVEMENT_PROVIDERS[provider]?.label || "Unknown";
}

export function summarizeAchievementGame(game) {
  const achievements = Array.isArray(game?.achievements) ? game.achievements : [];
  const unlocked = achievements.filter((achievement) => achievement.unlocked).length;
  const total = achievements.length;
  return { unlocked, total, completion: total ? Math.round((unlocked / total) * 100) : 0 };
}
