"""Top-up: max_budget += amount; a repeated event_id is a no-op."""
import app.main as main


def test_topup_applies_and_raises_budget(client, monkeypatch):
    posts = []

    async def fake_event_exists(c, event_id):
        return False  # unseen txid

    async def fake_ensure(c, user_id):
        return {"user_id": user_id}  # self-healing stubbed: user exists

    async def fake_llm_get(c, path, params):
        return {"user_info": {"max_budget": 5}}  # current balance $5

    async def fake_llm_post(c, path, payload):
        posts.append((path, payload))
        return {}

    payment = {}

    async def fake_record_payment(c, user_id, amount, currency, txid):
        payment.update(user_id=user_id, amount=amount, currency=currency, txid=txid)

    monkeypatch.setattr(main, "_sb_event_exists", fake_event_exists)
    monkeypatch.setattr(main, "_ensure_provisioned", fake_ensure)
    monkeypatch.setattr(main, "_llm_get", fake_llm_get)
    monkeypatch.setattr(main, "_llm_post", fake_llm_post)
    monkeypatch.setattr(main, "_sb_record_payment", fake_record_payment)

    r = client.post("/topup", json={"user_id": "a@b.io", "amount": 10, "event_id": "evt-1", "currency": "USDT"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "applied"
    assert body["new_budget"] == 15  # 5 + 10

    upd = [p for p in posts if p[0] == "/user/update"]
    assert len(upd) == 1
    assert upd[0][1]["max_budget"] == 15
    assert payment == {"user_id": "a@b.io", "amount": 10, "currency": "USDT", "txid": "evt-1"}


def test_topup_idempotent_skips_duplicate(client, monkeypatch):
    posts = []

    async def fake_event_exists(c, event_id):
        return True  # already processed

    async def fake_llm_post(c, path, payload):
        posts.append(path)
        return {}

    monkeypatch.setattr(main, "_sb_event_exists", fake_event_exists)
    monkeypatch.setattr(main, "_llm_post", fake_llm_post)

    r = client.post("/topup", json={"user_id": "a@b.io", "amount": 10, "event_id": "evt-1"})
    assert r.status_code == 200
    assert r.json()["status"] == "already_processed"
    # the key check: no /user/update call, so no double credit
    assert posts == []


def test_topup_rejects_nonpositive_amount(client):
    r = client.post("/topup", json={"user_id": "a@b.io", "amount": 0, "event_id": "evt"})
    assert r.status_code == 400
