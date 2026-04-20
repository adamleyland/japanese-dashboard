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

do $$
declare
  has_public_table boolean;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'google_oauth_tokens'
  )
  into has_public_table;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'private'
      and table_name = 'google_oauth_tokens'
  ) then
    if not has_public_table then
      execute format('alter table %I.%I set schema public', 'private', 'google_oauth_tokens');
    else
      execute format(
        'insert into public.google_oauth_tokens (
          user_id,
          email,
          provider,
          access_token,
          refresh_token,
          token_type,
          scope,
          expires_at,
          created_at,
          updated_at
        )
        select
          user_id,
          email,
          provider,
          access_token,
          refresh_token,
          token_type,
          scope,
          expires_at,
          created_at,
          updated_at
        from %I.%I
        on conflict (user_id) do update
        set
          email = excluded.email,
          provider = excluded.provider,
          access_token = coalesce(excluded.access_token, public.google_oauth_tokens.access_token),
          refresh_token = coalesce(excluded.refresh_token, public.google_oauth_tokens.refresh_token),
          token_type = coalesce(excluded.token_type, public.google_oauth_tokens.token_type),
          scope = coalesce(excluded.scope, public.google_oauth_tokens.scope),
          expires_at = coalesce(excluded.expires_at, public.google_oauth_tokens.expires_at),
          updated_at = now()',
        'private',
        'google_oauth_tokens'
      );

      execute format('drop table %I.%I', 'private', 'google_oauth_tokens');
    end if;
  end if;
end $$;

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
