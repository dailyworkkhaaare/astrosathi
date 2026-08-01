-- Explainability pilot: store the chart facts that back each daily-horoscope
-- reading, so the client can show a "the chart behind this" disclosure.
-- Nullable so existing cached rows keep working without a reasons value.
alter table public.daily_horoscopes
  add column if not exists reasons jsonb;
