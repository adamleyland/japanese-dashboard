const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

for (const line of fs.readFileSync(path.resolve(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing ${name} in .env.local.`);
  return value;
}

function decodeText(value) {
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

function parseDescriptions(html) {
  const descriptions = new Map();
  const pattern = /<h3[^>]*class="[^"]*ellipsis[^"]*"[^>]*>([\s\S]*?)<\/h3>\s*<h5[^>]*>([\s\S]*?)<\/h5>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const name = decodeText(match[1]);
    const description = decodeText(match[2]);
    if (name && description) descriptions.set(name, description);
  }
  return descriptions;
}

async function main() {
  const steamId = requiredEnv("STEAM_USER_ID");
  const admin = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: games, error } = await admin.from("achievement_games")
    .select("provider_game_id, achievements(id, name, description, unlocked, metadata)")
    .eq("provider", "steam");
  if (error) throw error;

  let updated = 0;
  for (const game of games || []) {
    const response = await fetch(
      `https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/stats/${encodeURIComponent(game.provider_game_id)}/achievements/?l=english`,
      { headers: { "Accept-Language": "en-GB", "User-Agent": "Mozilla/5.0" } },
    );
    if (!response.ok) continue;
    const descriptions = parseDescriptions(await response.text());
    for (const achievement of game.achievements || []) {
      if (achievement.description || !achievement.unlocked || !achievement.metadata?.hidden) continue;
      const description = descriptions.get(achievement.name);
      if (!description) continue;
      const { error: updateError } = await admin.from("achievements")
        .update({ description, updated_at: new Date().toISOString() })
        .eq("id", achievement.id);
      if (updateError) throw updateError;
      updated += 1;
    }
  }
  console.log(`Backfilled ${updated} revealed Steam achievement descriptions.`);
}

main().catch((error) => {
  console.error(`Steam achievement description backfill failed: ${error.message}`);
  process.exitCode = 1;
});
