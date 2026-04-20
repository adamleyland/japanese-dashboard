with ranked_google_oauth_tokens as (
  select
    ctid,
    row_number() over (
      partition by user_id
      order by updated_at desc nulls last, created_at desc nulls last, ctid desc
    ) as row_rank
  from public.google_oauth_tokens
  where user_id is not null
)
delete from public.google_oauth_tokens tokens
using ranked_google_oauth_tokens ranked
where tokens.ctid = ranked.ctid
  and ranked.row_rank > 1;

delete from public.google_oauth_tokens
where user_id is null;

alter table public.google_oauth_tokens
alter column user_id set not null;

do $$
declare
  user_id_attnum smallint;
begin
  select attnum
  into user_id_attnum
  from pg_attribute
  where attrelid = 'public.google_oauth_tokens'::regclass
    and attname = 'user_id'
    and not attisdropped;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.google_oauth_tokens'::regclass
      and contype in ('p', 'u')
      and conkey = array[user_id_attnum]
  ) then
    alter table public.google_oauth_tokens
    add constraint google_oauth_tokens_user_id_key unique (user_id);
  end if;
end $$;
