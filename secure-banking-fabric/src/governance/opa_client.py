import httpx
import logging
from typing import Dict, Any
from src.config import OPA_URL

logger = logging.getLogger("opa_client")

async def evaluate_opa_policy(input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Query OPA sidecar for policy evaluation."""
    url = f"{OPA_URL.rstrip('/')}/v1/data/banking/governance"
    payload = {"input": input_data}
    
    try:
        async with httpx.AsyncClient(timeout=0.5) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 200:
                result = response.json().get("result", {})
                if result:
                    return {
                        "allow": result.get("allow", False),
                        "require_otp": result.get("require_otp", False),
                        "deny_reason": result.get("deny_reason", "Policy denial")
                    }
    except Exception as e:
        logger.warning(f"OPA sidecar unreachable ({e}), falling back to internal policy engine")
    
    # Fallback in-process evaluation if OPA sidecar is offline or uninitialized
    return _fallback_in_process_evaluation(input_data)

def _fallback_in_process_evaluation(input_data: Dict[str, Any]) -> Dict[str, Any]:
    policy = input_data.get("policy", {})
    op = input_data.get("operation", {})
    cust = input_data.get("customer", {})
    
    allowed_ops = policy.get("allowedOperations", [])
    if op.get("type") not in allowed_ops:
        return {"allow": False, "require_otp": False, "deny_reason": f"Operation type '{op.get('type')}' not permitted for this agent policy"}
    
    excluded_accs = policy.get("resourceScopes", {}).get("excludedAccountTypes", [])
    if op.get("accountType") in excluded_accs:
        return {"allow": False, "require_otp": False, "deny_reason": f"Account type '{op.get('accountType')}' is excluded from agent access"}
    
    per_tx_cap = policy.get("limits", {}).get("perTransactionCap", 25000)
    amount = float(op.get("amount", 0))
    if amount > per_tx_cap:
        return {"allow": False, "require_otp": False, "deny_reason": f"Transfer amount ₹{amount:,.2f} exceeds per-transaction cap of ₹{per_tx_cap:,.2f}"}
    
    daily_cap = policy.get("limits", {}).get("dailyCap", 100000)
    daily_spend = float(cust.get("dailySpend", 0))
    if (amount + daily_spend) > daily_cap:
        return {"allow": False, "require_otp": False, "deny_reason": f"Transfer amount ₹{amount:,.2f} exceeds remaining daily customer spend cap of ₹{daily_cap:,.2f}"}
    
    require_otp_above = policy.get("conditions", {}).get("requireOtpAbove", 10000)
    require_otp = amount > require_otp_above
    
    return {"allow": True, "require_otp": require_otp, "deny_reason": "Policy evaluation passed"}
