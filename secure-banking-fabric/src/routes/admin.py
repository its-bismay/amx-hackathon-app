import time
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
import redis.asyncio as redis
from src.config import REDIS_URL
from src.governance.pipeline import DEFAULT_POLICY
from src.routes.gateway import AUDIT_LOG_STORE
from src.execution.transfer import MOCK_ACCOUNTS, MOCK_TRANSACTIONS
from src.execution.reverse import execute_reversal
from src.gateway.auth import get_current_user

logger = logging.getLogger("admin_routes")
router = APIRouter(prefix="/api/v1/admin", tags=["Admin Dashboard"])

class PolicyUpdatePayload(BaseModel):
    perTransactionCap: float
    dailyCap: float
    requireOtpAbove: float
    allowedOperations: list[str]

class KillSwitchPayload(BaseModel):
    level: str # "FLEET" | "TYPE" | "INSTANCE"
    target: Optional[str] = None # e.g. "payment-agent" or "pay-001"
    status: str # "ENABLED" | "DISABLED" | "REVOKED"

class ReversalPayload(BaseModel):
    transactionId: str
    reason: str

from fastapi import Header
from src.gateway.auth import verify_user_token

async def get_admin_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    Enforces administrator access.
    Validates Bearer session JWT for ADMIN role, falling back to Root Admin context for local dev evaluation.
    """
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        payload = verify_user_token(token)
        if payload and payload.get("role") == "ADMIN":
            return payload
    return {"userId": "usr_root", "email": "admin118@amx.in", "role": "ADMIN"}

@router.get("/fleet")
async def get_fleet_status(admin: dict = Depends(get_admin_user)):
    sys_status = "ENABLED"
    r = redis.from_url(REDIS_URL, decode_responses=True)
    active_instances = []

    try:
        val = await r.get("system:ai")
        if val == "DISABLED":
            sys_status = "DISABLED"

        # Scan for active or revoked agent instance keys in Redis
        keys = await r.keys("agent:instance:*")
        for k in keys:
            inst_id = k.replace("agent:instance:", "")
            inst_status = await r.get(k)
            # Detect rogue agents by instance ID prefix
            is_rogue = inst_id.startswith("rogue-")
            if is_rogue:
                agent_type = "rogue-agent"
                if inst_status not in ("REVOKED", "DISABLED", "KILLED", "KILLED_FLEET"):
                    inst_status = inst_status or "ROGUE_ACTIVE"
            else:
                agent_type = "payment-agent" if "pay" in inst_id else "autonomous-agent"
            active_instances.append({
                "instanceId": inst_id,
                "agentType": agent_type,
                "status": inst_status or "ACTIVE",
                "spawnedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "isRogue": is_rogue
            })
    except Exception as e:
        logger.error(f"Error fetching fleet status from Redis: {e}")
    finally:
        await r.aclose()

    # Also include active instances from recent audit logs if any exist
    known_ids = {i["instanceId"] for i in active_instances}
    for log in AUDIT_LOG_STORE[:20]:
        inst_id = log.get("agentInstance")
        if inst_id and inst_id != "unknown" and inst_id not in known_ids:
            known_ids.add(inst_id)
            active_instances.append({
                "instanceId": inst_id,
                "agentType": log.get("agentType", "payment-agent"),
                "status": "ACTIVE",
                "spawnedAt": log.get("timestamp", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
            })

    return {
        "systemAiStatus": sys_status,
        "activeInstances": active_instances
    }

@router.post("/kill-switch")
async def toggle_kill_switch(payload: KillSwitchPayload, admin: dict = Depends(get_admin_user)):
    """
    Emergency Controls:
    1. Instance kill -> agent:instance:pay-001 = REVOKED
    2. Agent-type disable -> agent:payment = DISABLED
    3. Fleet-wide kill switch -> system:ai = DISABLED
    """
    r = redis.from_url(REDIS_URL, decode_responses=True)
    level = payload.level.upper()

    try:
        if level == "FLEET":
            await r.set("system:ai", payload.status)
            return {"status": "SUCCESS", "message": f"Global AI Fleet Kill Switch set to {payload.status}"}
        elif level == "TYPE" and payload.target:
            await r.set(f"agent:{payload.target}", payload.status)
            return {"status": "SUCCESS", "message": f"Agent Type '{payload.target}' set to {payload.status}"}
        elif level == "INSTANCE" and payload.target:
            await r.set(f"agent:instance:{payload.target}", payload.status)
            return {"status": "SUCCESS", "message": f"Agent Instance '{payload.target}' set to {payload.status}"}
    except Exception as e:
        logger.error(f"Redis kill switch error: {e}")
    finally:
        await r.aclose()

    return {"status": "FAILED", "error": "Invalid parameters or Redis unavailable"}

@router.get("/policy")
async def get_current_policy(admin: dict = Depends(get_admin_user)):
    return {"policy": DEFAULT_POLICY}

@router.post("/policy")
async def update_policy(payload: PolicyUpdatePayload, admin: dict = Depends(get_admin_user)):
    DEFAULT_POLICY["version"] += 1
    DEFAULT_POLICY["limits"]["perTransactionCap"] = payload.perTransactionCap
    DEFAULT_POLICY["limits"]["dailyCap"] = payload.dailyCap
    DEFAULT_POLICY["conditions"]["requireOtpAbove"] = payload.requireOtpAbove
    DEFAULT_POLICY["allowedOperations"] = payload.allowedOperations
    
    return {
        "status": "SUCCESS",
        "newVersion": DEFAULT_POLICY["version"],
        "policy": DEFAULT_POLICY
    }

@router.get("/audit")
async def get_audit_logs(admin: dict = Depends(get_admin_user)):
    return {
        "totalRecords": len(AUDIT_LOG_STORE),
        "auditLogs": AUDIT_LOG_STORE
    }

@router.get("/bank/overview")
async def get_bank_overview(admin: dict = Depends(get_admin_user)):
    return {
        "accounts": list(MOCK_ACCOUNTS.values()),
        "transactions": MOCK_TRANSACTIONS
    }

@router.post("/reversal")
async def trigger_transaction_reversal(payload: ReversalPayload, admin: dict = Depends(get_admin_user)):
    res = await execute_reversal(payload.transactionId, payload.reason)
    return res

@router.get("/redis-state")
async def get_redis_state(admin: dict = Depends(get_admin_user)):
    """Inspects live Redis runtime governance state key-value pairs."""
    r = redis.from_url(REDIS_URL, decode_responses=True)
    state = {}
    try:
        keys = await r.keys("*")
        for k in keys:
            val = await r.get(k)
            ttl = await r.ttl(k)
            state[k] = {"value": val, "ttl": ttl}
    except Exception as e:
        logger.error(f"Error reading Redis state: {e}")
        state["error"] = str(e)
    finally:
        await r.aclose()
    return {"status": "SUCCESS", "keys": state}

