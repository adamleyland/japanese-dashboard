const { spawn } = require("node:child_process");
const electronPath = require("electron");
const path = require("node:path");

const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
environment.ACHIEVEMENT_OVERLAY_NODE_PATH = process.execPath;

const child = spawn(electronPath, [path.join(__dirname, "main.cjs"), ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, "..", ".."),
  env: environment,
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
