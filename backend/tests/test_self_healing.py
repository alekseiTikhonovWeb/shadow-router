"""Unknown users are provisioned by /account and /topup; a stale mapping gets a new LiteLLM account."""
from fastapi import HTTPException

import app.main as main


def test_account_autoprovisions_unknown_user(client, monkeypatch):
    calls = {"provisioned": False}

    async def fake_mapping(c, user_id):
        return None  # no mapping: the sign-up webhook was lost

    async def fake_create(c, user_id, alias_suffix=""):
        calls["provisioned"] = True
        return "sk-chat-new", "sk-dev-new"

    async def fake_insert(c, row):
        calls["row"] = row

    async def fake_llm_get(c, path, params):
        return {"user_info": {"max_budget": 0, "spend": 0}}

    monkeypatch.setattr(main, "_sb_get_mapping", fake_mapping)
    monkeypatch.setattr(main, "_create_litellm_account", fake_create)
    monkeypatch.setattr(main, "_sb_insert_mapping", fake_insert)
    monkeypatch.setattr(main, "_llm_get", fake_llm_get)

    r = client.get("/account", params={"user_id": "ghost@b.io"})
    assert r.status_code == 200            # not 404: self-healed
    assert calls["provisioned"] is True
    assert r.json()["dev_key"] == "sk-dev-new"
    assert calls["row"]["user_id"] == "ghost@b.io"


def test_topup_autoprovisions_before_credit(client, monkeypatch):
    order = []

    async def fake_event_exists(c, event_id):
        return False

    async def fake_ensure(c, user_id):
        order.append("ensure")
        return {"user_id": user_id, "dev_key": "sk-dev"}

    async def fake_llm_get(c, path, params):
        order.append("user_info")
        return {"user_info": {"max_budget": 0}}

    async def fake_llm_post(c, path, payload):
        order.append(path)
        return {}

    async def fake_record(c, user_id, amount, currency, txid):
        order.append("ledger")

    monkeypatch.setattr(main, "_sb_event_exists", fake_event_exists)
    monkeypatch.setattr(main, "_ensure_provisioned", fake_ensure)
    monkeypatch.setattr(main, "_llm_get", fake_llm_get)
    monkeypatch.setattr(main, "_llm_post", fake_llm_post)
    monkeypatch.setattr(main, "_sb_record_payment", fake_record)

    r = client.post("/topup", json={"user_id": "ghost@b.io", "amount": 5, "event_id": "pay-1"})
    assert r.status_code == 200
    assert r.json()["status"] == "applied"
    # provisioning must happen before the balance read and the credit
    assert order.index("ensure") < order.index("user_info") < order.index("/user/update")
    assert "ledger" in order


def test_ensure_recreates_stale_mapping(client, monkeypatch):
    """Mapping exists but LiteLLM says 404 (recreated DB) -> new keys + mapping update."""
    calls = {}

    async def fake_mapping(c, user_id):
        return {"user_id": user_id, "chat_key": "sk-chat-old", "dev_key": "sk-dev-old"}

    async def fake_llm_get(c, path, params):
        raise HTTPException(status_code=404, detail="not found")

    async def fake_create(c, user_id, alias_suffix=""):
        calls["suffix"] = alias_suffix
        return "sk-chat-new", "sk-dev-new"

    async def fake_update(c, user_id, patch):
        calls["patch"] = patch

    monkeypatch.setattr(main, "_sb_get_mapping", fake_mapping)
    monkeypatch.setattr(main, "_llm_get", fake_llm_get)
    monkeypatch.setattr(main, "_create_litellm_account", fake_create)
    monkeypatch.setattr(main, "_sb_update_mapping", fake_update)

    import anyio, httpx

    async def run():
        async with httpx.AsyncClient() as c:
            return await main._ensure_provisioned(c, "stale@b.io")

    mapping = anyio.run(run)
    assert mapping["dev_key"] == "sk-dev-new"
    assert calls["patch"] == {"chat_key": "sk-chat-new", "dev_key": "sk-dev-new"}
    assert calls["suffix"].startswith("-")  # timestamp suffix so aliases don't collide
