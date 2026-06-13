create table if not exists public.preferred_youtube_videos (
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null,
  channel_id text,
  title text,
  channel text,
  liked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create index if not exists preferred_youtube_videos_user_liked_at_idx
on public.preferred_youtube_videos (user_id, liked_at desc);

grant select, insert, update, delete on table public.preferred_youtube_videos to authenticated;

alter table public.preferred_youtube_videos enable row level security;

drop policy if exists "preferred_youtube_videos_select_own" on public.preferred_youtube_videos;
drop policy if exists "preferred_youtube_videos_insert_own" on public.preferred_youtube_videos;
drop policy if exists "preferred_youtube_videos_update_own" on public.preferred_youtube_videos;
drop policy if exists "preferred_youtube_videos_delete_own" on public.preferred_youtube_videos;

create policy "preferred_youtube_videos_select_own"
on public.preferred_youtube_videos
for select
to authenticated
using (auth.uid() = user_id);

create policy "preferred_youtube_videos_insert_own"
on public.preferred_youtube_videos
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "preferred_youtube_videos_update_own"
on public.preferred_youtube_videos
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "preferred_youtube_videos_delete_own"
on public.preferred_youtube_videos
for delete
to authenticated
using (auth.uid() = user_id);
