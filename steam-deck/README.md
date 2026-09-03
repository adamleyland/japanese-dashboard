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

Verify the service with:

```bash
systemctl --user status japanese-dashboard-steam-deck.service
journalctl --user -u japanese-dashboard-steam-deck.service -f
```

The games appear under the **Deck** filter in Gaming. Steam Deck totals count toward Gaming; the older hidden desktop-local records remain hidden and uncounted.
