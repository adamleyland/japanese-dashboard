#!/usr/bin/env python3
"""Background Steam Deck playtime sync for non-Steam shortcuts."""

import argparse
import json
import os
from pathlib import Path
import re
import struct
import time
import urllib.error
import urllib.request


def load_env(path):
    values = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def read_cstring(data, offset):
    end = data.index(b"\0", offset)
    return data[offset:end].decode("utf-8", errors="replace"), end + 1


def parse_binary_object(data, offset=0):
    result = {}
    while offset < len(data):
        value_type = data[offset]
        offset += 1
        if value_type == 0x08:
            return result, offset
        key, offset = read_cstring(data, offset)
        if value_type == 0x00:
            result[key], offset = parse_binary_object(data, offset)
        elif value_type == 0x01:
            result[key], offset = read_cstring(data, offset)
        elif value_type == 0x02:
            result[key] = struct.unpack_from("<i", data, offset)[0]
            offset += 4
        else:
            raise ValueError(f"Unsupported shortcuts.vdf value type {value_type}")
    raise ValueError("Invalid shortcuts.vdf")


def parse_shortcuts(path):
    root, _ = parse_binary_object(path.read_bytes())
    return list((root.get("shortcuts") or {}).values())


TOKEN_PATTERN = re.compile(r'"((?:\\.|[^"\\])*)"|([{}])')


def parse_text_vdf(path):
    text = path.read_text(encoding="utf-8", errors="replace")
    tokens = [(match.group(2) or match.group(1).replace('\\"', '"').replace("\\\\", "\\"))
              for match in TOKEN_PATTERN.finditer(text)]

    def parse_object(index):
        result = {}
        while index < len(tokens) and tokens[index] != "}":
            key = tokens[index]
            value = tokens[index + 1]
            index += 2
            if value == "{":
                value, index = parse_object(index)
            result[key] = value
        return result, index + 1

    if len(tokens) < 2 or tokens[1] != "{":
        raise ValueError("Invalid localconfig.vdf")
    result, _ = parse_object(2)
    return result


def steam_files():
    configured = os.environ.get("STEAM_ROOT", "").strip()
    home = Path.home()
    roots = [
        Path(configured) if configured else None,
        home / ".local/share/Steam",
        home / ".steam/steam",
        home / ".var/app/com.valvesoftware.Steam/.local/share/Steam",
    ]
    for root in filter(None, roots):
        userdata = root / "userdata"
        if not userdata.is_dir():
            continue
        for account in userdata.iterdir():
            shortcuts = account / "config/shortcuts.vdf"
            localconfig = account / "config/localconfig.vdf"
            if shortcuts.is_file() and localconfig.is_file():
                return shortcuts, localconfig
    raise FileNotFoundError("Steam shortcuts.vdf was not found. Add a non-Steam game to Steam first.")


def unsigned_app_id(value):
    return int(value) & 0xFFFFFFFF


def collect_games(shortcuts_path, localconfig_path):
    shortcuts = parse_shortcuts(shortcuts_path)
    config = parse_text_vdf(localconfig_path)
    apps = (((config.get("Software") or {}).get("Valve") or {}).get("Steam") or {}).get("apps") or {}
    games = []
    for shortcut in shortcuts:
        signed_id = int(shortcut.get("appid", 0))
        app_id = unsigned_app_id(signed_id)
        record = apps.get(str(signed_id), apps.get(str(app_id), {}))
        minutes = max(0, int(float(record.get("Playtime", 0) or 0)))
        last_played = int(shortcut.get("LastPlayTime", 0) or 0)
        games.append({
            "shortcutId": str(app_id),
            "name": str(shortcut.get("AppName") or "Untitled Steam shortcut").strip(),
            "totalPlaytimeSeconds": minutes * 60,
            "lastPlayedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(last_played)) if last_played else None,
            "executablePath": str(shortcut.get("Exe") or ""),
            "startDirectory": str(shortcut.get("StartDir") or ""),
        })
    return [game for game in games if game["name"]]


def sync(endpoint, token, games):
    request = urllib.request.Request(
        endpoint.rstrip("/") + "/api/gaming/steam-deck/sync",
        data=json.dumps({"games": games}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Sync once and exit")
    parser.add_argument("--print", dest="print_only", action="store_true", help="Print detected games without syncing")
    parser.add_argument("--interval", type=int, default=60)
    parser.add_argument("--config", type=Path, default=Path.home() / ".config/japanese-dashboard/steam-deck.env")
    args = parser.parse_args()
    settings = load_env(args.config)
    endpoint = settings.get("DASHBOARD_URL", "")
    token = settings.get("STEAM_DECK_SYNC_TOKEN", "")
    if not args.print_only and (not endpoint or not token):
        raise SystemExit(f"Set DASHBOARD_URL and STEAM_DECK_SYNC_TOKEN in {args.config}")

    while True:
        try:
            shortcuts, localconfig = steam_files()
            games = collect_games(shortcuts, localconfig)
            if args.print_only:
                print(json.dumps(games, indent=2))
                return
            result = sync(endpoint, token, games)
            print(f"Synced {result.get('synced', 0)} Steam Deck game(s).", flush=True)
        except (OSError, ValueError, urllib.error.URLError) as error:
            print(f"Steam Deck sync failed: {error}", flush=True)
            if args.once or args.print_only:
                raise SystemExit(1)
        if args.once:
            return
        time.sleep(max(30, args.interval))


if __name__ == "__main__":
    main()
