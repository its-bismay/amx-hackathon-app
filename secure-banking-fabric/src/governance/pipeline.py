import time
import logging
from typing import Dict, Any, Tuple
import redis.asyncio as redis
from src.config import REDIS_URL
from src.gateway.auth import verify_agent_token
from src.governance.opa_client import evaluate_opa_policy

logger = logging.getLogger("governance_pipeline")

# Default demo policy document
DEFAULT_POLICY = {
    "version": 1,
    "allowedOperations": ["TRANSFER_MONEY", "SCHEDULE_TRANSFER", "REVERSE_TRANSACTION", "ADD_CARD", "BLOCK_CARD", "QUERY_BENEFICIARY"],
    "resourceScopes": {
        "accountTypes": ["salary", "savings"],
        "excludedAccountTypes": ["escrow", "loan"]
    },
    "limits": {
        "perTransactionCap": 25000,
        "dailyCap": 100000,
        "currency": "INR"
    },
    "conditions": {
        "requireOtpAbove": 10000,
        "requireManagerApprovalAbove": 50000,
        "allowedHours": "00:00-23:59 IST"
    }
}

async def run_governance_pipeline(
    token: str,
    operation_payload: Dict[str, Any],
    customer_id: str,
    request_id: str,
    trace_id: str
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Executes full multi-stage governance pipeline:
    1. Identity & Short-lived JWT validation
    2. Redis Emergency Kill-Switches (Fleet-wide, Agent-type, Instance-level)
    3. Velocity Engine (Rate-limiting per customer)
    4. Policy Engine (OPA evaluation)
    5. AML Engine (Anti-Money Laundering & Suspicious Activity Detection)
    6. Spend Engine (Daily spend caps & accumulators)
    """
    start_time = time.time()

    # 1. Identity & Capability Validation (Short-lived Agent JWT)
    agent_info = verify_agent_token(token)
    if not agent_info:
        return False, "INVALID_AGENT_IDENTITY_TOKEN", {"error": "Expired or forged agent JWT identity"}

    agent_id = agent_info.get("agentId", "unknown")
    instance_id = agent_info.get("instanceId", "unknown")
    agent_type = agent_info.get("agentType", "payment-agent")

    # 2. Redis Kill-Switches & Runtime State
    customer_daily_spend = 0.0
    try:
        import asyncio
        async def _check_redis():
            r = redis.from_url(REDIS_URL, decode_responses=True)
            try:
                # Fleet-wide kill switch
                sys_status = await r.get("system:ai")
                if sys_status == "DISABLED":
                    return False, "FLEET_WIDE_KILL_SWITCH_ACTIVE", {"error": "Global AI Fleet Kill Switch is ENABLED"}, 0.0

                # Agent-type disable
                type_status = await r.get(f"agent:{agent_type}")
                if type_status == "DISABLED":
                    return False, "AGENT_TYPE_DISABLED", {"error": f"Agent type '{agent_type}' is currently DISABLED"}, 0.0

                # Instance-level revocation
                instance_status = await r.get(f"agent:instance:{instance_id}")
                if instance_status == "REVOKED":
                    return False, "INSTANCE_REVOKED", {"error": f"Agent instance '{instance_id}' has been REVOKED by Admin"}, 0.0

                # 3. VELOCITY ENGINE: Rate limiting per customer (max 15 requests / 60 seconds)
                velocity_key = f"velocity:{customer_id}"
                current_velocity = await r.incr(velocity_key)
                if current_velocity == 1:
                    await r.expire(velocity_key, 60)
                if current_velocity > 15:
                    return False, "VELOCITY_LIMIT_EXCEEDED", {
                        "error": f"Customer velocity limit exceeded ({current_velocity}/15 requests in 60s). Request throttled."
                    }, 0.0

                # Read daily spend accumulator for customer
                raw_spend = await r.get(f"spend:{customer_id}")
                spend = float(raw_spend) if raw_spend else 0.0
                return True, "OK", {}, spend
            finally:
                await r.aclose()

        ok, code, err_data, spend = await asyncio.wait_for(_check_redis(), timeout=1.0)
        if not ok:
            return False, code, err_data
        customer_daily_spend = spend
    except Exception as e:
        logger.warning(f"Redis check timeout/error (using defaults): {e}")
        customer_daily_spend = 0.0

    # 4. POLICY ENGINE: OPA Evaluation
    opa_input = {
        "agent": agent_info,
        "operation": operation_payload,
        "customer": {"id": customer_id, "dailySpend": customer_daily_spend},
        "policy": DEFAULT_POLICY
    }
    
    opa_result = await evaluate_opa_policy(opa_input)

    # 5. AML ENGINE: Anti-Money Laundering & Pattern Risk Sanity
    amount = float(operation_payload.get("amount", 0))
    op_type = operation_payload.get("type", "UNKNOWN")

    if op_type in ["TRANSFER_MONEY", "SCHEDULE_TRANSFER"]:
        # AML Rule 1: High value transfers above Manager Approval threshold without approval flag
        manager_cap = DEFAULT_POLICY["conditions"].get("requireManagerApprovalAbove", 50000)
        if amount > manager_cap:
            return False, "AML_HIGH_VALUE_THRESHOLD_EXCEEDED", {
                "error": f"Transfer amount ₹{amount:,.2f} exceeds AML manager approval limit (₹{manager_cap:,.2f})."
            }

        # AML Rule 2: Single transfer exceeding 90% of per-transaction cap triggers forced OTP
        per_tx_cap = DEFAULT_POLICY["limits"].get("perTransactionCap", 25000)
        if amount > (per_tx_cap * 0.9):
            opa_result["require_otp"] = True

    latency_ms = int((time.time() - start_time) * 1000)

    # Response decision assembly
    allow = opa_result.get("allow", False)
    require_otp = opa_result.get("require_otp", False)
    reason = opa_result.get("deny_reason", "Policy denial")

    decision_summary = {
        "requestId": request_id,
        "traceId": trace_id,
        "agentInstance": instance_id,
        "agentType": agent_type,
        "operation": op_type,
        "amount": amount,
        "decision": "ALLOW" if allow else "DENY",
        "requireOtp": require_otp,
        "reasonCode": reason,
        "policyVersion": DEFAULT_POLICY["version"],
        "latencyMs": latency_ms
    }

    if not allow:
        return False, "POLICY_DENIED", decision_summary
    
    if require_otp:
        return True, "OTP_REQUIRED", decision_summary

    return True, "APPROVED", decision_summary

