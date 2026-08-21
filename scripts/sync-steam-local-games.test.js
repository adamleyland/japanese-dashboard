const assert = require("node:assert/strict");
const test = require("node:test");

const {
  findExistingLocalGame,
  normalizedExecutablePath,
} = require("./sync-steam-local-games.js");

test("matches a renamed Steam shortcut to its existing executable", () => {
  const existing = {
    client_game_id: "steam-shortcut:old-id",
    game_name: "FinchGame",
    metadata: {
      executable_path: '"C:\\Games\\What Remains of Edith Finch\\FinchGame.exe"',
    },
  };
  const renamed = {
    client_game_id: "steam-shortcut:new-id",
    game_name: "What Remains of Edith Finch",
    metadata: {
      executable_path: '"C:\\Games\\What Remains of Edith Finch\\FinchGame.exe"',
    },
  };
  const byExecutable = new Map([
    [normalizedExecutablePath(existing.metadata.executable_path), existing],
  ]);

  assert.equal(findExistingLocalGame(renamed, new Map(), byExecutable), existing);
});

test("prefers an exact shortcut identity when one exists", () => {
  const exact = { client_game_id: "steam-shortcut:123" };
  const executableMatch = { client_game_id: "steam-shortcut:older" };
  const game = {
    client_game_id: "steam-shortcut:123",
    metadata: { executable_path: "C:\\Games\\Example\\game.exe" },
  };

  assert.equal(findExistingLocalGame(
    game,
    new Map([[game.client_game_id, exact]]),
    new Map([[normalizedExecutablePath(game.metadata.executable_path), executableMatch]]),
  ), exact);
});
