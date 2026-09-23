"""External services are monkeypatched; no real stack or keys needed."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Env must be set BEFORE importing app: main.py reads it at import time.
os.environ.setdefault("LITELLM_MASTER_KEY", "sk-test-master")
os.environ.setdefault("LITELLM_BASE_URL", "http://litellm.test")
os.environ.setdefault("SUPABASE_URL", "http://supabase.test")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "sb_secret_test")
os.environ.setdefault("START_BUDGET", "0")
os.environ.setdefault("DEFAULT_RPM_LIMIT", "60")
os.environ.setdefault("DEFAULT_TPM_LIMIT", "150000")
os.environ.setdefault("DEFAULT_MODELS", "gemini-flash,gpt-4o-mini")
os.environ.setdefault("INTERNAL_API_TOKEN", "test-internal-token")
os.environ.setdefault("LOGTO_WEBHOOK_SIGNING_KEY", "test-logto-signing-key")
os.environ.setdefault("NOWPAYMENTS_API_KEY", "np-test-api-key")
os.environ.setdefault("NOWPAYMENTS_IPN_SECRET", "np-test-ipn-secret")

import pytest
from fastapi.testclient import TestClient
from app.main import app

INTERNAL_TOKEN = os.environ["INTERNAL_API_TOKEN"]


@pytest.fixture
def client():
    return TestClient(app, headers={"X-Internal-Token": INTERNAL_TOKEN})


@pytest.fixture
def client_no_token():
    return TestClient(app)
