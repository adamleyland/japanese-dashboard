do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'vocabulary_kanji'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'vocab_kanji'
  ) then
    alter table public.shadowing_cards rename column vocabulary_kanji to vocab_kanji;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'vocabulary_furigana'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'vocab_furigana'
  ) then
    alter table public.shadowing_cards rename column vocabulary_furigana to vocab_furigana;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'vocabulary_kana'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'vocab_kana'
  ) then
    alter table public.shadowing_cards rename column vocabulary_kana to vocab_kana;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'vocabulary_english'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'vocab_english'
  ) then
    alter table public.shadowing_cards rename column vocabulary_english to vocab_english;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'vocabulary_audio_url'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'vocab_audio_url'
  ) then
    alter table public.shadowing_cards rename column vocabulary_audio_url to vocab_audio_url;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'vocabulary_pos'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'vocab_pos'
  ) then
    alter table public.shadowing_cards rename column vocabulary_pos to vocab_pos;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'optimized_voc_index'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shadowing_cards'
      and column_name = 'optimized_vocab_index'
  ) then
    alter table public.shadowing_cards rename column optimized_voc_index to optimized_vocab_index;
  end if;
end
$$;

alter table public.shadowing_cards
  add column if not exists is_audio_available boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

update public.shadowing_cards
set
  is_audio_available = sentence_audio_url is not null,
  created_at = coalesce(created_at, now());
