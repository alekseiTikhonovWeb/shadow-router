-- user <-> litellm_account <-> keys mapping; the balance is not stored here.
-- IF NOT EXISTS: no-op on a table created by hand.

create table if not exists public.user_accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null unique,          -- external user id; our own column, so no IdP lock-in
  litellm_user_id text not null,                 -- LiteLLM account (single balance)
  chat_key        text not null,                 -- LibreChat key
  dev_key         text not null,                 -- key for Cursor / tools
  created_at      timestamptz not null default now()
);

-- RLS on with no client policies: keys are reachable only via service_role.
alter table public.user_accounts enable row level security;
