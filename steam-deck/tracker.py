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

ACHIEVEMENT_FILENAMES = {"achievements.json", "achievements.ini", "user_stats.ini"}
SKIPPED_DIRECTORIES = {"audio", "content", "localization", "movies", "paks", "redist", "textures"}


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
                return shortcuts, localconfig, root
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


def clean_executable_path(value):
    return str(value or "").strip().strip('"')


def achievement_roots(game, steam_root):
    shortcut_id = game["shortcutId"]
    executable = Path(clean_executable_path(game.get("executablePath")))
    roots = [steam_root / "steamapps/compatdata" / shortcut_id / "pfx"]
    if executable.is_file():
        roots.append(executable.parent)
    return [root for root in roots if root.is_dir()]


def find_achievement_files(game, steam_root):
    matches = []
    visited = set()
    for root in achievement_roots(game, steam_root):
        for directory, child_directories, filenames in os.walk(root):
            child_directories[:] = [
                name for name in child_directories
                if name.lower() not in SKIPPED_DIRECTORIES
            ]
            for filename in filenames:
                if filename.lower() not in ACHIEVEMENT_FILENAMES:
                    continue
                candidate = Path(directory) / filename
                key = str(candidate.resolve())
                if key not in visited:
                    visited.add(key)
                    matches.append(candidate)
                if len(matches) >= 50:
                    return matches
    return matches


def iso_from_timestamp(value):
    try:
        timestamp = float(value)
    except (TypeError, ValueError):
        timestamp = 0
    if timestamp > 10_000_000_000:
        timestamp /= 1000
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(timestamp)) if timestamp > 0 else None


def unlocked_state(value):
    return value is True or value == 1 or str(value or "").lower() in {"1", "true", "yes"}


def parse_json_achievements(path):
    data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    if isinstance(data, list):
        entries = [(item.get("id") or item.get("name") or item.get("AchievementId"), item)
                   for item in data if isinstance(item, dict)]
    elif isinstance(data, dict):
        entries = list(data.items())
    else:
        return []
    updates = []
    for achievement_id, state in entries:
        if not achievement_id or not isinstance(state, dict):
            continue
        timestamp = (state.get("earned_time") or state.get("earnedTime") or
                     state.get("unlock_time") or state.get("UnlockTime") or
                     state.get("unlockTime") or state.get("timestamp") or state.get("time"))
        unlocked = any(unlocked_state(state.get(key)) for key in
                       ("earned", "achieved", "Achieved", "unlocked", "Unlocked"))
        unlocked_at = iso_from_timestamp(timestamp)
        if unlocked or unlocked_at:
            updates.append({"id": str(achievement_id), "unlocked": True, "unlockedAt": unlocked_at})
    return updates


def parse_ini_sections(contents):
    sections = {}
    current = None
    for raw_line in contents.splitlines():
        line = raw_line.strip()
        heading = re.match(r"^\[([^]]+)\]$", line)
        if heading:
            current = heading.group(1)
            sections.setdefault(current, {})
            continue
        if current and "=" in line:
            key, value = line.split("=", 1)
            sections[current][key.strip().lower()] = value.strip().strip('"')
    return sections


def parse_ini_achievements(path):
    contents = path.read_text(encoding="utf-8", errors="replace")
    updates = []
    sections = parse_ini_sections(contents)
    indexed_ids = [value for key, value in sections.get("SteamAchievements", {}).items() if key.isdigit()]
    candidates = indexed_ids or list(sections.keys())
    for achievement_id in candidates:
        state = sections.get(achievement_id, {})
        if not unlocked_state(state.get("achieved") or state.get("unlocked")):
            continue
        updates.append({
            "id": achievement_id,
            "unlocked": True,
            "unlockedAt": iso_from_timestamp(state.get("unlocktime") or state.get("time")),
        })
    if updates:
        return updates
    for match in re.finditer(r'"([^"]+)"\s*=\s*\{([^}]*)\}', contents, re.DOTALL):
        if not re.search(r"\bunlocked\s*=\s*true\b", match.group(2), re.IGNORECASE):
            continue
        timestamp = re.search(r"\btime\s*=\s*(\d+)", match.group(2), re.IGNORECASE)
        updates.append({
            "id": match.group(1),
            "unlocked": True,
            "unlockedAt": iso_from_timestamp(timestamp.group(1) if timestamp else None),
        })
    return updates


def collect_achievement_updates(game, steam_root):
    updates = {}
    files = find_achievement_files(game, steam_root)
    for path in files:
        try:
            parsed = parse_json_achievements(path) if path.suffix.lower() == ".json" else parse_ini_achievements(path)
        except (OSError, ValueError, json.JSONDecodeError):
            continue
        for achievement in parsed:
            updates[achievement["id"]] = achievement
    return list(updates.values()), files


def sync(endpoint, token, games):
    request = urllib.request.Request(
        endpoint.rstrip("/") + "/api/gaming/steam-deck/sync",
        data=json.dumps({"games": games}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def sync_achievements(endpoint, token, game, achievements):
    request = urllib.request.Request(
        endpoint.rstrip("/") + "/api/gaming/achievements/ingest",
        data=json.dumps({
            "source": "steam-deck",
            "gameId": f"steam-deck-shortcut:{game['shortcutId']}",
            "achievements": achievements,
        }).encode("utf-8"),
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

    achievement_signatures = {}
    while True:
        try:
            shortcuts, localconfig, steam_root = steam_files()
            games = collect_games(shortcuts, localconfig)
            if args.print_only:
                print(json.dumps(games, indent=2))
                return
            result = sync(endpoint, token, games)
            print(f"Synced {result.get('synced', 0)} Steam Deck game(s).", flush=True)
            achievement_count = 0
            for game in games:
                achievements, files = collect_achievement_updates(game, steam_root)
                if not achievements:
                    continue
                signature = tuple(sorted(
                    (str(path), path.stat().st_mtime_ns, path.stat().st_size)
                    for path in files if path.exists()
                ))
                if achievement_signatures.get(game["shortcutId"]) == signature:
                    continue
                try:
                    achievement_result = sync_achievements(endpoint, token, game, achievements)
                    achievement_count += achievement_result.get("updated", 0)
                    achievement_signatures[game["shortcutId"]] = signature
                except urllib.error.HTTPError as error:
                    detail = error.read().decode("utf-8", errors="replace")
                    print(f"Achievement sync skipped for {game['name']}: {error.code} {detail}", flush=True)
            if achievement_count:
                print(f"Synced {achievement_count} Steam Deck achievement unlock(s).", flush=True)
        except (OSError, ValueError, urllib.error.URLError) as error:
            detail = ""
            if isinstance(error, urllib.error.HTTPError):
                try:
                    detail = error.read().decode("utf-8", errors="replace")
                except OSError:
                    pass
            print(f"Steam Deck sync failed: {error}{': ' + detail if detail else ''}", flush=True)
            if args.once or args.print_only:
                raise SystemExit(1)
        if args.once:
            return
        time.sleep(max(30, args.interval))


if __name__ == "__main__":
    main()
