#!/usr/bin/env bash
set -euo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install it in Steam Deck Desktop Mode, then rerun this installer."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$HOME/.local/share/japanese-dashboard"
CONFIG_DIR="$HOME/.config/japanese-dashboard"
SERVICE_DIR="$HOME/.config/systemd/user"

mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$SERVICE_DIR"
install -m 755 "$SCRIPT_DIR/tracker.py" "$INSTALL_DIR/steam-deck-tracker.py"

if [[ "${1:-}" != "--update" || ! -s "$CONFIG_DIR/steam-deck.env" ]]; then
  read -r -p "Dashboard URL (for example https://dashboard.example.com): " DASHBOARD_URL
  read -r -s -p "Steam Deck sync token: " STEAM_DECK_SYNC_TOKEN
  echo
  printf 'DASHBOARD_URL=%s\nSTEAM_DECK_SYNC_TOKEN=%s\n' "$DASHBOARD_URL" "$STEAM_DECK_SYNC_TOKEN" > "$CONFIG_DIR/steam-deck.env"
  chmod 600 "$CONFIG_DIR/steam-deck.env"
else
  echo "Keeping the existing dashboard URL and sync token."
fi

cat > "$SERVICE_DIR/japanese-dashboard-steam-deck.service" <<EOF
[Unit]
Description=Japanese Dashboard Steam Deck playtime tracker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/env python3 $INSTALL_DIR/steam-deck-tracker.py
Restart=always
RestartSec=20

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now japanese-dashboard-steam-deck.service
echo "Steam Deck tracking is installed and running."
echo "Status: systemctl --user status japanese-dashboard-steam-deck.service"
echo "Logs:   journalctl --user -u japanese-dashboard-steam-deck.service -f"
