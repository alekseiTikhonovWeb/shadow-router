# ShadowRouter — how it all works (explained from scratch)

> This document is for understanding, not for running things (running is covered in `README.md`).
> Written as if you are seeing a backend for the first time. If a term is unfamiliar, it is explained in section 1.
> Read top to bottom: first the glossary, then the big picture, then the internals, then the files, then the decisions.

## Table of contents
1. [Glossary (from scratch)](#1-glossary-from-scratch)
2. [What we are building](#2-what-we-are-building)
3. [The big picture: who owns what](#3-the-big-picture-who-owns-what)
4. [How LiteLLM works inside](#4-how-litellm-works-inside)
5. [How LibreChat works inside](#5-how-librechat-works-inside)
6. [Logto and sign-in — how it works](#6-logto-and-sign-in)
7. [Supabase — a narrow role](#7-supabase--a-narrow-role)
8. [Our backend — what it does](#8-our-backend)
9. [File-by-file walkthrough](#9-file-by-file-walkthrough)
10. [Full request flows (end-to-end)](#10-full-request-flows)
11. [Why these decisions and not others](#11-why-these-decisions)
12. [What is done, by phase/ticket](#12-what-is-done)

---

## 1. Glossary (from scratch)

- **Server** — a program that runs continuously and waits for requests (unlike a script, which runs once and exits).
- **API** — a way for one program to ask another to do something over the network. Usually HTTP requests (like opening a link, but done by a program rather than a browser).
- **HTTP request / endpoint** — a call to an address like `POST /v1/chat/completions`. `POST/GET` is the type of action, `/v1/...` is the path (an endpoint = a specific path that can do something).
- **JSON** — a text data format `{"key": "value"}`. Almost all APIs speak it.
- **Proxy** — an intermediary. You talk to the proxy, it forwards to the right service and returns the response. ShadowRouter is a proxy to AI models.
- **OpenAI-compatible API** — a "standard-format socket". OpenAI defined the request format for models; lots of tools speak it. If your server answers in that format, all those tools work with you without modification. LiteLLM is exactly that.
- **Token (for models)** — a piece of text (~¾ of a word). Models count input/output in tokens, and pricing is per token.
- **Token (access / key)** — a secret pass string. Not to be confused with text tokens: here "token" = "access key".
- **Streaming / SSE** — the response arrives in chunks in real time (the "typing" effect) rather than as a single block. SSE (Server-Sent Events) is the technology for that kind of streaming.
- **Container / image / Docker** — an *image* is a "frozen snapshot" of a program with everything it needs inside; a *container* is a running instance of an image. Docker lets you run things identically on any machine. Think: image = recipe, container = the cooked dish.
- **docker compose** — a file that describes several containers at once and how they are connected, so everything comes up with a single command.
- **env / environment variables** — settings passed to a program from outside at launch time (rather than written into the code). This is where **secrets** (keys, passwords) go. The `.env` file is a list of such variables.
- **Volume** — persistent storage for a container. The container can be killed and recreated, and the data in the volume stays (e.g. a database).
- **Postgres / MongoDB / Redis** — databases. Postgres and Mongo are for persistent storage (tables / documents). Redis is fast memory for temporary things (cache, counters).
- **data plane / control plane** — the "hot path" (data plane) = what EVERY user request goes through (must be fast and reliable). The "cold path" (control plane) = configuration, happens rarely (create an account, issue a key). They are deliberately kept separate.
- **Balance / spend / budget** — *budget (max_budget)* is how much a user is allowed to spend. *spend* is how much has already been spent. When spend ≥ budget — blocked.
- **Virtual key** — a key that WE issue to the user (not the provider). It has its own owner, budget, limits. Behind it are the real provider keys, which the user never sees.
- **master key** — LiteLLM's main admin key. It is used to create virtual keys and accounts. Never handed to anyone.
- **Key pool / load balancing / failover** — a *pool* = several keys of the same provider under one model name. *Load balancing* = spreading requests across them. *Failover* = if one fails (error/limit), automatically pick another.
- **rpm / tpm** — limits: requests-per-minute and tokens-per-minute.
- **rate limit (429)** — "too often/too much"; the provider responds with code 429.
- **OIDC / SSO / IdP** — *IdP (Identity Provider)* is a separate service that stores users and verifies sign-in. *OIDC* is the standard protocol by which applications trust a sign-in from the IdP. *SSO (Single Sign-On)* is one login for several applications. (Our IdP = Logto.)
- **JWT** — a signed token with user data; the signature lets you verify it is genuine without hitting the database.
- **REST / PostgREST** — *REST* is an API style on top of HTTP. *PostgREST* is the Supabase service that turns Postgres tables into a REST API (rows can be read/written via HTTP requests, with no direct DB connection).
- **RLS (Row Level Security)** — row-level protection in Postgres: access is closed by default and opened only by explicit policies. We keep the table closed to everyone except the server key.
- **Migration** — a versioned file with a DB schema change (create a table, add a column). So that structure changes are reproducible rather than done by hand in the dashboard.
- **Connection pool** — reusing DB connections instead of opening a new one per request (their number is limited).
- **MAU** — monthly active users (many services price by them, e.g. Logto).
- **markup** — a surcharge on top of cost. Our price = cost × (1 + markup).

---

## 2. What we are building

**ShadowRouter** is a multi-model AI proxy (on the OpenRouter model, but with a good web chat). The idea: the user has **one account, one balance, all models** (OpenAI, Gemini, etc.), and two entry points:

1. **Web chat** — a convenient chat site (this is LibreChat).
2. **A single dev API key** — the same access, but for external tools (Cursor, Claude Code, agents).

The product's value is **convenience** (one bill for everything, no need to get keys from every provider), not low price. We earn on the **markup** on top of cost.

The main rule: **the single balance lives only in LiteLLM**. Both the chat and the dev key deduct from it. No second counters.

---

## 3. The big picture: who owns what

```
                 ┌───────────────────────────── USER ─────────────────────────────┐
                 │                                                                 │
         web chat │                                                   dev key (Cursor,│
                 ▼                                                   Claude Code, etc.)
        ┌──────────────────┐                                                 │
        │   LibreChat (UI) │  sign-in via Logto (SSO)                         │
        │  interface only  │                                                  │
        └────────┬─────────┘                                                  │
                 │  the user's virtual key                                    │
                 ▼                                                            ▼
        ┌─────────────────────────────────────────────────────────────────────┐
        │                        LiteLLM  (CORE / data plane)                   │
        │  • single OpenAI-compatible API                                       │
        │  • pool of provider keys + failover                                   │
        │  • single balance accounting (budget/spend), our prices               │
        │  • Postgres (keys/spend) + Redis (cache/counters)                     │
        └───────────┬───────────────────────────────────────────┬─────────────┘
                    ▼                                             ▼
              OpenAI API                                     Gemini API   (real providers)

   OUTSIDE the hot path:
        ┌──────────────────┐        ┌──────────────────┐     ┌──────────────┐
        │ backend (FastAPI)│  →     │ LiteLLM mgmt API │     │   Supabase   │
        │  /provision      │  →     │ (create account  │     │ mapping user │
        │  control plane   │        │  + keys)         │     │ ↔ keys       │
        └──────────────────┘        └──────────────────┘     └──────────────┘
        ┌──────────────────┐
        │  Logto (IdP)     │  who the user is; one login for chat + (future) portal
        └──────────────────┘
```

The key idea: **chat and dev-key requests go straight to LiteLLM** (the hot path). The backend, Logto and Supabase are **configuration plumbing** (the cold path); they are NOT in the path of every request. This is deliberate: the hot path must be simple and fast.

---

## 4. How LiteLLM works inside

LiteLLM is the "heart". Essentially it is a **smart proxy to models** with billing.

**What it does on every `POST /v1/chat/completions` request:**
1. Checks the **key** in the `Authorization: Bearer ...` header. This is either the master key or a virtual key. If the key is invalid / has no access to the model — rejected (401/403).
2. Checks the **budget**: if `spend ≥ max_budget` on the account/key — rejected with `429 ExceededBudget`. (This is how anti-abuse works: budget 0 = nothing can be spent.)
3. Looks at which **model** was requested (an alias, e.g. `gemini-flash`). An alias can have several **deployments** (one model × different keys) — that is a **pool**.
4. The **Router** picks one deployment (our strategy is `usage-based-routing-v2` — the least loaded by actual usage). The "who has used how much" state and cooldowns are kept in **Redis**.
5. Sends the request to the real provider (OpenAI/Gemini) with a real key.
6. On error/429 — **retry** on another deployment in the pool (`num_retries`), and the failed key goes into **cooldown** for 30s. If the whole group is down — it goes to the **fallback** (another model).
7. Computes the cost: tokens × **our prices** (`input/output_cost_per_token` from the config) and adds it to **spend** in **Postgres**.
8. Returns the response (streamed in chunks if `stream:true`).

**Where things are stored:**
- **Postgres (litellm-db)** — virtual keys, accounts (users), budgets, accumulated spend. This is the "bookkeeping". Lives in the `litellm_pgdata` volume.
- **Redis** — fast temporary things: usage counters for routing, cooldowns, rate-limit windows. Not "bookkeeping" but "working memory".

**LiteLLM concepts we use:**
- **model_list** — the list of deployments: `model_name` (the alias the user sees) → `litellm_params` (the real model + key + price).
- **virtual key** — `/key/generate`. Tied to an account (user), has a models list, rpm/tpm. The budget is NOT on the key but on the account.
- **internal user (account)** — `/user/new` with `max_budget`. This is the "single balance": all of the user's keys spend from it.
- **master_key** — admin. We use it for everything above.

---

## 5. How LibreChat works inside

LibreChat is **only the web chat (the interface)**. It does NOT call the models itself — it calls LiteLLM as a regular OpenAI-API client.

**What it consists of:**
- **The web front end (UI)** — what you see in the browser at `localhost:3080`.
- **Its server (Node.js)** — accepts your messages, sends them to LiteLLM, streams the response back.
- **MongoDB** — stores conversations, users, LibreChat settings. (Its own database, separate from LiteLLM.) Volume `mongo_data`.

**Our key settings:**
- **LibreChat's own balance is DISABLED** (`balance.enabled: false`). This is critical: otherwise there would be a second money counter, and our rule is that the balance lives only in LiteLLM.
- **Custom endpoint** — we tell LibreChat: "get the models not from OpenAI directly but from `http://litellm:4000/v1`, with this key". That way all chat traffic goes through our proxy.
- **Sign-in via Logto** (OIDC) — the built-in email/password form is disabled; only the "Sign in with ShadowRouter" button remains.

**An important note about chat "memory":** the model remembers nothing between requests (it is stateless). The "memory" is created by LibreChat — on every message it resends the entire conversation history to the model. The model has no internet access "out of the box" either — that is a separate feature (web search as a tool) that has to be wired up.

---

## 6. Logto and sign-in

**Why sign-in at all:** the product is paid, with a per-user balance. To bill and tie a balance to someone, we need to know WHO the user is. And we need **one login for two surfaces** (chat + the future portal).

**Logto** is an external **IdP** (user store + sign-in) using the **OIDC** protocol.

**How sign-in works (redirect flow, like "Sign in with Google"):**
1. On the LibreChat sign-in page you click "Sign in with ShadowRouter".
2. You are **redirected to Logto** (its page). The password is entered THERE — our application never sees it (that is the security).
3. Logto verifies you and redirects back to `…/oauth/openid/callback` with a confirmation.
4. LibreChat trusts that confirmation (per OIDC) and lets you in.

The redirect to a "different address" is normal for OIDC, not a bug. In production it is made to look "ours" via a custom domain + Logto branding.

**Bonus:** adding Google/GitHub sign-in later = a couple of clicks in Logto (Connectors), and the buttons appear automatically in both the chat and the portal — no code changes.

---

## 7. Supabase — a narrow role

Supabase is "Postgres as a service" + ready-made APIs/Auth. **But its role here is deliberately narrow:** only **payments** and the **mapping** `user ↔ litellm_account ↔ keys`. **The balance is NOT stored there** (it is in LiteLLM).

- Access from the backend is via **REST (PostgREST)**: we read/write rows with HTTP requests, with no direct Postgres connection.
- The key is the **new `sb_secret_…` format** (server-side, bypasses RLS). We send it **only** in the `apikey` header (an important detail from the new Supabase docs: do not duplicate it in `Authorization: Bearer` — you will get "Invalid JWT").
- The `user_accounts` table is locked down with **RLS** and no client policies → accessible only with the server key.
- The schema is changed via **migrations** (`supabase/migrations/`), not by hand.

---

## 8. Our backend

This is a small **FastAPI** (Python) service — the **control plane**, outside the hot path. One main endpoint:

**`POST /provision { user_id }`** — provisioning a new user:
1. Creates an **account** in LiteLLM (`/user/new`, `max_budget=0` — no spending without payment, this is SHAD-38).
2. Creates **two keys** under it (`/key/generate`): `chat-…` (for the web chat) and `dev-…` (for tools), with rpm/tpm limits.
3. Writes the **mapping** to Supabase (`user_accounts`).
4. Returns both keys.

Idempotency: re-provisioning the same user → `409` (no duplicates). Everything to LiteLLM goes with the master key; secrets come only from env.

---

## 9. File-by-file walkthrough

```
shadow-router/
├─ docker-compose.yml      ← describes all 6 containers and their links
├─ .env                    ← REAL secrets (NOT committed to git)
├─ .env.example            ← secrets template (committed to git, no values)
├─ .gitignore              ← what git ignores (incl. .env)
├─ .dockerignore           ← what is left out of the docker build (incl. .env)
├─ README.md               ← how to run/verify
├─ litellm/
│  └─ config.yaml          ← models, key pool, prices, routing
├─ librechat/
│  └─ librechat.yaml       ← chat: custom endpoint → LiteLLM, balance off
├─ backend/
│  ├─ Dockerfile           ← how to build the backend image
│  ├─ requirements.txt     ← backend Python dependencies
│  ├─ app/main.py          ← FastAPI code (/health, /provision)
│  └─ README.md            ← about the backend + anti-bot checklist
├─ supabase/
│  ├─ config.toml          ← Supabase CLI config
│  ├─ migrations/…_init_user_accounts.sql  ← mapping table schema
│  └─ README.md            ← migrations workflow + about pooling
└─ docs/
   └─ architecture-explained.md  ← this document
```

### `docker-compose.yml` — the conductor
Describes **6 services** and brings them up with a single `docker compose up -d`:
- `litellm` (port 4000) — the core. Mounts `litellm/config.yaml`, reads `.env`, depends on the DB and Redis. Has a **healthcheck** (verifies it is alive).
- `litellm-db` (postgres:16) — LiteLLM's DB (keys/spend). Volume `litellm_pgdata`.
- `redis` — router cache/counters.
- `librechat` (port 3080) — the web chat. Mounts `librechat/librechat.yaml`, reads `.env`, depends on mongo and litellm.
- `mongodb` (mongo:7) — chat data. Volume `mongo_data`.
- `backend` (port 8088→8000) — provisioning. Built from `./backend`, reads `.env`.
All on one network `shadow` → they reach each other by service name (e.g. LibreChat calls `http://litellm:4000`).

### `litellm/config.yaml` — the core's brain
- **model_list** — each block = "alias → real model + key + price". Example: `gemini-flash` is repeated 6 times with different `GEMINI_API_KEY_*` = **a pool of 6 keys**. OpenAI models likewise have 3 keys.
- **input/output_cost_per_token** — OUR per-token prices (currently 1:1 with cost, markup ×1.0). The budget is deducted at these prices (SHAD-13).
- **router_settings** — `usage-based-routing-v2` (load balancing), `num_retries`/`cooldown_time`/`allowed_fails` (failover, SHAD-14), `fallbacks` (if a group is down — go to another), Redis for state.
- **general_settings** — `master_key`, `database_url` (from env).
There are no secrets in the file — only `os.environ/NAME`; the real values are in `.env`.

### `librechat/librechat.yaml` — chat configuration
- `balance.enabled: false` — **the main rule** (balance only in LiteLLM).
- `endpoints.custom` — a single `ShadowRouter` endpoint: `baseURL: http://litellm:4000/v1`, key `${LITELLM_USER_KEY}`, the model list. That way all chat traffic goes through our proxy.

### `.env` and `.env.example`
- `.env` — the real secrets: provider keys, master_key, DB password, LibreChat secrets (CREDS/JWT), Supabase, Logto (`OPENID_*`). **Not committed to git** (see `.gitignore`).
- `.env.example` — the same list, but without values (placeholders). Committed to git so another person knows what to fill in.
- An important habit: after editing `.env` you need `docker compose up -d --force-recreate <service>` — `restart` does NOT re-read the env file.

### `.gitignore` / `.dockerignore`
Guarantee that `.env` (and data/volumes) never end up in git or in the docker image. This is a hard security rule: secrets only at runtime.

### `backend/app/main.py`
The FastAPI application. Functions: `_llm_post` (request to the LiteLLM mgmt API), `_make_key` (create a key), `_sb_get_mapping`/`_sb_insert_mapping` (Supabase), the `/health` and `/provision` endpoints. Defaults (budget 0, rpm/tpm, models) come from env.

### `backend/Dockerfile` + `requirements.txt`
Dockerfile: take `python:3.12-slim`, install dependencies, run `uvicorn` (the server that runs FastAPI). requirements: `fastapi`, `uvicorn`, `httpx` (HTTP client). Minimal dependencies by design.

### `supabase/migrations/…_init_user_accounts.sql`
Creates the `user_accounts` table (id, user_id, litellm_user_id, chat_key, dev_key, created_at) and enables RLS. Idempotent (`IF NOT EXISTS`). This is the single source of truth for the schema (no manual edits in the dashboard).

---

## 10. Full request flows

### A. A message in the web chat
1. Browser → LibreChat server: "here is the message + history".
2. LibreChat → `POST http://litellm:4000/v1/chat/completions` with the user's virtual key, `stream:true`, and the **entire history** in `messages`.
3. LiteLLM: checks the key → checks the budget → picks a deployment from the pool → sends to the provider.
4. The provider responds token by token → LiteLLM streams it back → LibreChat → browser (typing effect).
5. LiteLLM computes the cost at our prices → increments `spend` in Postgres.

### B. A request from an external tool (dev key)
1. The tool (aider/Continue/Cursor*) is configured with: `base_url = http://localhost:4000/v1`, `api_key = dev key`.
2. The tool sends a regular OpenAI request → LiteLLM → provider → response.
3. spend grows on the SAME account as the chat → **single balance**.
   (*Cursor sends requests from its own servers, which cannot see `localhost` → a tunnel/deployment is needed.)

### C. Provisioning a new user
1. (in the future) Logto sends a webhook on sign-up → `POST /provision`.
2. backend → LiteLLM: create an account (budget 0) + 2 keys.
3. backend → Supabase: write the mapping.
4. The user gets an account; they can spend after topping up (budget > 0).

---

## 11. Why these decisions

- **LiteLLM as the only balance counter.** The alternative is to count the balance in our own code or in LibreChat. Downsides: two counters drift apart, and this is the money path = risk of losing money. LiteLLM already does budget/spend/keys/failover — we take what is ready (the "config > code" rule).
- **LibreChat for the chat (not our own Next.js chat).** A ready, high-quality chat with lots of features. Writing our own would take months. Condition: its own balance must be switchable off (it is) — otherwise we would be back to writing our own chat.
- **Backend outside the hot path.** If every chat request went through our Python, that would be an extra point of failure and a slowdown. So the backend only configures (creates keys), and traffic bypasses it straight to LiteLLM.
- **Identity = Logto (managed OIDC), not the LibreChat login and not our own Keycloak.** We need one login for chat + portal. The LibreChat login does not share cleanly with the portal. Our own Keycloak is one more service to run. Logto: free up to 50k MAU, standard SSO, almost no infrastructure of our own. Mapping by email → we are not tied to Logto forever (no lock-in).
- **Supabase only for mapping/payments.** We do not make it the source of the balance (that is LiteLLM) and we do not use Supabase Auth as the IdP for LibreChat (it integrates poorly). Narrow role = fewer couplings = fewer bugs.
- **New account budget = 0.** So bots cannot farm free tokens (anti-abuse). Spending only after payment.
- **Key pool + failover + rpm/tpm.** A single key hits limits / can fail. A pool spreads the load and survives failures; rpm/tpm keep a leaked key from burning through the budget in a minute.
- **Custom prices in the config.** So the markup is set in one place and the budget is deducted directly at our prices (margin is automatic).
- **Migrations instead of manual schema edits.** So DB changes are reproducible and go through CI, rather than "I clicked something in the dashboard".

---

## 12. What is done

**Phase 0 — Integration check (prove the single balance locally):**
- LiteLLM + Postgres + Redis in Docker, 2 providers (Gemini, OpenAI), key pools.
- LibreChat connected to LiteLLM, LibreChat balance disabled.
- Proven: a chat message → `spend` grows in LiteLLM (visible "in money" on paid models).
- The single key works in external tools.

**Phase 1 — The backbone of the single balance:**
- Custom prices (markup ×1.0 for now).
- Pool + failover + cooldown; rpm/tpm limits on keys.
- FastAPI `/provision`: account + 2 keys, budget 0 (anti-abuse), mapping in Supabase.
- Streaming verified (goes token by token).
- Identity decision: Logto; LibreChat ↔ Logto SSO connected (sign-in only via Logto).
- Schema migrations via Supabase CLI.

**Still ahead:** the portal (Next.js) + its sign-in via Logto, payments/top-up, protecting `/provision`, money-path tests, cloud deployment, CI/CD and observability.
