<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
<!-- GitHub-metric shields (stars, forks, contributors) are intentionally omitted. -->
[![CI][ci-shield]][ci-url]
[![Portal][portal-shield]][portal-url]
[![Chat][chat-shield]][chat-url]
[![API][api-shield]][api-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://shadowrouter.ca">
    <img src="assets/brand/mark.svg" alt="ShadowRouter logo" width="80" height="80">
  </a>

  <h3 align="center">ShadowRouter</h3>

  <p align="center">
    Private, no-KYC access to every major AI model. One account, one balance, paid in crypto.
    <br />
    A web chat and an OpenAI-compatible API key, both drawing from the same balance.
    <br />
    Solo project, designed, built and run in production by one person.
    <br />
    <br />
    <a href="docs/architecture-explained.md"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://shadowrouter.ca">Portal</a>
    &middot;
    <a href="https://chat.shadowrouter.ca">Web chat</a>
    &middot;
    <a href="#engineering-decisions">Engineering decisions</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#how-it-works">How It Works</a></li>
        <li><a href="#models">Models</a></li>
        <li><a href="#repository-layout">Repository Layout</a></li>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
        <li><a href="#configuration">Configuration</a></li>
      </ul>
    </li>
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#api">API</a></li>
        <li><a href="#web-chat-and-portal">Web chat and portal</a></li>
        <li><a href="#backend-endpoints">Backend endpoints</a></li>
        <li><a href="#tests-and-load-testing">Tests and load testing</a></li>
      </ul>
    </li>
    <li><a href="#deployment">Deployment</a></li>
    <li><a href="#engineering-decisions">Engineering Decisions</a></li>
    <li><a href="#status-and-roadmap">Status and Roadmap</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

ShadowRouter is a multi-model AI gateway in the spirit of OpenRouter, with one difference that people
actually ask for: **privacy**. You sign up with a username and a password (no email), you top up in
crypto (no card, no KYC), and prompts and responses are never written to our logs.

Two ways in, one balance:

* **Web chat** at [chat.shadowrouter.ca][chat-url]: GPT, Gemini, Claude, Grok and DeepSeek in one
  interface, switchable mid-conversation, with agents, web search and memory.
* **A single API key** at `https://api.shadowrouter.ca/v1`: drop-in OpenAI-compatible endpoint for
  Cursor, Claude Code, SDKs and agents. Switch models by name.

Both deduct from the same balance, which is managed at [shadowrouter.ca][portal-url].

Principles that shape every decision in this repository:

* **Collect the absolute minimum.** Accounts are mapped by an internal identity id, never by PII.
* **The single balance lives only in LiteLLM.** No second ledger anywhere. A new account starts at
  `$0` until the first payment, which is the anti-abuse floor for a no-KYC product.
* **Config over code.** LiteLLM, LibreChat, Logto and Supabase do the heavy lifting. Our own code is a
  small control plane and a portal.
* **Built for 5,000 users.** Services are stateless and idempotent so they can run as replicas.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### How It Works

```
                       user
          ┌─────────────┴──────────────┐
      web chat                     dev API key
          │                            │
 ┌────────▼────────┐                   │
 │ LibreChat (UI)  │ sign-in via Logto │
 └────────┬────────┘                   │
          │ virtual key                │
 ┌────────▼────────────────────────────▼────────┐
 │            LiteLLM  (data plane)             │
 │ OpenAI-compatible API · provider key pools   │
 │ failover · single balance · our prices       │
 │ Postgres (keys/spend) + Redis (router state) │
 └───────┬──────────┬──────────┬────────────────┘
      OpenAI     Gemini    Anthropic  xAI  DeepSeek

 off the hot path (control plane)
 ┌──────────────────┐  ┌────────────┐  ┌──────────┐  ┌────────────┐
 │ FastAPI backend  │  │ Supabase   │  │ Logto    │  │ NOWPayments│
 │ provision, topup │  │ mapping +  │  │ identity │  │ crypto     │
 │ webhooks, account│  │ payments   │  │ (OIDC)   │  │ invoices   │
 └──────────────────┘  └────────────┘  └──────────┘  └────────────┘
```

| Component | Role | Owns |
|---|---|---|
| **LiteLLM** | Core. One OpenAI-compatible API, pools of official provider keys with failover, virtual keys per user, budget and spend accounting at our prices. | Postgres, Redis |
| **LibreChat** | Web chat UI only. Its own balance is disabled; it calls LiteLLM with the user's virtual key. | MongoDB |
| **Portal** (Next.js) | Landing page, dashboard: balance, API key, billing, usage, settings. | Vercel |
| **Backend** (FastAPI) | Control plane: provisioning, top-ups, Logto and NOWPayments webhooks, account deletion. Never on the request path. | Railway |
| **Supabase** (Postgres) | Narrow role: `user ↔ litellm_account ↔ keys` mapping and the payments ledger. Does not store the balance. | Migrations in `supabase/` |
| **Logto** | Identity (OIDC, single sign-on for chat and portal). Username and password, email optional. | Managed |
| **NOWPayments** | Crypto invoices (USDT, BTC, ETH and 300+ others); IPN webhook credits the balance, idempotent by txid. | Managed |

The full walkthrough, written for someone seeing a backend for the first time, is in
[docs/architecture-explained.md](docs/architecture-explained.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Models

The model catalog is the single source of truth in [`litellm/catalog.yaml`](litellm/catalog.yaml).
On startup `gen_config.py` expands every enabled model into a pool over the provider's key list, priced at
catalog price × `MARKUP`. A provider whose key list is empty is simply not offered.

| Tab | Provider | Models (as of the current catalog) |
|---|---|---|
| ChatGPT | OpenAI | `gpt-4o-mini`, `gpt-5.4-nano`, `gpt-5.4-mini`, `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol` |
| Codex | OpenAI | `gpt-5.3-codex` |
| Gemini | Google | `gemini-2.5-flash`, `gemini-2.5-pro` |
| Claude | Anthropic | `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-sonnet-4-6`, `claude-sonnet-5`, `claude-opus-4-5` … `claude-opus-4-8`, `claude-fable-5`, `claude-mythos-5` |
| Grok | xAI | `grok-4.3`, `grok-build-0.1` |
| DeepSeek | DeepSeek | `deepseek-v4-flash`, `deepseek-v4-pro` |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Repository Layout

```
shadow-router/
├─ docker-compose.yml        local stack: litellm, litellm-db, redis, librechat, mongodb, backend
├─ .env.example              every environment variable, with comments (copy to .env)
├─ litellm/                  data plane
│  ├─ catalog.yaml           models, prices, provider key lists (source of truth)
│  ├─ gen_config.py          catalog → litellm config.yaml at container start
│  └─ Dockerfile
├─ librechat/                web chat config (per-provider tabs, balance off, Logto SSO)
├─ backend/                  FastAPI control plane + pytest suite (external calls mocked)
├─ portal/                   Next.js portal (landing, dashboard, Terms, Privacy)
├─ supabase/                 SQL migrations: user_accounts, payments
├─ scripts/loadtest.py       async load tester for the LiteLLM proxy
├─ assets/brand/             logo mark and wordmark
├─ docs/
│  ├─ architecture-explained.md
│  └─ deploy.md              production runbook (Railway + Vercel)
└─ .github/workflows/ci.yml  backend tests, catalog generator smoke, portal build
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![LiteLLM][LiteLLM-badge]][LiteLLM-url]
* [![LibreChat][LibreChat-badge]][LibreChat-url]
* [![Next.js][Next.js-badge]][Next-url]
* [![FastAPI][FastAPI-badge]][FastAPI-url]
* [![Logto][Logto-badge]][Logto-url]
* [![Supabase][Supabase-badge]][Supabase-url]
* [![PostgreSQL][Postgres-badge]][Postgres-url]
* [![Redis][Redis-badge]][Redis-url]
* [![MongoDB][MongoDB-badge]][MongoDB-url]
* [![Docker][Docker-badge]][Docker-url]
* [![NOWPayments][NOWPayments-badge]][NOWPayments-url]
* [![Railway][Railway-badge]][Railway-url]
* [![Vercel][Vercel-badge]][Vercel-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

The whole stack runs locally with Docker Compose. The portal runs separately with Node.

### Prerequisites

* Docker Desktop (Compose v2)
* Node.js 20+ and npm (portal only)
* Python 3.12 (backend tests only)
* Accounts and keys, all supplied through `.env`, never committed:
  * at least one provider key (`OPENAI_KEYS` or `GEMINI_KEYS` is enough to start)
  * a [Logto](https://logto.io) tenant with two Traditional Web applications (chat and portal) and one
    Machine-to-Machine application with Management API access
  * a [Supabase](https://supabase.com) project (the `sb_secret_*` service key)
  * optional: a [NOWPayments](https://nowpayments.io) API key and IPN secret for real top-ups

### Installation

1. Clone the repository
   ```sh
   git clone https://github.com/alekseiTikhonovWeb/shadow-router.git
   cd shadow-router
   ```
2. Create the environment file and fill in the keys (every variable is documented inline)
   ```sh
   cp .env.example .env
   ```
3. Start the stack
   ```sh
   docker compose up -d
   docker compose ps
   ```
4. Check that the proxy is alive
   ```sh
   curl http://localhost:4000/health/liveliness      # "I'm alive!"
   curl http://localhost:8088/health                 # {"status":"ok", ...}
   ```
5. Apply the Supabase migrations (done by a human; touches your project)
   ```sh
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```
6. Run the portal
   ```sh
   cd portal
   cp .env.example .env.local        # Logto app id/secret, BACKEND_URL, INTERNAL_API_TOKEN
   npm install
   npm run dev                       # http://localhost:3000
   ```
7. Sign up through the chat at http://localhost:3080 or the portal. Logto's `User.Created` webhook calls
   the backend, which creates the LiteLLM account (budget `$0`), the chat key and the dev key, and writes the
   mapping. Note that Logto Cloud cannot reach `localhost`, so locally use a tunnel or call
   `POST /provision` by hand (see [backend/README.md](backend/README.md)).

> **Changed `.env`?** Run `docker compose up -d --force-recreate <service>`. A plain `restart` does not
> re-read the file.

### Configuration

| Area | Variables |
|---|---|
| Provider key pools | `OPENAI_KEYS`, `GEMINI_KEYS`, `ANTHROPIC_KEYS`, `XAI_KEYS`, `DEEPSEEK_KEYS` (comma-separated), `MARKUP` |
| LiteLLM | `LITELLM_MASTER_KEY`, `DATABASE_URL`, `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` |
| LibreChat | `MONGO_URI`, `CREDS_KEY`, `CREDS_IV`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `LITELLM_USER_KEY`, `DOMAIN_SERVER`, `DOMAIN_CLIENT`, `OPENID_*` |
| Backend | `INTERNAL_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `START_BUDGET`, `DEFAULT_RPM_LIMIT`, `DEFAULT_TPM_LIMIT`, `DEFAULT_MODELS`, `LOGTO_ENDPOINT`, `LOGTO_M2M_*`, `LOGTO_WEBHOOK_SIGNING_KEY`, `SYNTHETIC_EMAIL_DOMAIN` |
| Payments | `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `PUBLIC_BASE_URL`, `PORTAL_SUCCESS_URL`, `PORTAL_CANCEL_URL` |
| Portal (`portal/.env.local`) | `LOGTO_ENDPOINT`, `LOGTO_APP_ID`, `LOGTO_APP_SECRET`, `LOGTO_COOKIE_SECRET`, `BASE_URL`, `BACKEND_URL`, `INTERNAL_API_TOKEN` |

Secrets live only in the runtime environment. `.env` and `.env.local` are ignored by both git and Docker.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE -->
## Usage

### API

Any OpenAI-compatible client works. Point it at the proxy and use your dev key from the portal.

```sh
curl https://api.shadowrouter.ca/v1/chat/completions \
  -H "Authorization: Bearer $SHADOWROUTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-2.5-pro", "messages": [{"role": "user", "content": "hi"}]}'
```

```python
from openai import OpenAI

client = OpenAI(base_url="https://api.shadowrouter.ca/v1", api_key="sk-...")
client.chat.completions.create(model="claude-sonnet-5", messages=[{"role": "user", "content": "hi"}])
```

`GET /v1/models` lists what your key can use. Requests fail with `429 ExceededBudget` when the balance is
spent, and the same balance is shared with the web chat.

### Web chat and portal

* **Chat**: [chat.shadowrouter.ca][chat-url]. Sign in with ShadowRouter (Logto). Each provider is a tab in the
  model menu; history is optional.
* **Portal**: [shadowrouter.ca][portal-url]. `/dashboard` shows the balance and the dev key, `/dashboard/keys`
  rotates it, `/dashboard/billing` creates a crypto invoice, `/dashboard/usage` shows spend, and
  `/dashboard/settings` deletes the account.

### Backend endpoints

All control-plane routes require the `X-Internal-Token` header except `/health` and the two webhooks, which
authenticate with the provider's signature.

| Route | What it does |
|---|---|
| `GET /health` | Liveness, reports whether Supabase is configured |
| `POST /provision` | LiteLLM account (budget `$0`) + chat key + dev key + Supabase mapping. Repeat → `409` |
| `GET /account`, `GET /payments` | Dashboard data; self-heals a missing account |
| `POST /rotate-key`, `DELETE /account` | Key rotation; full deletion across LiteLLM, Supabase and Logto |
| `POST /topup` | `max_budget += amount`, idempotent by `event_id` |
| `POST /billing/create-invoice` | NOWPayments invoice in USDT, returns the checkout URL |
| `POST /hooks/nowpayments` | IPN (HMAC-SHA512, sorted keys) → credit on `finished` |
| `POST /hooks/logto` | `User.Created` (HMAC-SHA256) → provision; sets a synthetic email for email-less users |

### Tests and load testing

```sh
cd backend && pip install -r requirements.txt -r requirements-dev.txt && pytest -q   # external calls are mocked
cd portal && npx tsc --noEmit                                                          # typecheck
python scripts/loadtest.py --key sk-... --concurrency 25 --seconds 10                  # /v1/models by default
python scripts/loadtest.py --key sk-... --path /v1/chat/completions --model loadtest-echo   # full billing path
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the backend tests, a smoke test of the catalog
generator with fake keys, and the portal typecheck and build. No secrets are needed.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- DEPLOYMENT -->
## Deployment

Production is a hybrid: the portal on Vercel, everything long-running on Railway.

| Surface | Address | Hosting |
|---|---|---|
| Portal | `https://shadowrouter.ca` (`www` redirects with 308) | Vercel, project `shadow-router` |
| Web chat | `https://chat.shadowrouter.ca` | Railway `Librechat`, port 8080 |
| API | `https://api.shadowrouter.ca` | Railway `litellm`, port 4000 |
| Backend | Railway service URL, not user-facing | Railway `shadowRouter` |
| Databases | Postgres, Redis, MongoDB | Railway managed |

DNS is at GoDaddy. Each Railway service builds from its own directory in this repository; pushing to `main`
deploys. Step-by-step runbook: [docs/deploy.md](docs/deploy.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ENGINEERING DECISIONS -->
## Engineering Decisions

The choices an interviewer usually asks about, with the reasoning. The long form is in
[docs/architecture-explained.md](docs/architecture-explained.md).

* **One ledger, and it is not ours.** Balance, spend and per-key budgets live in LiteLLM's accounting; the
  web chat and the dev key are two virtual keys under the same account. A second counter in LibreChat or in our
  backend would drift, and drift on the money path means lost money. LibreChat's own balance is switched off.
* **The control plane is not on the request path.** Chat and API traffic go straight to LiteLLM. The FastAPI
  backend only provisions, credits and deletes accounts, so a backend outage cannot break a running chat, and the
  hot path stays one hop.
* **Privacy as a data model, not a policy page.** Sign-up is username plus password. Users are mapped by the
  identity provider's internal id, never by email or any PII. LibreChat insists on an email, so the backend
  assigns a synthetic one on a domain that receives nothing. Logs carry metrics, not prompts.
* **No-KYC means the abuse controls are load-bearing.** Every new account starts at a `$0` budget and gets
  rpm/tpm limits; nothing can be spent before a payment lands. This is a hard guarantee in the ledger, not a
  check in application code.
* **The money path is idempotent end to end.** `/topup` dedupes by `event_id`, the NOWPayments IPN dedupes by
  txid, provisioning returns `409` on repeat, and both webhooks are verified with HMAC signatures over the raw body.
  Provisioning also self-heals: if the sign-up webhook was lost, the first dashboard visit creates the account.
* **Config over code.** The whole model offer is one YAML catalog; a generator expands it into LiteLLM pools
  (every model × every provider key) and applies the markup as a single number. Identity, chat, payments and the
  database are managed services. Own code is a single FastAPI module, a Next.js portal and one script.
* **Built to scale sideways.** Services hold no state of their own (LiteLLM keeps router state in Redis, the
  backend keeps nothing), so replicas are a hosting knob. `scripts/loadtest.py` measures the proxy; a single
  replica handled roughly 170 req/s on the cheapest path when measured in July 2026.
* **Boring, reproducible operations.** Schema changes are Supabase CLI migrations, CI runs the money-path tests
  with every external call mocked, and the runbook in `docs/` describes production step by step.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- STATUS AND ROADMAP -->
## Status and Roadmap

Work is tracked in a private Jira project (`SHAD`); phases map to epics.

- [x] **Phase 0. Integration proof**: single balance proven end-to-end (chat spend lands in LiteLLM), one key in external tools
- [x] **Phase 1. Single-balance core**: custom prices, key pools with failover, rpm/tpm limits, provisioning and mapping, streaming, `$0` start budget, protected endpoints, top-up with money-path tests, migrations, SSO sign-in
- [ ] **Phase 2. Account and billing**
  - [x] Auto-provisioning via Logto webhook, with self-healing on `/account` and `/topup`
  - [x] Portal dashboard: balance, API key, key rotation, account deletion
  - [x] Crypto top-up via NOWPayments, payments ledger, verified with a live payment
  - [x] Branding, Terms of Service and Privacy Policy
  - [ ] Reconciliation of LiteLLM spend against the ledger
- [ ] **Phase 3. Polish and launch**
  - [x] Production deployment (Railway + Vercel)
  - [x] Own domain `shadowrouter.ca`
  - [ ] Logs, monitoring and alerts
  - [ ] Public launch
- [ ] **Phase 4. Infrastructure and reliability**
  - [x] CI (GitHub Actions)
  - [x] Load-test harness and mock model
  - [ ] Paid provider key pools with production rate limits
  - [ ] Backups for the LiteLLM Postgres (all balances live there)
  - [ ] Horizontal LiteLLM, managed HA databases, queues

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

No license. This is a personal portfolio project: the code is shared to be read and discussed, not to be
reused. If you want to use any part of it, ask.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Aleksei Tikhonov · [@alekseiTikhonovWeb](https://github.com/alekseiTikhonovWeb) · support@wasd.digital

Project: [https://github.com/alekseiTikhonovWeb/shadow-router](https://github.com/alekseiTikhonovWeb/shadow-router)
· Product: [https://shadowrouter.ca](https://shadowrouter.ca)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* [LiteLLM](https://github.com/BerriAI/litellm), the proxy that does the routing, the keys and the accounting
* [LibreChat](https://github.com/danny-avila/LibreChat), the chat we did not have to write
* [Logto](https://logto.io) for identity without email
* [Supabase](https://supabase.com) and [NOWPayments](https://nowpayments.io)
* [Basecamp's open policies](https://github.com/basecamp/policies) (CC BY 4.0), which our Terms and Privacy pages are adapted from
* [Best-README-Template](https://github.com/othneildrew/Best-README-Template)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[ci-shield]: https://github.com/alekseiTikhonovWeb/shadow-router/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/alekseiTikhonovWeb/shadow-router/actions/workflows/ci.yml
[portal-shield]: https://img.shields.io/badge/portal-shadowrouter.ca-1d4ed8?style=flat-square
[portal-url]: https://shadowrouter.ca
[chat-shield]: https://img.shields.io/badge/chat-chat.shadowrouter.ca-1d4ed8?style=flat-square
[chat-url]: https://chat.shadowrouter.ca
[api-shield]: https://img.shields.io/badge/api-api.shadowrouter.ca%2Fv1-1d4ed8?style=flat-square
[api-url]: https://api.shadowrouter.ca/v1/models
[LiteLLM-badge]: https://img.shields.io/badge/LiteLLM-2B2B2B?style=for-the-badge
[LiteLLM-url]: https://github.com/BerriAI/litellm
[LibreChat-badge]: https://img.shields.io/badge/LibreChat-0F0F0F?style=for-the-badge
[LibreChat-url]: https://www.librechat.ai/
[Next.js-badge]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[FastAPI-badge]: https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white
[FastAPI-url]: https://fastapi.tiangolo.com/
[Logto-badge]: https://img.shields.io/badge/Logto-5D34F2?style=for-the-badge
[Logto-url]: https://logto.io/
[Supabase-badge]: https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white
[Supabase-url]: https://supabase.com/
[Postgres-badge]: https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white
[Postgres-url]: https://www.postgresql.org/
[Redis-badge]: https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white
[Redis-url]: https://redis.io/
[MongoDB-badge]: https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white
[MongoDB-url]: https://www.mongodb.com/
[Docker-badge]: https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white
[Docker-url]: https://www.docker.com/
[NOWPayments-badge]: https://img.shields.io/badge/NOWPayments-64ACFF?style=for-the-badge
[NOWPayments-url]: https://nowpayments.io/
[Railway-badge]: https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white
[Railway-url]: https://railway.com/
[Vercel-badge]: https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white
[Vercel-url]: https://vercel.com/
