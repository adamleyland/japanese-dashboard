import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


MODULE_PATH = Path(__file__).with_name("tracker.py")
SPEC = importlib.util.spec_from_file_location("steam_deck_tracker", MODULE_PATH)
TRACKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(TRACKER)


class AchievementParserTests(unittest.TestCase):
    def test_discovers_real_steam_app_id_in_proton_prefix(self):
        with tempfile.TemporaryDirectory() as directory:
            steam_root = Path(directory)
            game_directory = steam_root / "steamapps/compatdata/2272562375/pfx/drive_c/game"
            game_directory.mkdir(parents=True)
            (game_directory / "steam_appid.txt").write_text("3357650\n", encoding="utf-8")
            game = {"shortcutId": "2272562375", "executablePath": ""}
            self.assertEqual(TRACKER.find_actual_steam_app_id(game, steam_root), "3357650")

    def test_parses_common_json_unlocks(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "achievements.json"
            path.write_text(json.dumps({
                "FIRST_WIN": {"earned": True, "earned_time": 1_700_000_000},
                "LOCKED": {"earned": False},
            }), encoding="utf-8")
            updates = TRACKER.parse_json_achievements(path)
            self.assertEqual([item["id"] for item in updates], ["FIRST_WIN"])
            self.assertTrue(updates[0]["unlocked"])

    def test_parses_rune_ini_unlocks(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "achievements.ini"
            path.write_text("""
[SteamAchievements]
0=STORY_START
1=LOCKED
[STORY_START]
Achieved=1
UnlockTime=1700000000
[LOCKED]
Achieved=0
""", encoding="utf-8")
            updates = TRACKER.parse_ini_achievements(path)
            self.assertEqual([item["id"] for item in updates], ["STORY_START"])

    def test_parses_user_stats_unlocks(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "user_stats.ini"
            path.write_text('"ACH_WIN" = { unlocked = true time = 1700000000 }', encoding="utf-8")
            updates = TRACKER.parse_ini_achievements(path)
            self.assertEqual([item["id"] for item in updates], ["ACH_WIN"])

    def test_appends_unlock_events_as_json_lines(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.jsonl"
            events = [{"achievementName": "First Win", "gameTitle": "Example"}]
            TRACKER.append_unlock_events(path, events)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), events[0])


if __name__ == "__main__":
    unittest.main()
