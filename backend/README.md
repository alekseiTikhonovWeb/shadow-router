# ShadowRouter backend (control plane)

FastAPI provisioning service. **Off the hot path** — called only on sign-up/provisioning,
not on every chat request. Money path: creates the LiteLLM account + keys; the budget is reviewed by a human.

## Endpoints
- `GET /health` → `{status, supabase, start_budget}`
- `POST /provision` `{ "user_id": "<email|uuid>" }` →
  creates a LiteLLM account (`max_budget=START_BUDGET`) + 2 keys (chat, dev) with rpm/tpm,
  writes the mapping to Supabase, returns both keys. Repeat call → `409` (idempotent).
- `POST /topup` `{ "user_id", "amount", "event_id" }` →
  raises the single balance (`user.max_budget += amount`). **Idempotent by `event_id`**:
  a repeated webhook for the same payment will not double the balance (`status: already_processed`).
  The payment provider itself (who verifies the payment and calls `/topup`) comes later, SHAD-19/21.
- `POST /hooks/logto` (SHAD-47) → **auto-provisioning via Logto webhook**. On sign-up
  (`User.Created`) Logto sends an event here; we verify the **Logto signature** (HMAC-SHA256 over the raw body,
  header `logto-signature-sha-256`, key `LOGTO_WEBHOOK_SIGNING_KEY`) → take the email → provision.
  Idempotent: repeat → `already_provisioned`. Non-`User.Created` events are ignored. Bad signature → `401`.

## Tests (SHAD-39 — money path)
Unit tests with mocked external calls (LiteLLM/Supabase), no real stack needed → suitable for CI.
```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest -q          # from the backend/ directory
```
Covered: provisioning (account + exactly 2 keys, budget 0, 409 idempotency), top-up
(`max_budget += amount`, no double-counting by event_id), markup (prices in config = cost × MARKUP).

## Before running (done by a human)
1. Put `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` into the root `.env` (service_key — handled only by you).
2. Create the `user_accounts` table via Supabase CLI migrations — see `supabase/README.md` (`supabase db push`). The schema lives in `supabase/migrations/` and is not edited by hand.

## Run / verify
Host port is **8088** (8000 was taken). `/provision` and `/topup` require the
`X-Internal-Token` header = `INTERNAL_API_TOKEN` from `.env` (SHAD-43). `/health` is public.
```bash
docker compose up -d backend
curl localhost:8088/health
curl -X POST localhost:8088/provision \
     -H 'Content-Type: application/json' \
     -H "X-Internal-Token: $INTERNAL_API_TOKEN" \
     -d '{"user_id":"test@demo.io"}'
```
Without a token / with a wrong one → `401`.

## Auto-provisioning via Logto webhook (SHAD-47)
So that sign-up creates the account + keys automatically:
1. **In Logto** → Webhooks → create: event `User.Created`, endpoint = our backend URL
   `/hooks/logto`. Logto will show a **Signing key** → put it into `.env` → `LOGTO_WEBHOOK_SIGNING_KEY`,
   then `docker compose up -d --force-recreate backend`.
2. ⚠️ **Logto Cloud cannot reach `localhost`** — locally you need a public URL (ngrok/cloudflared tunnel)
   or a deployed backend (Phase 3). Locally the logic can be verified with curl using a self-signed body.

Webhook authentication is the **Logto signature** (not `X-Internal-Token`: that one is sent by a manual caller).

## SHAD-38 — anti-abuse (why nothing can be spent without payment)
- **Hard guarantee:** `START_BUDGET=0` → a new account's single balance = $0, any request
  hits the budget limit. The budget is raised only after payment (payment flow — SHAD-19/21).
- LibreChat balance is disabled (`balance.enabled:false`) — there is no starting balance there.

### Anti-bot checklist (implement when opening sign-up; keys go in env)
- [ ] Email verification in LibreChat (`EMAIL_*` SMTP + require confirmation).
- [ ] Rate limit on sign-up (LibreChat / reverse proxy).
- [ ] Captcha on sign-up (Cloudflare Turnstile — `TURNSTILE_*`).
- [ ] If there is a trial — a tiny budget gated by verification, not "free credit for everyone".

## Env (see root .env.example)
`LITELLM_BASE_URL`, `LITELLM_MASTER_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`START_BUDGET`, `DEFAULT_RPM_LIMIT`, `DEFAULT_TPM_LIMIT`, `DEFAULT_MODELS`.
