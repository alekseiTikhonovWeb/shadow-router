"""Control-plane endpoints require X-Internal-Token."""


def test_provision_without_token_is_401(client_no_token):
    r = client_no_token.post("/provision", json={"user_id": "a@b.io"})
    assert r.status_code == 401


def test_topup_without_token_is_401(client_no_token):
    r = client_no_token.post("/topup", json={"user_id": "a@b.io", "amount": 5, "event_id": "e"})
    assert r.status_code == 401


def test_provision_with_wrong_token_is_401(client_no_token):
    r = client_no_token.post(
        "/provision", json={"user_id": "a@b.io"}, headers={"X-Internal-Token": "wrong"}
    )
    assert r.status_code == 401


def test_health_is_public(client_no_token):
    assert client_no_token.get("/health").status_code == 200
