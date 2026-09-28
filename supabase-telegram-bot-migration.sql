-- Version 1.0 — supabase-telegram-bot-migration.sql
--
-- Insider Alerts Telegram bot (app/api/telegram-bot/webhook/route.ts):
-- maps a Telegram chat/user id to an existing api_keys row, so the bot
-- reuses the SAME tier/quota/billing system as the HTTP API instead of
-- a parallel one. Already applied directly to production for this
-- project (2026-09-29) — kept here for reference / re-deploys elsewhere,
-- same convention as the other supabase-*-migration.sql files in this
-- repo root.

create table if not exists telegram_bot_links (
  telegram_id bigint primary key,
  api_key_id uuid not null references api_keys(id) on delete cascade,
  linked_at timestamptz not null default now(),
  last_check_at timestamptz
);

create index if not exists telegram_bot_links_api_key_id_idx
  on telegram_bot_links (api_key_id);

alter table telegram_bot_links enable row level security;
-- No anon policies on purpose, same posture as api_keys — only the
-- service-role client (supabaseAdmin) touches this table.
