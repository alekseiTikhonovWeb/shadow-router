"""Provisioning: account + exactly two keys, budget 0, idempotency."""
import app.main as main


def test_provision_creates_account_and_two_keys(client, monkeypatch):
    posts = []

    async def fake_get_mapping(c, user_id):
        return None  # not provisioned yet

    async def fake_llm_post(c, path, payload):
        posts.append((path, payload))
        if path == "/key/generate":
            return {"key": f"sk-{payload['key_alias']}"}
        return {}

    inserted = {}

    async def fake_insert(c, row):
        inserted.update(row)

    monkeypatch.setattr(main, "_sb_get_mapping", fake_get_mapping)
    monkeypatch.setattr(main, "_llm_post", fake_llm_post)
    monkeypatch.setattr(main, "_sb_insert_mapping", fake_insert)

    r = client.post("/provision", json={"user_id": "a@b.io"})
    assert r.status_code == 200
    body = r.json()

    # anti-abuse: new accounts start at $0
    assert body["max_budget"] == 0
    assert body["chat_key"].startswith("sk-chat-")
    assert body["dev_key"].startswith("sk-dev-")

    user_new = [p for p in posts if p[0] == "/user/new"]
    assert len(user_new) == 1
    assert user_new[0][1]["max_budget"] == 0
    assert user_new[0][1]["auto_create_key"] is False

    keys = [p for p in posts if p[0] == "/key/generate"]
    assert len(keys) == 2
    for _, payload in keys:
        assert payload["rpm_limit"] == 60
        assert payload["tpm_limit"] == 150000

    assert inserted["chat_key"] and inserted["dev_key"]
    assert inserted["user_id"] == "a@b.io"


def test_provision_idempotent_returns_409(client, monkeypatch):
    async def fake_get_mapping(c, user_id):
        return {"user_id": user_id}  # already provisioned

    monkeypatch.setattr(main, "_sb_get_mapping", fake_get_mapping)

    r = client.post("/provision", json={"user_id": "a@b.io"})
    assert r.status_code == 409
