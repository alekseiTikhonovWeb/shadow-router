"""DELETE /account wipes LiteLLM, the Supabase mapping and Logto, in that order."""
import app.main as main


def test_delete_account_wipes_all_stores_in_order(client, monkeypatch):
    order = []

    async def fake_llm_delete_user(c, user_id):
        order.append(("litellm", user_id))

    async def fake_sb_delete(c, user_id):
        order.append(("supabase", user_id))

    async def fake_logto_delete(c, user_id):
        order.append(("logto", user_id))

    monkeypatch.setattr(main, "_llm_delete_user", fake_llm_delete_user)
    monkeypatch.setattr(main, "_sb_delete_mapping", fake_sb_delete)
    monkeypatch.setattr(main, "_logto_delete_user", fake_logto_delete)

    r = client.request("DELETE", "/account", params={"user_id": "ob9zs0ey02ii"})
    assert r.status_code == 200
    assert r.json() == {"status": "deleted", "user_id": "ob9zs0ey02ii"}
    stores = [x[0] for x in order]
    assert stores == ["litellm", "supabase", "logto"]
    assert all(x[1] == "ob9zs0ey02ii" for x in order)


def test_delete_account_requires_token(client_no_token):
    r = client_no_token.request("DELETE", "/account", params={"user_id": "a"})
    assert r.status_code == 401


def test_delete_account_blank_id_400(client):
    r = client.request("DELETE", "/account", params={"user_id": "   "})
    assert r.status_code == 400
