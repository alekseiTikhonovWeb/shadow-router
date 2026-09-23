"""catalog.yaml holds provider cost at 1x (gen_config.py applies MARKUP), so it must equal the official list."""
from pathlib import Path
import yaml

# Official prices per 1M tokens (input, output), checked against provider sites 2026-07-08.
OFFICIAL_PER_M = {
    # OpenAI
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-5.4-nano": (0.20, 1.25),
    "gpt-5.4-mini": (0.75, 4.50),
    "gpt-5.4": (2.50, 15.0),
    "gpt-5.4-pro": (30.0, 180.0),
    "gpt-5.5": (5.0, 30.0),
    "gpt-5.5-pro": (30.0, 180.0),
    "gpt-5.6-luna": (1.0, 6.0),
    "gpt-5.6-terra": (2.50, 15.0),
    "gpt-5.6-sol": (5.0, 30.0),
    "gpt-5.3-codex": (1.75, 14.0),
    # Gemini
    "gemini-2.5-flash": (0.30, 2.50),
    "gemini-2.5-pro": (1.25, 10.0),
    # Anthropic (4.5 and newer)
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-sonnet-4-5": (3.0, 15.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-sonnet-5": (3.0, 15.0),
    "claude-opus-4-5": (5.0, 25.0),
    "claude-opus-4-6": (5.0, 25.0),
    "claude-opus-4-7": (5.0, 25.0),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-fable-5": (10.0, 50.0),
    "claude-mythos-5": (10.0, 50.0),
    # xAI / DeepSeek
    "grok-4.3": (1.25, 2.50),
    "grok-build-0.1": (1.0, 2.0),
    "deepseek-v4-flash": (0.14, 0.28),
    "deepseek-v4-pro": (0.435, 0.87),
}

CATALOG = Path(__file__).resolve().parents[2] / "litellm" / "catalog.yaml"


def _all_models():
    cat = yaml.safe_load(CATALOG.read_text())
    out = {}
    for prov in cat["providers"].values():
        for m in prov["models"]:
            out[m["id"]] = m
    return out


def test_confirmed_prices_match_official():
    models = _all_models()
    for mid, (in_m, out_m) in OFFICIAL_PER_M.items():
        assert mid in models, f"{mid} is missing from the catalog"
        m = models[mid]
        assert m["enabled"] is True, f"{mid} must be enabled (price confirmed)"
        assert abs(m["in"] - in_m) < 1e-9, f"{mid} input"
        assert abs(m["out"] - out_m) < 1e-9, f"{mid} output"


def test_unverified_models_are_flagged_not_priced_live():
    # Unconfirmed (tiered) pricing stays enabled:false.
    models = _all_models()
    for mid in ("gemini-2.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-pro-preview"):
        assert models[mid]["enabled"] is False, f"{mid} must be enabled:false (VERIFY)"
        assert models[mid]["in"] == 0, f"{mid} price must be 0 until confirmed"
