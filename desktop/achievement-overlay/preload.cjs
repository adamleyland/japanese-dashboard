const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("achievementOverlay", {
  onUnlocked(callback) {
    ipcRenderer.on("achievement-unlocked", (_event, payload) => callback(payload));
  },
  idle() {
    ipcRenderer.send("achievement-overlay-idle");
  },
});
