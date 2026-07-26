import time
import jwt
from src.config import JWT_SECRET

def issue_agent_token(agent_id: str, instance_id: str, agent_type: str, capabilities: list) -> str:
    now = int(time.time())
    payload = {
        "agentId": agent_id,
        "instanceId": instance_id,
        "agentType": agent_type,
        "capabilities": capabilities,
        "iat": now,
        "exp": now + 900
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")
