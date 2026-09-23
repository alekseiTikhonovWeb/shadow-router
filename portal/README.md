# ShadowRouter — Portal (Next.js + Logto)

Web portal: sign-in via Logto (the same SSO as the chat), account, balance and API key.

## Running (locally)
```bash
cd portal
cp .env.example .env.local   # then fill in the Logto values and INTERNAL_API_TOKEN
npm install
npm run dev                  # http://localhost:3000
```

## Prerequisite in Logto (once)
For the Next.js (Traditional Web) application add:
- Redirect URI: `http://localhost:3000/callback`
- Post sign-out redirect URI: `http://localhost:3000/`

## Structure
- `app/logto.ts` — Logto config (secrets from `.env.local`).
- `app/page.tsx` — home page: sign-in / email + link to API Access + sign-out.
- `app/callback/route.ts` — exchanges the Logto code for a session.
- `app/dashboard/*` — protected dashboard (overview, keys, usage, billing, settings).
- `next.config.mjs` — redirects from the old `/api-access` and `/billing` (NOWPayments returns users there) to `/dashboard/billing`.

## Deploy
Vercel — as a separate task (Phase 3). Secrets are set in the Vercel project env, not in code.
