create table if not exists public.writing_grammar_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.writing_entries(id) on delete cascade,
  grammar_point_id text not null,
  grammar_level text not null check (grammar_level in ('N5', 'N4', 'N3', 'N2', 'N1')),
  source text not null default 'prompted' check (source in ('prompted', 'detected')),
  attempted boolean not null default false,
  used boolean not null default false,
  quality_score smallint not null default 0 check (quality_score between 0 and 100),
  correctness_score smallint not null default 0 check (correctness_score between 0 and 100),
  naturalness_score smallint not null default 0 check (naturalness_score between 0 and 100),
  evidence text,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_id, grammar_point_id)
);

create index if not exists writing_grammar_attempts_user_id_idx
  on public.writing_grammar_attempts (user_id, updated_at desc);

create index if not exists writing_grammar_attempts_point_idx
  on public.writing_grammar_attempts (user_id, grammar_point_id);

alter table public.writing_grammar_attempts enable row level security;

drop policy if exists "Users can read their grammar attempts" on public.writing_grammar_attempts;
create policy "Users can read their grammar attempts"
  on public.writing_grammar_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their grammar attempts" on public.writing_grammar_attempts;
create policy "Users can insert their grammar attempts"
  on public.writing_grammar_attempts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their grammar attempts" on public.writing_grammar_attempts;
create policy "Users can update their grammar attempts"
  on public.writing_grammar_attempts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their grammar attempts" on public.writing_grammar_attempts;
create policy "Users can delete their grammar attempts"
  on public.writing_grammar_attempts for delete
  using (auth.uid() = user_id);

