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


if __name__ == "__main__":
    unittest.main()
