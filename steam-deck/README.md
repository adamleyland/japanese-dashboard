# Steam Deck non-Steam game tracking

This companion reads the playtime Steam stores locally for non-Steam shortcuts and syncs it to the dashboard every 60 seconds. It starts automatically with the Deck user session and does not handle save files.

## Dashboard setup

Add these server-side environment variables to the deployed dashboard:

```env
STEAM_DECK_SYNC_TOKEN=<a-long-random-secret>
LOCAL_GAMES_USER_ID=<your-supabase-user-id>
```

Generate a token with `openssl rand -hex 32`. Deploy the dashboard after adding the variables.

## Steam Deck setup

1. In Desktop Mode, add each non-Steam game to Steam and launch it once.
2. Download or clone this repository onto the Deck.
3. Open Konsole in the repository and run `bash steam-deck/install.sh`.
4. Enter the deployed dashboard URL and the same sync token when prompted.

## Updating an existing installation

Download the latest `install.sh` and `tracker.py` into the same folder, then run:

```bash
bash install.sh --update
```

The update keeps the saved dashboard URL and token, replaces the tracker, and restarts the service.

## Achievements

The same service scans each non-Steam shortcut's Proton prefix and game directory for its real Steam AppID plus common local `achievements.json`, `achievements.ini`, and `user_stats.ini` formats. Recognised definitions and unlocks sync automatically. For an unusual installation, open the game's dashboard settings and enter its Steam AppID manually; a separate title override is available for display and fallback matching. Games that use a proprietary or cloud-only achievement store still retain playtime tracking and achievement definitions, but their unlock state may need a format-specific adapter.

### Gaming Mode achievement notifications

After installing Decky Loader, install the Japanese Dashboard plugin:

```bash
curl -fsSL https://raw.githubusercontent.com/adamleyland/japanese-dashboard/main/steam-deck/install-decky-plugin.sh | bash
```

Update the tracker so it can forward newly confirmed unlocks to Decky:

```bash
cd ~/japanese-dashboard-tracker
curl -fLO https://raw.githubusercontent.com/adamleyland/japanese-dashboard/main/steam-deck/tracker.py
curl -fLO https://raw.githubusercontent.com/adamleyland/japanese-dashboard/main/steam-deck/install.sh
bash install.sh --update
```

Return to Gaming Mode and open **Decky → Japanese Dashboard Achievements → Show test notification**. Existing achievements are not replayed; notifications are created only when the dashboard confirms a new locked-to-unlocked transition.

Verify the service with:

```bash
systemctl --user status japanese-dashboard-steam-deck.service
journalctl --user -u japanese-dashboard-steam-deck.service -f
```

The games appear under the **Deck** filter in Gaming. Steam Deck totals count toward Gaming; the older hidden desktop-local records remain hidden and uncounted.
