#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_RAW="https://raw.githubusercontent.com/adamleyland/japanese-dashboard/main/steam-deck/decky-plugin"
PLUGIN_DIR="/home/deck/homebrew/plugins/JapaneseDashboardAchievements"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

mkdir -p "$TEMP_DIR/dist"
for file in plugin.json package.json main.py LICENSE; do
  curl -fsSL "$REPOSITORY_RAW/$file" -o "$TEMP_DIR/$file"
done
curl -fsSL "$REPOSITORY_RAW/dist/index.js" -o "$TEMP_DIR/dist/index.js"

sudo mkdir -p "$PLUGIN_DIR/dist"
sudo install -m 644 "$TEMP_DIR/plugin.json" "$TEMP_DIR/package.json" "$TEMP_DIR/main.py" "$TEMP_DIR/LICENSE" "$PLUGIN_DIR/"
sudo install -m 644 "$TEMP_DIR/dist/index.js" "$PLUGIN_DIR/dist/index.js"
sudo chown -R deck:deck "$PLUGIN_DIR"
sudo systemctl restart plugin_loader.service

echo "Japanese Dashboard achievement notifications installed."
echo "Return to Gaming Mode, open Decky, then use Show test notification."
