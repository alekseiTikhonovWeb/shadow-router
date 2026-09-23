# Supabase — schema migrations (SHAD-35)

The schema of our mapping table is managed by **Supabase CLI migrations**, not edited by hand.
A schema change = a new file in `supabase/migrations/`, versioned in git, shipped through CI.

## Structure
- `migrations/<timestamp>_*.sql` — migrations in order. Current: `..._init_user_accounts.sql`.
- `config.toml` — project config (the CLI fills it in on `link`).

## Applying (done by a human — touches your Supabase)
```bash
# 1. install the CLI (once)
brew install supabase/tap/supabase

# 2. link the repo to the cloud project (requires a Supabase access token / project ref)
supabase login
supabase link --project-ref <project-ref>   # ref is shown in Dashboard → Project Settings

# 3. apply migrations to the DB
supabase db push
```
The first migration is idempotent (`IF NOT EXISTS`) — on an already manually created `user_accounts`
it applies as a **no-op** and breaks nothing.

## How to add further schema changes
```bash
supabase migration new <name>     # creates an empty file in migrations/
# write your ALTER/CREATE ... there
supabase db push                  # applies it
```
No manual edits in the Dashboard — migrations only (that way they are reproducible and go through CI).

## Connection pooling — status
Currently the backend talks to Supabase via **REST (PostgREST)** and **opens no direct Postgres connections**;
the pool is held by PostgREST on the Supabase side → **we do not need a pooler yet**.

If/when direct DB access appears (psycopg/SQLAlchemy), use the **Supabase pooler**
(transaction mode), connection string of the form:
```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```
(port **6543** = pooler; 5432 = direct connection). Then FastAPI will not hit the connection limit.
