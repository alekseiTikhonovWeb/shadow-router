"""Control plane: provisioning, top-ups, account deletion. Never on the request path."""
import hashlib
import hmac
import json
import os
import time
import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel

LITELLM_BASE_URL = os.environ.get("LITELLM_BASE_URL", "http://litellm:4000")
LITELLM_MASTER_KEY = os.environ["LITELLM_MASTER_KEY"]
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_TABLE = os.environ.get("SUPABASE_TABLE", "user_accounts")
SUPABASE_PAYMENTS_TABLE = os.environ.get("SUPABASE_PAYMENTS_TABLE", "payments")  # payments ledger

START_BUDGET = float(os.environ.get("START_BUDGET", "0"))          # 0 until the first payment
DEFAULT_RPM_LIMIT = int(os.environ.get("DEFAULT_RPM_LIMIT", "60"))
DEFAULT_TPM_LIMIT = int(os.environ.get("DEFAULT_TPM_LIMIT", "150000"))
DEFAULT_MODELS = [m.strip() for m in os.environ.get(
    "DEFAULT_MODELS", "gpt-4o-mini,gpt-5.4-mini,gpt-5.4,gpt-5.5,gpt-5.5-codex,gemini-2.5-flash,gemini-2.5-pro"
).split(",") if m.strip()]

INTERNAL_API_TOKEN = os.environ.get("INTERNAL_API_TOKEN", "")

NOWPAYMENTS_API_KEY = os.environ.get("NOWPAYMENTS_API_KEY", "")
NOWPAYMENTS_IPN_SECRET = os.environ.get("NOWPAYMENTS_IPN_SECRET", "")
NOWPAYMENTS_API_URL = os.environ.get("NOWPAYMENTS_API_URL", "https://api.nowpayments.io/v1").rstrip("/")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8088").rstrip("/")  # IPN callback base
PORTAL_SUCCESS_URL = os.environ.get("PORTAL_SUCCESS_URL", "http://localhost:3000/api-access")
PORTAL_CANCEL_URL = os.environ.get("PORTAL_CANCEL_URL", "http://localhost:3000/billing")
LOGTO_WEBHOOK_SIGNING_KEY = os.environ.get("LOGTO_WEBHOOK_SIGNING_KEY", "")

# Logto Management API (M2M)
LOGTO_ENDPOINT = os.environ.get("LOGTO_ENDPOINT", "").rstrip("/")            # https://<tenant>.logto.app
LOGTO_M2M_CLIENT_ID = os.environ.get("LOGTO_M2M_CLIENT_ID", "")
LOGTO_M2M_CLIENT_SECRET = os.environ.get("LOGTO_M2M_CLIENT_SECRET", "")
SYNTHETIC_EMAIL_DOMAIN = os.environ.get("SYNTHETIC_EMAIL_DOMAIN", "nomail.shadowrouter.ca")  # no MX: undeliverable by design

app = FastAPI(title="ShadowRouter backend", version="0.1.0")


# Control-plane auth: the portal sends X-Internal-Token; webhooks are verified by signature.
async def require_internal_token(x_internal_token: str = Header(default="")):
    if not INTERNAL_API_TOKEN:
        raise HTTPException(status_code=503, detail="INTERNAL_API_TOKEN is not set on the server")
    if not hmac.compare_digest(x_internal_token, INTERNAL_API_TOKEN):
        raise HTTPException(status_code=401, detail="missing or invalid X-Internal-Token")

_llm_headers = {"Authorization": f"Bearer {LITELLM_MASTER_KEY}", "Content-Type": "application/json"}
# sb_secret_* keys go in `apikey` only (a Bearer header breaks them).
_sb_headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Content-Type": "application/json",
}


class ProvisionRequest(BaseModel):
    user_id: str


class TopupRequest(BaseModel):
    user_id: str
    amount: float           # USD credited to the balance
    event_id: str           # idempotency key
    currency: str = "USDT"  # ledger only


class RotateRequest(BaseModel):
    user_id: str


class InvoiceRequest(BaseModel):
    user_id: str
    amount: float


def _require_user_id(user_id: str) -> str:
    user_id = user_id.strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    return user_id


async def _llm_post(client: httpx.AsyncClient, path: str, payload: dict) -> dict:
    r = await client.post(f"{LITELLM_BASE_URL}{path}", headers=_llm_headers, json=payload, timeout=30)
    if r.status_code == 409:
        # already exists -> 409 (idempotent)
        raise HTTPException(status_code=409, detail=f"already exists: {payload.get('user_id', '')}")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"LiteLLM {path} -> {r.status_code}: {r.text[:300]}")
    return r.json()


async def _llm_get(client: httpx.AsyncClient, path: str, params: dict) -> dict:
    r = await client.get(f"{LITELLM_BASE_URL}{path}", headers=_llm_headers, params=params, timeout=30)
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail=f"LiteLLM {path}: not found {params}")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"LiteLLM {path} -> {r.status_code}: {r.text[:300]}")
    return r.json()


async def _make_key(client: httpx.AsyncClient, user_id: str, alias: str) -> str:
    data = await _llm_post(client, "/key/generate", {
        "user_id": user_id,
        "key_alias": alias,
        # No `models` restriction on keys; model access is managed in the proxy config.
        "rpm_limit": DEFAULT_RPM_LIMIT,
        "tpm_limit": DEFAULT_TPM_LIMIT,
        # Budget lives on the account, not the key.
    })
    return data["key"]


async def _llm_delete_key(client: httpx.AsyncClient, key: str):
    r = await client.post(f"{LITELLM_BASE_URL}/key/delete", headers=_llm_headers,
                          json={"keys": [key]}, timeout=30)
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"LiteLLM /key/delete -> {r.status_code}: {r.text[:200]}")


async def _llm_delete_user(client: httpx.AsyncClient, user_id: str):
    # Also removes the user's keys. 404 = already gone.
    r = await client.post(f"{LITELLM_BASE_URL}/user/delete", headers=_llm_headers,
                          json={"user_ids": [user_id]}, timeout=30)
    if r.status_code == 404:
        return
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"LiteLLM /user/delete -> {r.status_code}: {r.text[:200]}")


async def _sb_request(client: httpx.AsyncClient, method: str, table: str,
                      params: dict | None = None, json: dict | None = None) -> httpx.Response:
    """One PostgREST call; Supabase errors surface as 502."""
    headers = _sb_headers if method == "GET" else {**_sb_headers, "Prefer": "return=minimal"}
    r = await client.request(method, f"{SUPABASE_URL}/rest/v1/{table}",
                             headers=headers, params=params, json=json, timeout=30)
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Supabase {method} {table} -> {r.status_code}: {r.text[:300]}")
    return r


async def _sb_get_mapping(client: httpx.AsyncClient, user_id: str):
    if not SUPABASE_URL:
        return None
    r = await _sb_request(client, "GET", SUPABASE_TABLE, params={"user_id": f"eq.{user_id}", "select": "*"})
    rows = r.json()
    return rows[0] if rows else None


async def _sb_insert_mapping(client: httpx.AsyncClient, row: dict):
    if not SUPABASE_URL:
        return  # no Supabase configured: local mode without a mapping
    await _sb_request(client, "POST", SUPABASE_TABLE, json=row)


async def _sb_delete_mapping(client: httpx.AsyncClient, user_id: str):
    # The payments ledger is kept: no PII, needed for reconciliation.
    if not SUPABASE_URL:
        return
    await _sb_request(client, "DELETE", SUPABASE_TABLE, params={"user_id": f"eq.{user_id}"})


async def _sb_update_mapping(client: httpx.AsyncClient, user_id: str, patch: dict):
    if not SUPABASE_URL:
        return
    await _sb_request(client, "PATCH", SUPABASE_TABLE, params={"user_id": f"eq.{user_id}"}, json=patch)


async def _sb_event_exists(client: httpx.AsyncClient, event_id: str) -> bool:
    # Dedup key: payment event_id == txid.
    r = await _sb_request(client, "GET", SUPABASE_PAYMENTS_TABLE,
                          params={"txid": f"eq.{event_id}", "select": "txid"})
    return len(r.json()) > 0


async def _sb_record_payment(client: httpx.AsyncClient, user_id: str, amount: float, currency: str, txid: str):
    # History only; the balance lives in LiteLLM.
    await _sb_request(client, "POST", SUPABASE_PAYMENTS_TABLE,
                      json={"user_id": user_id, "amount": amount, "currency": currency, "txid": txid})


@app.get("/health")
async def health():
    return {"status": "ok", "supabase": bool(SUPABASE_URL), "start_budget": START_BUDGET}


async def _create_litellm_account(client: httpx.AsyncClient, user_id: str, alias_suffix: str = "") -> tuple:
    """Account holding the balance plus chat and dev keys; alias_suffix keeps key_alias unique on re-creation."""
    await _llm_post(client, "/user/new", {
        "user_id": user_id, "max_budget": START_BUDGET, "auto_create_key": False,
    })
    chat_key = await _make_key(client, user_id, f"chat-{user_id}{alias_suffix}")
    dev_key = await _make_key(client, user_id, f"dev-{user_id}{alias_suffix}")
    return chat_key, dev_key


async def _create_account_and_mapping(client: httpx.AsyncClient, user_id: str) -> dict:
    """Full provisioning. Returns the mapping row written to Supabase."""
    chat_key, dev_key = await _create_litellm_account(client, user_id)
    row = {
        "user_id": user_id,
        "litellm_user_id": user_id,
        "chat_key": chat_key,
        "dev_key": dev_key,
    }
    await _sb_insert_mapping(client, row)
    return row


async def _ensure_provisioned(client: httpx.AsyncClient, user_id: str) -> dict:
    """Provision a missing user or recreate a LiteLLM account behind a stale mapping (trusted user_id only)."""
    mapping = await _sb_get_mapping(client, user_id)
    if mapping:
        try:
            await _llm_get(client, "/user/info", {"user_id": user_id})
            return mapping
        except HTTPException as e:
            if e.status_code != 404:
                raise
            suffix = f"-{int(time.time())}"  # old aliases may still be taken
            chat_key, dev_key = await _create_litellm_account(client, user_id, suffix)
            await _sb_update_mapping(client, user_id, {"chat_key": chat_key, "dev_key": dev_key})
            return {**mapping, "chat_key": chat_key, "dev_key": dev_key}

    return await _create_account_and_mapping(client, user_id)


async def _provision_user(user_id: str) -> dict:
    user_id = _require_user_id(user_id)

    async with httpx.AsyncClient() as client:
        if await _sb_get_mapping(client, user_id):
            raise HTTPException(status_code=409, detail=f"user_id '{user_id}' is already provisioned")
        row = await _create_account_and_mapping(client, user_id)

    return {
        "user_id": user_id,
        "chat_key": row["chat_key"],
        "dev_key": row["dev_key"],
        "max_budget": START_BUDGET,
        "rpm_limit": DEFAULT_RPM_LIMIT,
        "tpm_limit": DEFAULT_TPM_LIMIT,
        "models": DEFAULT_MODELS,
    }


@app.post("/provision", dependencies=[Depends(require_internal_token)])
async def provision(req: ProvisionRequest):
    return await _provision_user(req.user_id)


# Portal only: user_id is the caller's own Logto sub.
@app.get("/account", dependencies=[Depends(require_internal_token)])
async def account(user_id: str):
    user_id = _require_user_id(user_id)
    async with httpx.AsyncClient() as client:
        mapping = await _ensure_provisioned(client, user_id)
        info = await _llm_get(client, "/user/info", {"user_id": user_id})
        u = info.get("user_info", info)
        max_budget = float(u.get("max_budget") or 0)
        spend = float(u.get("spend") or 0)
    return {
        "user_id": user_id,
        "dev_key": mapping.get("dev_key"),
        "max_budget": max_budget,
        "spend": round(spend, 6),
        "remaining": round(max_budget - spend, 6),
        "models": DEFAULT_MODELS,
    }


@app.get("/payments", dependencies=[Depends(require_internal_token)])
async def payments(user_id: str, limit: int = 20):
    user_id = user_id.strip()
    async with httpx.AsyncClient() as client:
        r = await _sb_request(client, "GET", SUPABASE_PAYMENTS_TABLE, params={
            "user_id": f"eq.{user_id}",
            "select": "amount,currency,txid,status,created_at",
            "order": "created_at.desc",
            "limit": str(max(1, min(limit, 100))),
        })
    return {"user_id": user_id, "payments": r.json()}


@app.post("/rotate-key", dependencies=[Depends(require_internal_token)])
async def rotate_key(req: RotateRequest):
    user_id = req.user_id.strip()
    async with httpx.AsyncClient() as client:
        mapping = await _sb_get_mapping(client, user_id)
        if not mapping:
            raise HTTPException(status_code=404, detail=f"account '{user_id}' not found")
        old_key = mapping.get("dev_key")
        # Mint, remap, then revoke (never keyless); timestamped alias because key_alias must be unique.
        new_key = await _make_key(client, user_id, f"dev-{user_id}-{int(time.time())}")
        await _sb_update_mapping(client, user_id, {"dev_key": new_key})
        if old_key:
            await _llm_delete_key(client, old_key)
    return {"user_id": user_id, "dev_key": new_key, "status": "rotated"}


@app.delete("/account", dependencies=[Depends(require_internal_token)])
async def delete_account(user_id: str):
    user_id = _require_user_id(user_id)
    async with httpx.AsyncClient() as client:
        # Logto identity goes last so a failed run can be retried. Every step is idempotent.
        await _llm_delete_user(client, user_id)
        await _sb_delete_mapping(client, user_id)
        await _logto_delete_user(client, user_id)
    return {"status": "deleted", "user_id": user_id}


async def _topup(user_id: str, amount: float, event_id: str, currency: str = "USDT") -> dict:
    """Raise the balance; idempotent by event_id (= ledger txid)."""
    user_id, event_id = user_id.strip(), event_id.strip()
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be > 0")
    if not event_id:
        raise HTTPException(status_code=400, detail="event_id is required (idempotency key)")
    if not SUPABASE_URL:
        raise HTTPException(status_code=503, detail="Supabase is not configured; top-ups are unavailable")

    async with httpx.AsyncClient() as client:
        if await _sb_event_exists(client, event_id):
            return {"status": "already_processed", "event_id": event_id}
        # Provision first so a payment for an unprovisioned user is never stranded.
        await _ensure_provisioned(client, user_id)
        info = await _llm_get(client, "/user/info", {"user_id": user_id})
        new_budget = float(info.get("user_info", info).get("max_budget") or 0) + amount
        await _llm_post(client, "/user/update", {"user_id": user_id, "max_budget": new_budget})
        # Ledger row last: its txid is the dedup key.
        await _sb_record_payment(client, user_id, amount, currency, event_id)

    return {"status": "applied", "user_id": user_id, "added": amount, "new_budget": new_budget}


@app.post("/topup", dependencies=[Depends(require_internal_token)])
async def topup(req: TopupRequest):
    return await _topup(req.user_id, req.amount, req.event_id, req.currency)


MIN_TOPUP_USD = 5  # fees eat ~10-15% below this


async def _np_create_invoice(user_id: str, amount: float) -> dict:
    if amount < MIN_TOPUP_USD:
        raise HTTPException(status_code=400, detail=f"minimum top-up is ${MIN_TOPUP_USD}")
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{NOWPAYMENTS_API_URL}/invoice",
            headers={"x-api-key": NOWPAYMENTS_API_KEY, "Content-Type": "application/json"},
            json={
                "price_amount": amount,
                # Priced in USDT so the user sees a round number; 1 USDT = $1 of balance.
                "price_currency": "usdt",
                "order_id": user_id,  # the webhook uses it to know whom to credit
                "order_description": f"ShadowRouter balance top-up {amount} USDT",
                "ipn_callback_url": f"{PUBLIC_BASE_URL}/hooks/nowpayments",
                "success_url": PORTAL_SUCCESS_URL,
                "cancel_url": PORTAL_CANCEL_URL,
            },
            timeout=30,
        )
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"NOWPayments /invoice -> {r.status_code}: {r.text[:300]}")
    return r.json()


@app.post("/billing/create-invoice", dependencies=[Depends(require_internal_token)])
async def create_invoice(req: InvoiceRequest):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be > 0")
    if not NOWPAYMENTS_API_KEY:
        raise HTTPException(status_code=503, detail="NOWPAYMENTS_API_KEY is not set")
    data = await _np_create_invoice(req.user_id.strip(), req.amount)
    return {"invoice_url": data.get("invoice_url"), "invoice_id": data.get("id")}


def _verify_nowpayments_signature(raw_body: bytes, signature: str) -> bool:
    if not NOWPAYMENTS_IPN_SECRET:
        return False
    try:
        payload = json.loads(raw_body or b"{}")
    except ValueError:
        return False

    # NOWPayments signs HMAC-SHA512 over compact JSON with sorted keys.
    sorted_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    expected = hmac.new(NOWPAYMENTS_IPN_SECRET.encode(), sorted_json.encode(), hashlib.sha512).hexdigest()
    if hmac.compare_digest(expected, signature or ""):
        return True
    # Log the fact only, never the body or the secret.
    print("[nowpayments] signature mismatch; check NOWPAYMENTS_IPN_SECRET in env")
    return False


@app.post("/hooks/nowpayments")
async def nowpayments_webhook(request: Request, x_nowpayments_sig: str = Header(default="")):
    """NOWPayments IPN: signature-authenticated; credits the balance on 'finished'."""
    raw = await request.body()
    if not _verify_nowpayments_signature(raw, x_nowpayments_sig):
        raise HTTPException(status_code=401, detail="invalid NOWPayments signature")

    payload = json.loads(raw or b"{}")
    if payload.get("payment_status") != "finished":
        return {"status": "ignored", "payment_status": payload.get("payment_status")}

    user_id = (payload.get("order_id") or "").strip()
    amount = float(payload.get("price_amount") or 0)   # priced in USDT, credited 1:1 (see _np_create_invoice)
    txid = str(payload.get("payment_id") or "")
    if not user_id or amount <= 0 or not txid:
        raise HTTPException(status_code=400, detail="IPN is missing order_id/price_amount/payment_id")

    result = await _topup(user_id, amount, txid, payload.get("pay_currency") or "crypto")
    return {"status": "credited", "user_id": user_id, "topup": result.get("status")}


_logto_token_cache: dict = {"token": "", "exp": 0.0}


async def _logto_m2m_token(client: httpx.AsyncClient) -> str:
    """Management API token (client_credentials), cached until near expiry."""
    if _logto_token_cache["token"] and time.time() < _logto_token_cache["exp"] - 60:
        return _logto_token_cache["token"]
    # Logto Cloud resource is https://<tenant>.logto.app/api, not default.logto.app (self-hosted).
    resource = os.environ.get("LOGTO_MGMT_RESOURCE", "") or f"{LOGTO_ENDPOINT}/api"
    r = await client.post(
        f"{LOGTO_ENDPOINT}/oidc/token",
        data={
            "grant_type": "client_credentials",
            "resource": resource,
            "scope": "all",
        },
        auth=(LOGTO_M2M_CLIENT_ID, LOGTO_M2M_CLIENT_SECRET),
        timeout=15,
    )
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Logto /oidc/token -> {r.status_code}: {r.text[:200]}")
    body = r.json()
    _logto_token_cache["token"] = body["access_token"]
    _logto_token_cache["exp"] = time.time() + float(body.get("expires_in", 3600))
    return _logto_token_cache["token"]


async def _logto_set_synthetic_email(client: httpx.AsyncClient, logto_user_id: str) -> str:
    """Synthetic email <id>@SYNTHETIC_EMAIL_DOMAIN (LibreChat requires one). Not PII: random id, no MX."""
    token = await _logto_m2m_token(client)
    synthetic = f"{logto_user_id}@{SYNTHETIC_EMAIL_DOMAIN}"
    r = await client.patch(
        f"{LOGTO_ENDPOINT}/api/users/{logto_user_id}",
        json={"primaryEmail": synthetic},
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Logto PATCH /users -> {r.status_code}: {r.text[:200]}")
    return synthetic


async def _logto_delete_user(client: httpx.AsyncClient, logto_user_id: str):
    # 404 = already gone (idempotent).
    if not (LOGTO_ENDPOINT and LOGTO_M2M_CLIENT_ID):
        return
    token = await _logto_m2m_token(client)
    r = await client.delete(
        f"{LOGTO_ENDPOINT}/api/users/{logto_user_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    if r.status_code == 404:
        return
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Logto DELETE /users -> {r.status_code}: {r.text[:200]}")


def _verify_logto_signature(raw_body: bytes, signature: str) -> bool:
    # Logto signs the raw body with HMAC-SHA256 (header logto-signature-sha-256).
    if not LOGTO_WEBHOOK_SIGNING_KEY:
        return False
    expected = hmac.new(LOGTO_WEBHOOK_SIGNING_KEY.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


@app.post("/hooks/logto")
async def logto_webhook(request: Request, logto_signature_sha_256: str = Header(default="")):
    """Logto sign-up webhook: auto-provisions account + keys. Signature-authenticated."""
    raw = await request.body()
    if not _verify_logto_signature(raw, logto_signature_sha_256):
        raise HTTPException(status_code=401, detail="invalid Logto signature")

    payload = json.loads(raw or b"{}")
    if payload.get("event") != "User.Created":
        return {"status": "ignored", "event": payload.get("event")}

    data = payload.get("data") or {}
    # Map by the Logto sub, never by email.
    user_id = (data.get("id") or data.get("username") or data.get("primaryEmail") or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="payload has no id/username")

    status = "provisioned"
    try:
        await _provision_user(user_id)
    except HTTPException as e:
        if e.status_code != 409:  # 409 = already provisioned; for a webhook that's success
            raise
        status = "already_provisioned"

    # Non-fatal: provisioning is done; the email can be set by hand.
    synthetic_email = None
    email_error = None
    if not data.get("primaryEmail") and data.get("id") and LOGTO_ENDPOINT and LOGTO_M2M_CLIENT_ID:
        try:
            async with httpx.AsyncClient() as client:
                synthetic_email = await _logto_set_synthetic_email(client, data["id"])
        except HTTPException as e:
            # Reason goes in the body: visible in Logto -> Webhooks -> Recent requests.
            status += "_email_failed"
            email_error = str(e.detail)
            print(f"[hooks/logto] synthetic email failed for {data.get('id')}: {email_error}")

    return {"status": status, "user_id": user_id,
            "synthetic_email": synthetic_email, "email_error": email_error}
