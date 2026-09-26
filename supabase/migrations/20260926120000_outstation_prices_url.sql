alter table public.mun_editions
  add column if not exists outstation_prices_url text;
