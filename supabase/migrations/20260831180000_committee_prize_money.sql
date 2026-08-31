alter table public.committees
  add column if not exists prize_money_json jsonb not null default '[]'::jsonb,
  add column if not exists show_prize_money boolean not null default false;
