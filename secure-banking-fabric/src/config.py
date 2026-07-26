import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", "8001"))
BANK_DATABASE_URL = os.getenv("BANK_DATABASE_URL", "sqlite:///./mock_bank.db")
GOVERNANCE_DATABASE_URL = os.getenv("GOVERNANCE_DATABASE_URL", "sqlite:///./governance.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
OPA_URL = os.getenv("OPA_URL", "http://localhost:8181")
JWT_SECRET = os.getenv("JWT_SECRET", "sbf-agent-jwt-secret-key-change-in-prod")
BANK_API_URL = os.getenv("BANK_API_URL", "http://localhost:8001")
# Inngest keys are NOT imported here — the SDK auto-reads:
#   Dev:  INNGEST_DEV=1  (no keys needed)
#   Prod: INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY env vars
