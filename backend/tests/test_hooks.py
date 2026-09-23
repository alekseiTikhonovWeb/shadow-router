"""Logto webhook -> auto-provisioning: signature, idempotency, event filter."""
import hashlib
import hmac
import json
import os

import app.main as main

SIGNING_KEY = os.environ["LOGTO_WEBHOOK_SIGNING_KEY"]


def _sign(body: bytes) -> str:
    return hmac.new(SIGNING_KEY.encode(), body, hashlib.sha256).hexdigest()


def _post(client, payload: dict, signature: str | None = None):
    raw = json.dumps(payload).encode()
    sig = signature if signature is not None else _sign(raw)
    # send exactly the bytes the signature was computed over
    return client.post(
        "/hooks/logto",
        content=raw,
        headers={"Content-Type": "application/json", "logto-signature-sha-256": sig},
    )


def test_webhook_valid_signature_provisions(client_no_token, monkeypatch):
    called = {}

    async def fake_provision(user_id):
        called["user_id"] = user_id
        return {"user_id": user_id, "chat_key": "sk-chat", "dev_key": "sk-dev"}

    monkeypatch.setattr(main, "_provision_user", fake_provision)

    r = _post(client_no_token, {"event": "User.Created", "data": {"primaryEmail": "new@user.io"}})
    assert r.status_code == 200
    assert r.json()["status"] == "provisioned"
    assert called["user_id"] == "new@user.io"  # falls back to email when there is no id


def test_webhook_prefers_internal_id_over_email(client_no_token, monkeypatch):
    """PRIVACY: map by the internal Logto id, not by email/PII."""
    called = {}

    async def fake_provision(user_id):
        called["user_id"] = user_id
        return {"user_id": user_id}

    monkeypatch.setattr(main, "_provision_user", fake_provision)

    r = _post(client_no_token, {"event": "User.Created",
                                "data": {"id": "usr_abc123", "primaryEmail": "leak@pii.io"}})
    assert r.status_code == 200
    assert called["user_id"] == "usr_abc123"


def test_webhook_bad_signature_401(client_no_token, monkeypatch):
    monkeypatch.setattr(main, "_provision_user", lambda u: None)  # must not be called
    r = _post(client_no_token, {"event": "User.Created", "data": {"primaryEmail": "x@y.io"}},
              signature="deadbeef")
    assert r.status_code == 401


def test_webhook_ignores_other_events(client_no_token):
    r = _post(client_no_token, {"event": "User.Deleted", "data": {"id": "u1"}})
    assert r.status_code == 200
    assert r.json()["status"] == "ignored"


def test_webhook_already_provisioned_is_ok(client_no_token, monkeypatch):
    from fastapi import HTTPException

    async def fake_provision(user_id):
        raise HTTPException(status_code=409, detail="already provisioned")

    monkeypatch.setattr(main, "_provision_user", fake_provision)

    r = _post(client_no_token, {"event": "User.Created", "data": {"primaryEmail": "dup@user.io"}})
    assert r.status_code == 200
    assert r.json()["status"] == "already_provisioned"


def test_webhook_sets_synthetic_email_for_emailless_user(client_no_token, monkeypatch):
    """A user without an email gets a synthetic <id>@domain (LibreChat requires one)."""
    called = {}

    async def fake_provision(user_id):
        return {"user_id": user_id}

    async def fake_set_email(client, logto_user_id):
        called["logto_user_id"] = logto_user_id
        return f"{logto_user_id}@{main.SYNTHETIC_EMAIL_DOMAIN}"

    monkeypatch.setattr(main, "_provision_user", fake_provision)
    monkeypatch.setattr(main, "_logto_set_synthetic_email", fake_set_email)
    monkeypatch.setattr(main, "LOGTO_ENDPOINT", "https://tenant.logto.app")
    monkeypatch.setattr(main, "LOGTO_M2M_CLIENT_ID", "m2m-id")

    r = _post(client_no_token, {"event": "User.Created",
                                "data": {"id": "usr_noemail", "username": "privacy1"}})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "provisioned"
    assert called["logto_user_id"] == "usr_noemail"
    assert body["synthetic_email"] == f"usr_noemail@{main.SYNTHETIC_EMAIL_DOMAIN}"


def test_webhook_skips_synthetic_email_when_user_has_email(client_no_token, monkeypatch):
    async def fake_provision(user_id):
        return {"user_id": user_id}

    async def fake_set_email(client, logto_user_id):  # must not be called
        raise AssertionError("synthetic email must not be set for a user who already has one")

    monkeypatch.setattr(main, "_provision_user", fake_provision)
    monkeypatch.setattr(main, "_logto_set_synthetic_email", fake_set_email)
    monkeypatch.setattr(main, "LOGTO_ENDPOINT", "https://tenant.logto.app")
    monkeypatch.setattr(main, "LOGTO_M2M_CLIENT_ID", "m2m-id")

    r = _post(client_no_token, {"event": "User.Created",
                                "data": {"id": "usr_hasemail", "primaryEmail": "real@user.io"}})
    assert r.status_code == 200
    assert r.json()["synthetic_email"] is None
