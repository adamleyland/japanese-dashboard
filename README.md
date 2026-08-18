This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Gaming achievement sync

Apply the Supabase migrations in filename order before using achievement sync. Progress, unlock timestamps, rarity, gamerscore, provider mappings, and local-companion unlock events are stored in Supabase.

Configure the providers you use in `.env.local`:

```dotenv
STEAM_API_KEY=
STEAM_USER_ID=
XBL_API_KEY=
XBL_XUID=
STEAMGRIDDB_API_KEY=

# Used by the local Windows achievement companion ingestion endpoint.
LOCAL_GAMES_USER_ID=
LOCAL_ACHIEVEMENT_SYNC_SECRET=
```

Steam and Xbox achievement progress is refreshed automatically when a game is opened in the dashboard and cached for 30 minutes. Local non-Steam shortcuts use compatible Steam achievement definitions when available. The Windows companion detects local progress and persists it to the dashboard's Supabase tables; it never modifies the game, its saves, or a platform profile. The ingestion endpoint remains available for future companion clients that use `LOCAL_ACHIEVEMENT_SYNC_SECRET`.

For local games that write `SteamData/user_stats.ini` beside the executable, or RUNE-style progress under `%PUBLIC%/Documents/Steam/RUNE/<appid>/achievements.ini`, scan once with `npm run sync:local-achievements` or run the read-only watcher with `npm run watch:local-achievements`. When compatible local Steam metadata is present, the watcher imports achievement names, descriptions, and icon URLs from either the local metadata or the configured Steam API. The hidden Windows launcher is `scripts/run-local-achievement-watcher.vbs`.
