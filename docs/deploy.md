# ShadowRouter — Deploy runbook (SHAD-24)

The order in which we bring up prod/beta. Hybrid: **portal → Vercel**, **the whole Docker stack → Railway**
(Vercel does not run long-lived containers — LiteLLM/LibreChat/Postgres/Redis/Mongo/backend).

Legend: 👤 = manual step in a console (secrets/accounts/DNS), 🤖 = done from the repository (config/deploy).

---

## 0. Prerequisites (👤, gather in advance)
- [ ] Railway account (+ billing)
- [ ] Vercel account (portal)
- [ ] Logto prod tenant (currently dev)
- [ ] Supabase prod project (verify that the `user_accounts` + `payments` tables exist)
- [ ] NOWPayments: `API key` + `IPN secret` (placeholders are fine at the start)
- [ ] Receiving crypto wallet (in the NOWPayments dashboard; can be done later)
- [ ] Paid provider keys (can be added incrementally)
- [ ] Access to DNS for `shadowrouter.ca` (GoDaddy; before 2026-09 we lived on `*.shadowrouter.wasd.digital`)

## 1. Stack on Railway (🤖 config + 👤 secrets)
⚠️ Railway does NOT deploy a `docker-compose` file as a whole. Each service = a separate Railway service
with **Root Directory** = the folder containing the Dockerfile (already added):
- `backend` → Root Directory `backend/` (its own Dockerfile)
- `litellm` → Root Directory `litellm/` (`litellm/Dockerfile` = image + config)
- `librechat` → Root Directory `librechat/` (`librechat/Dockerfile` = image + config)
- `litellm-db` → **Railway Postgres** (managed, one click — not a container on a volume)
- `redis` → **Railway Redis** (managed, one click)
- `mongodb` → managed (Railway plugin or Mongo Atlas)

Ports: for the public services (`litellm`, `librechat`) set the target port in Railway Networking
(litellm 4000, librechat listens on `$PORT`). `backend` listens on `$PORT` (Railway injects it).

Each service's env comes from our `.env` (👤 enters the secrets in Railway Variables, NOT in the repo).
Key points:
- `LITELLM_BASE_URL`, `DATABASE_URL`, `REDIS_HOST/PORT`, `MONGO_URI` → Railway managed addresses.
- `PUBLIC_BASE_URL` → the backend's public address (for IPN/webhook).
- Externally exposed ports: `litellm` (api), `librechat` (chat). `backend` — webhook/portal only (can be closed to direct access, leaving `/hooks/*` and `/billing/*`).

## 2. Portal on Vercel (🤖 + 👤)
- Import `portal/` into Vercel (root = `portal`).
- Env (Vercel → Settings → Environment Variables): `LOGTO_*`, `BACKEND_URL` (→ Railway backend), `INTERNAL_API_TOKEN`.
- Deploy → get the `*.vercel.app` address.

## 3. DNS on GoDaddy (👤, using the addresses from steps 1-2)
The prod domain is **`shadowrouter.ca`** (DNS on GoDaddy). Final map:
| Host | Type | Value | What |
|------|------|-------|-----|
| `@` | A | the value Vercel shows when you add the domain (`76.76.21.21`) | portal (Vercel) |
| `www` | CNAME | `cname.vercel-dns.com` | redirect to `shadowrouter.ca` |
| `chat` | CNAME | Railway address (librechat, `xxxx.up.railway.app`) | web chat |
| `api` | CNAME | Railway address (litellm) | dev-API |

The backend (IPN/webhook) stays on `<backend>.up.railway.app` — it is not user-facing.
HTTPS is issued automatically (Vercel/Railway). After DNS, update in env/consoles:
- Logto redirect URIs → `https://shadowrouter.ca/callback` (portal), `https://chat.shadowrouter.ca/oauth/openid/callback` (chat); post sign-out → the roots of these domains.
- LibreChat `DOMAIN_SERVER/DOMAIN_CLIENT=https://chat.shadowrouter.ca`, `LITELLM_BASE_URL=https://api.shadowrouter.ca/v1`.
- Backend `PORTAL_SUCCESS_URL=https://shadowrouter.ca/api-access`, `PORTAL_CANCEL_URL=https://shadowrouter.ca/billing`, `SYNTHETIC_EMAIL_DOMAIN=nomail.shadowrouter.ca`; `PUBLIC_BASE_URL` unchanged.
- Vercel `BASE_URL=https://shadowrouter.ca`.
- NOWPayments IPN callback and Logto webhook — unchanged (they point at the backend).

## 4. Live check (🤖 + 👤 eyes-on)
- [ ] Sign up in Logto (username, no email) → auto-provisioning (webhook) → account + keys created
- [ ] Portal: sign in, balance $0 + dev key visible
- [ ] Top-up: portal → NOWPayments (sandbox) → pay → balance increased + a row in `payments`
- [ ] Chat responds; dev key works in an external tool
- [ ] Negative: `/provision` without a token → 401; webhook with a bad signature → 401

## 5. Minimal hardening before beta (🤖)
- [ ] Backups of LiteLLM Postgres (the balance!) + Supabase
- [ ] Secrets in the hosting provider's Variables, not in the repo (already the case)
- [ ] Basic monitoring (Railway metrics + alert on 5xx)
- [ ] Rate limits (anti-abuse — load-bearing for a privacy product)

## Notes
- Full 5k hardening (horizontal LiteLLM, managed HA, load test) — Phase 4, after beta.
- `MARKUP=1.0` in prod at launch is OK (the margin is raised later by changing one number).
- Sole proprietorship: accepting other people's money as an individual is a personal risk; before reaching volume — consult a lawyer/accountant.
