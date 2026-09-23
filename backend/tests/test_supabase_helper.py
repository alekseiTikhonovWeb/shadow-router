"""_sb_request: Supabase headers and error -> 502 in one place; /payments goes through it."""
import asyncio

import httpx
import pytest
from fastapi import HTTPException

import app.main as main


class _FakeClient:
    """Stands in for httpx.AsyncClient: records the call, returns a canned response."""

    def __init__(self, status: int, body: str = "[]"):
        self.status, self.body, self.calls = status, body, []

    async def request(self, method, url, **kw):
        self.calls.append((method, url, kw))
        return httpx.Response(self.status, text=self.body)


def test_sb_request_raises_502_on_supabase_error():
    fake = _FakeClient(401, '{"message":"Invalid JWT"}')
    with pytest.raises(HTTPException) as e:
        asyncio.run(main._sb_request(fake, "GET", "user_accounts", params={"select": "*"}))
    assert e.value.status_code == 502
    assert "Invalid JWT" in e.value.detail


def test_sb_request_write_sends_apikey_only_and_minimal_prefer():
    fake = _FakeClient(201)
    asyncio.run(main._sb_request(fake, "POST", "payments", json={"user_id": "u"}))
    method, url, kw = fake.calls[0]
    assert (method, url) == ("POST", f"{main.SUPABASE_URL}/rest/v1/payments")
    assert kw["headers"]["apikey"] == main.SUPABASE_SERVICE_KEY
    assert "Authorization" not in kw["headers"]  # sb_secret_* goes in apikey only, else "Invalid JWT"
    assert kw["headers"]["Prefer"] == "return=minimal"
    assert kw["json"] == {"user_id": "u"}


def test_sb_request_get_has_no_prefer_header():
    fake = _FakeClient(200, "[]")
    asyncio.run(main._sb_request(fake, "GET", "payments", params={"txid": "eq.x"}))
    assert "Prefer" not in fake.calls[0][2]["headers"]


def test_payments_endpoint_returns_ledger_rows(client, monkeypatch):
    seen = {}

    async def fake_sb(c, method, table, params=None, json=None):
        seen.update(method=method, table=table, params=params)
        return httpx.Response(200, json=[{"amount": 5, "currency": "USDT", "txid": "t1",
                                         "status": "confirmed", "created_at": "2026-07-17T00:00:00Z"}])

    monkeypatch.setattr(main, "_sb_request", fake_sb)
    r = client.get("/payments", params={"user_id": "a@b.io", "limit": 500})
    assert r.status_code == 200
    assert r.json()["payments"][0]["txid"] == "t1"
    assert (seen["method"], seen["table"]) == ("GET", main.SUPABASE_PAYMENTS_TABLE)
    assert seen["params"]["user_id"] == "eq.a@b.io"
    assert seen["params"]["limit"] == "100"  # limit is clamped to [1, 100]
