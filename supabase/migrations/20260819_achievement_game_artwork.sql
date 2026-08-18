alter table public.achievement_games
  add column if not exists hero_artwork_url text,
  add column if not exists logo_artwork_url text;
