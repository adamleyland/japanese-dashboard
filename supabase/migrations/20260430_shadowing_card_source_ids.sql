alter table public.shadowing_cards
  add column if not exists original_card_id text,
  add column if not exists original_note_id text;

create index if not exists shadowing_cards_deck_original_card_id_idx
  on public.shadowing_cards (deck_id, original_card_id);

create index if not exists shadowing_cards_deck_original_note_id_idx
  on public.shadowing_cards (deck_id, original_note_id);
