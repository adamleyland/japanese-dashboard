create table if not exists public.google_oauth_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  provider text not null default 'google',
  access_token text,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_oauth_tokens enable row level security;

revoke all on public.google_oauth_tokens from anon, authenticated;

drop policy if exists "google_oauth_tokens_deny_all_select" on public.google_oauth_tokens;
drop policy if exists "google_oauth_tokens_deny_all_insert" on public.google_oauth_tokens;
drop policy if exists "google_oauth_tokens_deny_all_update" on public.google_oauth_tokens;
drop policy if exists "google_oauth_tokens_deny_all_delete" on public.google_oauth_tokens;

create policy "google_oauth_tokens_deny_all_select"
on public.google_oauth_tokens
for select
to public
using (false);

create policy "google_oauth_tokens_deny_all_insert"
on public.google_oauth_tokens
for insert
to public
with check (false);

create policy "google_oauth_tokens_deny_all_update"
on public.google_oauth_tokens
for update
to public
using (false)
with check (false);

create policy "google_oauth_tokens_deny_all_delete"
on public.google_oauth_tokens
for delete
to public
using (false);

insert into public.google_oauth_tokens (
  user_id,
  email,
  provider,
  access_token,
  refresh_token,
  created_at,
  updated_at
)
select
  id,
  email,
  'google',
  nullif(google_provider_token, ''),
  nullif(google_provider_refresh_token, ''),
  now(),
  now()
from public.profiles
where nullif(google_provider_token, '') is not null
   or nullif(google_provider_refresh_token, '') is not null
on conflict (user_id) do update
set
  email = excluded.email,
  access_token = coalesce(excluded.access_token, public.google_oauth_tokens.access_token),
  refresh_token = coalesce(excluded.refresh_token, public.google_oauth_tokens.refresh_token),
  updated_at = now();

update public.profiles
set
  google_provider_token = null,
  google_provider_refresh_token = null
where google_provider_token is not null
   or google_provider_refresh_token is not null;
