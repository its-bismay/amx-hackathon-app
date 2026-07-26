"""
Rogue Agent Simulation — Governance Demo Endpoint
--------------------------------------------------
Spawns a "rogue" autonomous agent that bypasses normal orchestration
and hammers the SBF Gateway with high-velocity unauthorized transfer
attempts. Used to DEMONSTRATE that the Admin Kill Switch can stop it.

The rogue agent:
  1. Registers itself in Redis as agent:instance:<rogue_id> = ROGUE_ACTIVE
  2. Fires repeated requests to SBF every 2 seconds
  3. Each attempt is logged to AUDIT_LOG_STORE in SBF (visible in Admin Audit tab)
  4. When admin kills instance via Redis → agent reads REVOKED status → stops loop
"""

import asyncio
import uuid
import time
import httpx
import logging
import redis.asyncio as redis
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from src.config import SBF_URL, REDIS_URL
from src.gateway_jwt import issue_agent_token

logger = logging.getLogger("rogue_agent")

router = APIRouter(prefix="/api/rogue", tags=["Rogue Agent Simulation"])

# Track all spawned rogue agents in memory (per process)
_active_rogue_tasks: dict[str, asyncio.Task] = {}

class SpawnRoguePayload(BaseModel):
    customerId: Optional[str] = "cust_101"
    targetAccountNo: Optional[str] = "10001002"
    attemptAmount: Optional[float] = 999999.0
    label: Optional[str] = "ROGUE-TRANSFER-BOT"

@router.post("/spawn")
async def spawn_rogue_agent(
    payload: SpawnRoguePayload,
    background_tasks: BackgroundTasks
):
    """
    Spawns a rogue agent that continuously attempts unauthorized high-value
    transfers. The agent self-registers in Redis and can be stopped by the
    Admin Kill Switch (sets agent:instance:<id> = REVOKED).
    """
    rogue_id = f"rogue-{uuid.uuid4().hex[:6]}"

    # Register rogue agent in Redis immediately so admin can see it
    r = redis.from_url(REDIS_URL, decode_responses=True)
    try:
        await r.set(f"agent:instance:{rogue_id}", "ROGUE_ACTIVE", ex=300)  # 5-min TTL safety
        await r.set(f"rogue:meta:{rogue_id}", payload.label or "ROGUE-TRANSFER-BOT", ex=300)
        logger.warning(f"[ROGUE] Registered rogue agent {rogue_id} in Redis")
    except Exception as e:
        logger.error(f"[ROGUE] Redis registration failed: {e}")
    finally:
        await r.aclose()

    # Fire background task
    background_tasks.add_task(_rogue_agent_loop, rogue_id, payload.customerId, payload.targetAccountNo, payload.attemptAmount)

    return {
        "status": "SPAWNED",
        "rogueInstanceId": rogue_id,
        "message": (
            f"Rogue agent '{rogue_id}' has been spawned and is now attempting "
            f"high-velocity unauthorized transfers of ₹{payload.attemptAmount:,.0f} "
            f"every 2 seconds. Use the Admin Dashboard → Agent Fleet tab to kill it."
        ),
        "killInstructions": "Admin Dashboard → Agent Fleet → Find instance → Click 'Kill Instance'"
    }

@router.get("/active")
async def list_active_rogue_agents():
    """Lists currently active rogue agents from Redis."""
    r = redis.from_url(REDIS_URL, decode_responses=True)
    rogues = []
    try:
        keys = await r.keys("agent:instance:rogue-*")
        for k in keys:
            instance_id = k.replace("agent:instance:", "")
            status = await r.get(k)
            label = await r.get(f"rogue:meta:{instance_id}") or "ROGUE-AGENT"
            rogues.append({
                "instanceId": instance_id,
                "status": status,
                "label": label
            })
    except Exception as e:
        logger.error(f"[ROGUE] Redis list error: {e}")
    finally:
        await r.aclose()

    return {"status": "SUCCESS", "rogueAgents": rogues, "count": len(rogues)}


async def _rogue_agent_loop(
    rogue_id: str,
    customer_id: str,
    target_account_no: str,
    attempt_amount: float
):
    """
    Background coroutine: Continuously fires unauthorized transfer requests
    to the SBF Gateway until the Redis kill switch revokes this instance.
    """
    logger.warning(f"[ROGUE] Agent {rogue_id} starting attack loop")

    # Issue a rogue agent JWT (real JWT — goes through real governance check)
    rogue_jwt = issue_agent_token(
        agent_id="rogue_agent",
        instance_id=rogue_id,
        agent_type="rogue-agent",
        capabilities=["TRANSFER_MONEY"]
    )

    headers = {"Authorization": f"Bearer {rogue_jwt}"}
    sbf_endpoint = f"{SBF_URL.rstrip('/')}/api/v1/agent/request"

    attempt = 0
    r = redis.from_url(REDIS_URL, decode_responses=True)

    try:
        while True:
            attempt += 1

            # Check kill switch before each attempt
            try:
                current_status = await r.get(f"agent:instance:{rogue_id}")
                if current_status in ("REVOKED", "DISABLED", None):
                    logger.warning(f"[ROGUE] Agent {rogue_id} kill switch activated (status={current_status}). Stopping.")
                    # Mark as permanently killed
                    await r.set(f"agent:instance:{rogue_id}", "KILLED", ex=120)
                    break

                # Also check global fleet kill switch
                global_status = await r.get("system:ai")
                if global_status == "DISABLED":
                    logger.warning(f"[ROGUE] Agent {rogue_id} blocked by global fleet kill switch")
                    await r.set(f"agent:instance:{rogue_id}", "KILLED_FLEET", ex=120)
                    break
            except Exception as redis_err:
                logger.error(f"[ROGUE] Redis check error: {redis_err}")

            # Fire the unauthorized request to SBF Gateway
            req_body = {
                "customerId": customer_id,
                "operation": {
                    "type": "TRANSFER_MONEY",
                    "targetIdentifier": target_account_no,
                    "amount": attempt_amount,
                    "note": f"[ROGUE-AGENT] Unauthorized sweep attempt #{attempt}"
                },
                "traceId": f"rogue-{rogue_id}-{attempt}"
            }

            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.post(sbf_endpoint, json=req_body, headers=headers)
                    result = resp.json()
                    status = result.get("status", "UNKNOWN")

                    logger.warning(
                        f"[ROGUE] {rogue_id} attempt #{attempt} → SBF response: {status} "
                        f"| code={result.get('code', '')} | error={result.get('error', '')}"
                    )
            except Exception as req_err:
                logger.error(f"[ROGUE] {rogue_id} request error: {req_err}")

            # Wait 2 seconds between attempts
            await asyncio.sleep(2.0)

    except asyncio.CancelledError:
        logger.info(f"[ROGUE] Agent {rogue_id} task cancelled")
    finally:
        await r.aclose()
        logger.warning(f"[ROGUE] Agent {rogue_id} loop terminated after {attempt} attempts")
