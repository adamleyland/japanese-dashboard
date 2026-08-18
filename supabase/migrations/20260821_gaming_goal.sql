alter table public.profiles
  add column if not exists gaming_goal numeric;

comment on column public.profiles.gaming_goal is
  'User-defined lifetime gaming playtime goal in hours.';
