-- Payments ledger; the balance lives in LiteLLM, and txid is the top-up dedup key.

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,                 -- credited user id
  amount      numeric not null,              -- USD added to the balance
  currency    text not null default 'USDT',  -- paid with
  txid        text,                          -- blockchain txid or payment event id
  status      text not null default 'confirmed',
  created_at  timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_txid_idx on public.payments (txid);

-- RLS on with no client policies: backend service key only.
alter table public.payments enable row level security;
