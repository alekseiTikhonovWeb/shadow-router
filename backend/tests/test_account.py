"""/account and /rotate-key; unknown users self-heal, see test_self_healing.py."""
import app.main as main


def test_account_returns_key_and_balance(client, monkeypatch):
    async def fake_mapping(c, user_id):
        return {"user_id": user_id, "dev_key": "sk-dev-xyz", "chat_key": "sk-chat-xyz"}

    async def fake_user_info(c, path, params):
        return {"user_info": {"max_budget": 10, "spend": 2.5}}

    monkeypatch.setattr(main, "_sb_get_mapping", fake_mapping)
    monkeypatch.setattr(main, "_llm_get", fake_user_info)

    r = client.get("/account", params={"user_id": "a@b.io"})
    assert r.status_code == 200
    body = r.json()
    assert body["dev_key"] == "sk-dev-xyz"
    assert body["max_budget"] == 10
    assert body["spend"] == 2.5
    assert body["remaining"] == 7.5


def test_account_400_on_blank_user_id(client):
    r = client.get("/account", params={"user_id": "  "})
    assert r.status_code == 400


def test_account_requires_token(client_no_token):
    r = client_no_token.get("/account", params={"user_id": "a@b.io"})
    assert r.status_code == 401


def test_rotate_key_creates_new_and_revokes_old(client, monkeypatch):
    calls = {"updated": None, "deleted": None}

    async def fake_mapping(c, user_id):
        return {"user_id": user_id, "dev_key": "sk-old"}

    async def fake_make_key(c, user_id, alias):
        return "sk-new"

    async def fake_update(c, user_id, patch):
        calls["updated"] = patch

    async def fake_delete(c, key):
        calls["deleted"] = key

    monkeypatch.setattr(main, "_sb_get_mapping", fake_mapping)
    monkeypatch.setattr(main, "_make_key", fake_make_key)
    monkeypatch.setattr(main, "_sb_update_mapping", fake_update)
    monkeypatch.setattr(main, "_llm_delete_key", fake_delete)

    r = client.post("/rotate-key", json={"user_id": "a@b.io"})
    assert r.status_code == 200
    assert r.json()["dev_key"] == "sk-new"
    assert calls["updated"] == {"dev_key": "sk-new"}
    assert calls["deleted"] == "sk-old"
