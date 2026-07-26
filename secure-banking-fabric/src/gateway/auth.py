import time
import jwt
from typing import Dict, Any, Optional
from fastapi import Header, HTTPException, Depends
from src.config import JWT_SECRET

JWT_ALGORITHM = "HS256"
AGENT_TOKEN_TTL = 900 # 15 minutes
USER_TOKEN_TTL = 86400 # 24 hours

def issue_agent_token(agent_id: str, instance_id: str, agent_type: str, capabilities: list[str]) -> str:
    """Generate a short-lived, signed JWT for a spawned agent instance."""
    now = int(time.time())
    payload = {
        "type": "AGENT",
        "agentId": agent_id,
        "instanceId": instance_id,
        "agentType": agent_type,
        "capabilities": capabilities,
        "iat": now,
        "exp": now + AGENT_TOKEN_TTL
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_agent_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode agent JWT token. Returns payload dict if valid, else None."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except Exception:
        return None

def issue_user_token(user_id: str, customer_id: str, email: str, role: str = "USER") -> str:
    """Generate a user session JWT for logged-in bank customers."""
    now = int(time.time())
    payload = {
        "type": "USER",
        "userId": user_id,
        "customerId": customer_id,
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + USER_TOKEN_TTL
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_user_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode user session JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") == "USER":
            return payload
        return None
    except Exception:
        return None

async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """FastAPI dependency to extract and authenticate logged-in user from Bearer token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    token = authorization.replace("Bearer ", "").strip()
    payload = verify_user_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    return payload
