const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");

const {
  achievementSourceForGame,
  definitionAppIdForGame,
  gogGameplayRuntimeSignature,
  gogGameplaySourceForGame,
  parseSilentHillUcaSave,
  parseUniverseLanAchievements,
  readStableGogGameplayAchievements,
  watchedPathsForSource,
} = require("./watch-local-achievements.js");

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function unrealString(value) {
  const contents = Buffer.from(`${value}\0`, "utf8");
  return Buffer.concat([uint32(contents.length), contents]);
}

function silentHillFixture() {
  return Buffer.concat([
    Buffer.from("SAVE-PREFIX-VHCA", "ascii"),
    uint32(1),
    uint32(1),
    unrealString("Event.ReachSilentHill"),
    unrealString("ReachSilentHill"),
    uint32(1),
    uint32(1),
    unrealString("ClosedDoorAttempts"),
    uint32(3),
    uint32(1),
    unrealString("TryToOpenClosedDoors"),
    uint32(0),
    uint32(0),
    uint32(0),
  ]);
}

test("parses Silent Hill 2 direct unlocks and counter progress", () => {
  const unlockedAt = "2026-08-20T12:00:00.000Z";
  const achievements = parseSilentHillUcaSave(silentHillFixture(), unlockedAt);

  assert.deepEqual(achievements, [
    {
      id: "ReachSilentHill",
      unlocked: true,
      progressCurrent: 1,
      progressTarget: 1,
      unlockedAt,
    },
    {
      id: "TryToOpenClosedDoors",
      unlocked: false,
      progressCurrent: 3,
      unlockedAt,
      progressTarget: 50,
    },
  ]);
});

test("parses a live UniverseLAN achievement transition", () => {
  const achievements = parseUniverseLanAchievements(`
[ReachSilentHill]
Unlocked = 1
UnlockTime = 1787246400

[Archivist]
Unlocked = 0
UnlockTime = 0
`);

  assert.equal(achievements.length, 1);
  assert.equal(achievements[0].id, "ReachSilentHill");
  assert.equal(achievements[0].unlockedAt, "2026-08-20T17:20:00.000Z");
});

test("keeps achievement source discovery callable for registered games", () => {
  assert.equal(achievementSourceForGame({ game_name: "Missing game", metadata: {} }), null);
});

test("uses Edith Finch definitions while preserving its release progress AppID", () => {
  assert.equal(definitionAppIdForGame({
    game_name: "What Remains of Edith Finch",
    metadata: { achievementProviderGameId: "1575940" },
  }, "1575940"), "501300");
});

test("discovers and reads a stable GOG Galaxy gameplay database", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "japanese-dashboard-gog-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storageDbPath = path.join(root, "galaxy-2.0.db");
  const applicationsRoot = path.join(root, "Applications");
  const installPath = path.join(root, "Installed Game");
  const gameplayDir = path.join(applicationsRoot, "456", "Gameplay", "789");
  const gameplayDbPath = path.join(gameplayDir, "gameplay.db");
  fs.mkdirSync(gameplayDir, { recursive: true });

  const storage = new DatabaseSync(storageDbPath);
  storage.exec(`
    CREATE TABLE ProductAuthorizations (productId INTEGER, clientId INTEGER);
    CREATE TABLE InstalledBaseProducts (productId INTEGER, installationPath TEXT);
    CREATE TABLE LimitedDetails (productId INTEGER, title TEXT);
    INSERT INTO ProductAuthorizations VALUES (123, 456);
    INSERT INTO InstalledBaseProducts VALUES (123, '${installPath.replaceAll("'", "''")}');
    INSERT INTO LimitedDetails VALUES (123, 'Fixture Game');
  `);
  storage.close();

  const gameplay = new DatabaseSync(gameplayDbPath);
  gameplay.exec(`
    CREATE TABLE achievement (
      id INTEGER, key TEXT, name TEXT, description TEXT,
      visible_while_locked INTEGER, unlock_time TEXT,
      image_url_locked TEXT, image_url_unlocked TEXT, rarity REAL
    );
    INSERT INTO achievement VALUES (
      1, 'FIRST_STEP', 'First Step', 'Start the game', 1,
      '2026-08-21T10:00:00.000Z', 'locked.png', 'unlocked.png', 42.5
    );
  `);
  gameplay.close();

  const source = gogGameplaySourceForGame({
    game_name: "Fixture Game",
    metadata: { executable_path: path.join(installPath, "game.exe") },
  }, { storageDbPath, applicationsRoot });

  assert.equal(source.progressFile, gameplayDbPath);
  assert.equal(source.gogProductId, "123");
  const achievements = await readStableGogGameplayAchievements(gameplayDbPath, {
    pollMs: 25,
    maxWaitMs: 250,
  });
  assert.equal(achievements[0].id, "FIRST_STEP");
  assert.equal(achievements[0].unlockedAt, "2026-08-21T10:00:00.000Z");
});

test("watches GOG SQLite companion files and includes WAL state in signatures", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "japanese-dashboard-gog-wal-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gameplayDbPath = path.join(root, "gameplay.db");
  fs.writeFileSync(gameplayDbPath, "db");
  const source = { progressFile: gameplayDbPath, format: "gog-galaxy-sqlite" };

  assert.deepEqual(watchedPathsForSource(source), [
    gameplayDbPath,
    `${gameplayDbPath}-wal`,
    `${gameplayDbPath}-shm`,
  ]);
  const before = gogGameplayRuntimeSignature(gameplayDbPath, []);
  fs.writeFileSync(`${gameplayDbPath}-wal`, "pending transaction");
  const after = gogGameplayRuntimeSignature(gameplayDbPath, []);
  assert.notEqual(after, before);
});
