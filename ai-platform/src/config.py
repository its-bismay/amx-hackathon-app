import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.getenv("PORT", "8000"))
AI_PLATFORM_DATABASE_URL = os.getenv("AI_PLATFORM_DATABASE_URL", "sqlite:///./ai_platform.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
SBF_URL = os.getenv("SBF_URL", "http://localhost:8001")
JWT_SECRET = os.getenv("JWT_SECRET", "sbf-agent-jwt-secret-key-change-in-prod")
# Inngest keys are NOT imported here — the SDK auto-reads:
#   Dev:  INNGEST_DEV=1  (no keys needed)
#   Prod: INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY env vars

GEMINI_API_KEYS = [
    os.getenv(f"GEMINI_API_KEY_{i}", f"mock-gemini-key-{i}")
    for i in range(1, 5)
]
