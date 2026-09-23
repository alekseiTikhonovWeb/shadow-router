"""NOWPayments: webhook (signature, statuses, idempotency) and create-invoice."""
import hashlib
import hmac
import json
import os

import app.main as main

IPN_SECRET = os.environ["NOWPAYMENTS_IPN_SECRET"]


def _sign(payload: dict) -> str:
    # same scheme as the backend: HMAC-SHA512 over compact JSON with sorted keys
    msg = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hmac.new(IPN_SECRET.encode(), msg.encode(), hashlib.sha512).hexdigest()


def test_webhook_finished_credits_balance(client, monkeypatch):
    called = {}

    async def fake_topup(user_id, amount, event_id, currency="USDT"):
        called.update(user_id=user_id, amount=amount, event_id=event_id, currency=currency)
        return {"status": "applied"}

    monkeypatch.setattr(main, "_topup", fake_topup)

    payload = {
        "payment_status": "finished",
        "order_id": "a@b.io",
        "price_amount": 5,
        "payment_id": "np-123",
        "pay_currency": "usdttrc20",
    }
    r = client.post("/hooks/nowpayments", json=payload, headers={"x-nowpayments-sig": _sign(payload)})
    assert r.status_code == 200
    assert r.json()["status"] == "credited"
    assert called == {"user_id": "a@b.io", "amount": 5.0, "event_id": "np-123", "currency": "usdttrc20"}


def test_webhook_bad_signature_rejected(client, monkeypatch):
    hit = {"topup": False}

    async def fake_topup(*a, **k):
        hit["topup"] = True
        return {}

    monkeypatch.setattr(main, "_topup", fake_topup)
    payload = {"payment_status": "finished", "order_id": "a@b.io", "price_amount": 5, "payment_id": "x"}
    r = client.post("/hooks/nowpayments", json=payload, headers={"x-nowpayments-sig": "deadbeef"})
    assert r.status_code == 401
    assert hit["topup"] is False


def test_webhook_unfinished_status_ignored(client, monkeypatch):
    hit = {"topup": False}

    async def fake_topup(*a, **k):
        hit["topup"] = True
        return {}

    monkeypatch.setattr(main, "_topup", fake_topup)
    payload = {"payment_status": "waiting", "order_id": "a@b.io", "price_amount": 5, "payment_id": "x"}
    r = client.post("/hooks/nowpayments", json=payload, headers={"x-nowpayments-sig": _sign(payload)})
    assert r.status_code == 200
    assert r.json()["status"] == "ignored"
    assert hit["topup"] is False


def test_create_invoice_returns_url(client, monkeypatch):
    seen = {}

    async def fake_np(user_id, amount):
        seen.update(user_id=user_id, amount=amount)
        return {"invoice_url": "https://nowpayments.io/payment/abc", "id": "inv-1"}

    monkeypatch.setattr(main, "_np_create_invoice", fake_np)
    r = client.post("/billing/create-invoice", json={"user_id": "a@b.io", "amount": 10})
    assert r.status_code == 200
    assert r.json()["invoice_url"] == "https://nowpayments.io/payment/abc"
    assert seen == {"user_id": "a@b.io", "amount": 10.0}


def test_create_invoice_rejects_below_minimum(client):
    r = client.post("/billing/create-invoice",
                    json={"user_id": "a@b.io", "amount": main.MIN_TOPUP_USD - 1})
    assert r.status_code == 400


def test_create_invoice_requires_token(client_no_token):
    r = client_no_token.post("/billing/create-invoice", json={"user_id": "a@b.io", "amount": 10})
    assert r.status_code == 401
