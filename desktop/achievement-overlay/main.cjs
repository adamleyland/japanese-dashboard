const { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const readline = require("node:readline");

const EVENT_PREFIX = "ACHIEVEMENT_OVERLAY_EVENT:";
const rootDirectory = path.resolve(__dirname, "..", "..");
let overlayWindow = null;
let watcher = null;
let tray = null;

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
if (!app.requestSingleInstanceLock()) app.quit();

function positionOverlay() {
  if (!overlayWindow) return;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
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
  const watcherPath = path.join(rootDirectory, "scripts", "watch-local-achievements.js");
  watcher = spawn(process.env.ACHIEVEMENT_OVERLAY_NODE_PATH || "node", [watcherPath, "--watch"], {
    cwd: rootDirectory,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  readline.createInterface({ input: watcher.stdout }).on("line", (line) => {
    if (!line.startsWith(EVENT_PREFIX)) {
      console.log(line);
      return;
    }
    try {
      showAchievement(JSON.parse(line.slice(EVENT_PREFIX.length)));
    } catch (error) {
      console.error(`Could not read achievement overlay event: ${error.message}`);
    }
  });
  readline.createInterface({ input: watcher.stderr }).on("line", (line) => console.error(line));
  watcher.on("exit", (code) => {
    if (!app.isQuitting && code) console.error(`Achievement watcher stopped with code ${code}.`);
  });
}

ipcMain.on("achievement-overlay-idle", () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
});

app.whenReady().then(() => {
  createOverlayWindow();
  createTray();
  if (process.argv.includes("--demo")) {
    overlayWindow.webContents.once("did-finish-load", () => {
      showAchievement(demoAchievement());
      setTimeout(() => app.quit(), 6500);
    });
  } else {
    overlayWindow.webContents.once("did-finish-load", startWatcher);
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (watcher && !watcher.killed) watcher.kill();
});

app.on("window-all-closed", () => {});
