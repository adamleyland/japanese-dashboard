"use client";
import { useEffect, useState } from "react";
export function useGameArtwork(game) {
  const cacheKey = game?.source && game?.sourceGameId ? `jp_game_artwork:${game.source}:${game.sourceGameId}` : "";
  const [artwork, setArtwork] = useState(() => {
    if (typeof window === "undefined" || !cacheKey) return { heroArtworkUrl: null, logoArtworkUrl: null };
    try { return JSON.parse(window.sessionStorage.getItem(cacheKey)) || { heroArtworkUrl: null, logoArtworkUrl: null }; } catch { return { heroArtworkUrl: null, logoArtworkUrl: null }; }
  });
  useEffect(() => { if (!game?.source || !game?.sourceGameId || !game?.title) return; let active = true; const search = new URLSearchParams({ provider: game.source, gameId: game.sourceGameId, title: game.title }); fetch(`/api/gaming/artwork?${search}`, { cache: "no-store" }).then((response) => response.json().then((payload) => ({ response, payload }))).then(({ response, payload }) => { if (!active || !response.ok) return; const next = { heroArtworkUrl: payload.heroArtworkUrl || null, logoArtworkUrl: payload.logoArtworkUrl || null }; setArtwork(next); try { window.sessionStorage.setItem(cacheKey, JSON.stringify(next)); } catch {} }).catch(() => {}); return () => { active = false; }; }, [cacheKey, game?.source, game?.sourceGameId, game?.title]);
  return artwork;
}
