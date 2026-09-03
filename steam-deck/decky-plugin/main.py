import asyncio
import json
import os
from pathlib import Path

import decky


class Plugin:
    async def _main(self):
        self.running = True
        self.event_path = Path(decky.DECKY_USER_HOME) / ".local/share/japanese-dashboard/achievement-events.jsonl"
        self.offset = self.event_path.stat().st_size if self.event_path.exists() else 0
        self.task = asyncio.create_task(self.watch_events())

    async def watch_events(self):
        while self.running:
            try:
                if self.event_path.exists():
                    size = self.event_path.stat().st_size
                    if size < self.offset:
                        self.offset = 0
                    if size > self.offset:
                        with self.event_path.open("r", encoding="utf-8") as stream:
                            stream.seek(self.offset)
                            for line in stream:
                                try:
                                    await decky.emit("achievement_unlocked", json.loads(line))
                                except json.JSONDecodeError:
                                    decky.logger.warning("Ignored an invalid achievement event")
                            self.offset = stream.tell()
            except OSError as error:
                decky.logger.warning("Could not read achievement events: %s", error)
            await asyncio.sleep(1)

    async def test_notification(self):
        await decky.emit("achievement_unlocked", {
            "achievementName": "Battlefield Martial Artist",
            "gameTitle": "Japanese Dashboard",
            "rarityPercentage": 12.4,
            "iconUrl": "",
        })

    async def _unload(self):
        self.running = False
        if hasattr(self, "task"):
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
