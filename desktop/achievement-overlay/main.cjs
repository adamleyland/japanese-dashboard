const { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const EVENT_PREFIX = "ACHIEVEMENT_OVERLAY_EVENT:";
const rootDirectory = path.resolve(__dirname, "..", "..");
let overlayWindow = null;
let watcher = null;
let watcherRestartTimer = null;
let librarySync = null;
let librarySyncRestartTimer = null;
let tray = null;

const logDirectory = path.join(process.env.LOCALAPPDATA || rootDirectory, "JapaneseDashboard", "AchievementOverlay");
const logPath = path.join(logDirectory, "overlay.log");

function writeLog(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    fs.mkdirSync(logDirectory, { recursive: true });
    fs.appendFileSync(logPath, `${line}\n`, "utf8");
  } catch (error) {
    console.error(`Could not write achievement overlay log: ${error.message}`);
  }
}

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
if (!app.requestSingleInstanceLock()) app.quit();

function positionOverlay() {
  if (!overlayWindow) return;
  const display = screen.getPrimaryDisplay();
  const { x, y, width } = display.workArea;
  const [windowWidth] = overlayWindow.getSize();
  overlayWindow.setPosition(x + width - windowWidth - 4, y + 14, false);
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 452,
    height: 190,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));
  positionOverlay();
}

function createTray() {
  const traySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#111827"/><path d="M11 15v-4a5 5 0 0 1 9.6-1.8M9 15h14v11H9zM16 19v3" fill="none" stroke="#facc15" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(traySvg).toString("base64")}`).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("Japanese Dashboard achievement overlay");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show test notification", click: () => showAchievement(demoAchievement()) },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]));
}

function demoAchievement() {
  return {
    gameTitle: "Stellar Blade™",
    achievementName: "Battlefield Martial Artist",
    description: "Perfect Dodged 200 enemy attacks.",
    iconUrl: "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/3489700/11b8fa54887942e825d88052cafd9ef2f07f32d8.jpg",
    gameArtworkUrl: "https://cdn.akamai.steamstatic.com/steam/apps/3489700/header.jpg",
    rarityPercentage: 12.4,
    unlockedAt: new Date().toISOString(),
  };
}

function showAchievement(payload) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  positionOverlay();
  overlayWindow.showInactive();
  overlayWindow.webContents.send("achievement-unlocked", payload);
}

function startWatcher() {
  if (app.isQuitting || watcher) return;
  const watcherPath = path.join(rootDirectory, "scripts", "watch-local-achievements.js");
  watcher = spawn(process.env.ACHIEVEMENT_OVERLAY_NODE_PATH || "node", [watcherPath, "--watch"], {
    cwd: rootDirectory,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  readline.createInterface({ input: watcher.stdout }).on("line", (line) => {
    if (!line.startsWith(EVENT_PREFIX)) {
      writeLog(line);
      return;
    }
    try {
      showAchievement(JSON.parse(line.slice(EVENT_PREFIX.length)));
    } catch (error) {
      writeLog(`Could not read achievement overlay event: ${error.message}`);
    }
  });
  readline.createInterface({ input: watcher.stderr }).on("line", (line) => writeLog(line));
  watcher.on("error", (error) => writeLog(`Achievement watcher could not start: ${error.message}`));
  watcher.on("close", (code) => {
    watcher = null;
    if (app.isQuitting) return;
    writeLog(`Achievement watcher stopped with code ${code}; restarting in 5 seconds.`);
    clearTimeout(watcherRestartTimer);
    watcherRestartTimer = setTimeout(startWatcher, 5_000);
  });
  writeLog(`Achievement watcher started. Log: ${logPath}`);
}

function startLibrarySync() {
  if (app.isQuitting || librarySync) return;
  const syncPath = path.join(rootDirectory, "scripts", "sync-steam-local-games.js");
  librarySync = spawn(process.env.ACHIEVEMENT_OVERLAY_NODE_PATH || "node", [syncPath, "--watch"], {
    cwd: rootDirectory,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  readline.createInterface({ input: librarySync.stdout }).on("line", (line) => writeLog(line));
  readline.createInterface({ input: librarySync.stderr }).on("line", (line) => writeLog(line));
  librarySync.on("error", (error) => writeLog(`Steam shortcut sync could not start: ${error.message}`));
  librarySync.on("close", (code) => {
    librarySync = null;
    if (app.isQuitting) return;
    writeLog(`Steam shortcut sync stopped with code ${code}; restarting in 15 seconds.`);
    clearTimeout(librarySyncRestartTimer);
    librarySyncRestartTimer = setTimeout(startLibrarySync, 15_000);
  });
  writeLog("Steam shortcut title sync started.");
}

function startCompanions() {
  startWatcher();
  startLibrarySync();
}

ipcMain.on("achievement-overlay-idle", () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
});

app.whenReady().then(() => {
  createOverlayWindow();
  screen.on("display-metrics-changed", positionOverlay);
  createTray();
  if (process.argv.includes("--demo")) {
    overlayWindow.webContents.once("did-finish-load", () => {
      showAchievement(demoAchievement());
      setTimeout(() => app.quit(), 6500);
    });
  } else {
    overlayWindow.webContents.once("did-finish-load", startCompanions);
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  clearTimeout(watcherRestartTimer);
  clearTimeout(librarySyncRestartTimer);
  if (watcher && !watcher.killed) watcher.kill();
  if (librarySync && !librarySync.killed) librarySync.kill();
});

app.on("window-all-closed", () => {});
