import time
import uuid
import httpx
import logging
from typing import Dict, Any, List
from src.config import SBF_URL
from src.gemini_pool import gemini_pool
from src.agents.resolver import resolve_target_resource
from src.agents.payment import prepare_payment_payload
from src.gateway_jwt import issue_agent_token
from src.security.guardrails import inspect_prompt_safety

logger = logging.getLogger("agent_orchestrator")

async def run_agent_orchestration_chain(
    prompt: str,
    user_id: str,
    customer_id: str = "cust_101"
) -> Dict[str, Any]:
    """
    Executes multi-agent reasoning chain with strict governed identity rules:
    0. Pre-LLM Security Guardrail Check (Prompt Injection & System Override Defense)
    1. Gemini Pool acquires key for intention analysis
    2. Spawns short-lived identity JWT for agent
    3. ResourceResolverAgent queries SBF Governed API (POST /api/v1/agent/request)
    4. PaymentAgent formats operational payload
    5. Transmits payload to SBF Agent Gateway for OPA Governance Execution
    """
    request_id = f"req_{uuid.uuid4().hex[:10]}"
    trace_id = f"tr_{uuid.uuid4().hex[:8]}"
    traces: List[Dict[str, Any]] = []

    # Step 0: Pre-LLM Security Guardrail Check
    guard_res = inspect_prompt_safety(prompt)
    if not guard_res.is_safe:
        traces.append({
            "step": "Pre-LLM Security Guardrail",
            "agent": "SecurityGuardrailAgent",
            "detail": f"BLOCKED [{guard_res.attack_category}]: {guard_res.reason}. Signature match: '{guard_res.matched_patterns[0]}'"
        })
        return {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "userMessage": prompt,
            "assistantResponse": (
                f"⚠️ Security Policy Blocked Request: Your prompt contains a prompt injection attack signature "
                f"or unauthorized system override pattern ({guard_res.reason}). "
                f"This event has been logged to the security audit trail."
            ),
            "status": "DENIED",
            "code": "PROMPT_INJECTION_DETECTED",
            "traces": traces
        }

    # Step 1: Acquire Gemini key from pool
    gemini_key_state = gemini_pool.acquire_key(estimated_tokens=400)
    traces.append({
        "step": "Gemini Pool Allocation",
        "agent": "OrchestratorAgent",
        "detail": f"Assigned Key: {gemini_key_state.key_id} (RPM: {gemini_key_state.rpm_used}/10)"
    })

    # Step 2: Spawn short-lived Agent JWT Identity
    instance_id = f"pay-{uuid.uuid4().hex[:4]}"
    agent_jwt = issue_agent_token(
        agent_id="agent_payment_processor",
        instance_id=instance_id,
        agent_type="payment-agent",
        capabilities=["TRANSFER_MONEY", "SCHEDULE_TRANSFER", "QUERY_BENEFICIARY"]
    )
    traces.append({
        "step": "Agent Identity Spawned",
        "agent": "Agent Identity Service",
        "detail": f"Generated signed JWT for Instance '{instance_id}' (TTL: 15 min)"
    })

    # Step 3: Governed Beneficiary Resolution via SINGLE GATEWAY POST /api/v1/agent/request
    resolve_res = await resolve_target_resource(prompt, agent_jwt, customer_id)
    res_status = resolve_res.get("status")

    # Case A: Name Confirmation Required (Names are non-unique identifiers)
    if res_status == "NAME_CONFIRMATION_REQUIRED":
        target_q = resolve_res.get("targetQuery", "target")
        candidates = resolve_res.get("candidates", [])
        
        cand_list_str = "\n".join([
            f"  {idx+1}. {c['name']} — Account: {c['accountNo']} ({c['email']})"
            for idx, c in enumerate(candidates)
        ])
        
        traces.append({
            "step": "Non-Unique Name Flagged",
            "agent": "ResourceResolverAgent",
            "detail": f"NAME MATCH: Found {len(candidates)} candidate(s) for '{target_q}'. Explicit Account No required for security."
        })

        if len(candidates) == 1:
            c = candidates[0]
            msg = (
                f"Found registered bank account matching '{target_q}':\n"
                f"  • {c['name']} — Account: {c['accountNo']} ({c['email']})\n\n"
                f"⚠️ Security Notice: Names are not unique identifiers. To ensure funds are sent to the correct recipient, "
                f"please confirm by specifying their 8-digit account number (e.g. 'Send ₹5,000 to account {c['accountNo']}')."
            )
        else:
            msg = (
                f"Found {len(candidates)} registered bank accounts matching '{target_q}':\n"
                f"{cand_list_str}\n\n"
                f"⚠️ Security Notice: Names are not unique identifiers. Please specify the exact 8-digit account number "
                f"or email address to complete your transfer."
            )

        return {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "userMessage": prompt,
            "assistantResponse": msg,
            "status": "CONFIRMATION_REQUIRED",
            "traces": traces
        }

    # Case B1: Governed Kill Switch or Policy Denied during Resolution
    if res_status == "DENIED":
        denied_err = resolve_res.get("error", "Governance Policy Denied")
        traces.append({
            "step": "Target Resolution Governed Block",
            "agent": "ResourceResolverAgent",
            "detail": f"DENIED: {denied_err}"
        })

        return {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "userMessage": prompt,
            "assistantResponse": f"🛑 Request Blocked by Governance: {denied_err}. Re-enable agent controls in the Admin Dashboard to allow requests.",
            "status": "DENIED",
            "traces": traces
        }

    # Case B2: Not Found
    if res_status == "NOT_FOUND":
        target_q = resolve_res.get("targetQuery", "target")
        traces.append({
            "step": "Target Resolution",
            "agent": "ResourceResolverAgent",
            "detail": f"NOT FOUND: No registered account matching '{target_q}'"
        })

        return {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "userMessage": prompt,
            "assistantResponse": (
                f"No registered bank account was found matching '{target_q}'. "
                f"Please verify the spelling or specify your recipient's 8-digit account number (e.g. 'Send ₹5,000 to account 10001003')."
            ),
            "status": "NOT_FOUND",
            "traces": traces
        }

    # Case C: Exact Single Match (User provided explicit 8-digit Account Number or Email)
    candidate = resolve_res.get("candidate", {})
    traces.append({
        "step": "Unique Identifier Verified",
        "agent": "ResourceResolverAgent",
        "detail": f"UNIQUE ID MATCH: Verified Account {candidate.get('accountNo')} ({candidate.get('name')})"
    })

    # Step 4: Construct Payment Payload
    entity_info = {
        "targetIdentifier": candidate.get("accountNo"),
        "counterparty": candidate.get("name")
    }
    operation_payload = prepare_payment_payload(prompt, entity_info)
    traces.append({
        "step": "Intent Payload Formatted",
        "agent": "PaymentAgent",
        "detail": f"Type: {operation_payload['type']} | Amount: ₹{operation_payload['amount']} | Target Account: {candidate.get('accountNo')}"
    })

    # Step 5: Transmit to SBF Gateway for OPA Governance Execution
    traces.append({
        "step": "Transmitting to SBF Gateway",
        "agent": "Agent Gateway Client",
        "detail": f"POST {SBF_URL}/api/v1/agent/request (Bearer Signed Agent JWT)"
    })

    sbf_endpoint = f"{SBF_URL.rstrip('/')}/api/v1/agent/request"
    headers = {"Authorization": f"Bearer {agent_jwt}"}
    req_body = {
        "customerId": customer_id,
        "operation": operation_payload,
        "traceId": trace_id
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            sbf_resp = await client.post(sbf_endpoint, json=req_body, headers=headers)
            sbf_data = sbf_resp.json()
    except Exception as e:
        logger.error(f"Failed to reach SBF Gateway: {e}")
        return {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "userMessage": prompt,
            "assistantResponse": f"Secure Banking Fabric Gateway is unreachable: {e}",
            "status": "ERROR",
            "traces": traces
        }

    status = sbf_data.get("status")
    code = sbf_data.get("code")

    if status == "DENIED":
        traces.append({
            "step": "Governance Decision",
            "agent": "SBF Governance Pipeline",
            "detail": f"REJECTED: {sbf_data.get('error')}"
        })
        return {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "userMessage": prompt,
            "assistantResponse": f"Governance Policy Denied: {sbf_data.get('error')}",
            "status": "DENIED",
            "code": code,
            "traces": traces
        }

    if status == "OTP_REQUIRED":
        demo_otp = sbf_data.get("demoOtpCode")
        recip_email = sbf_data.get("recipientEmail", "your email address")
        traces.append({
            "step": "Out-of-Band OTP Required",
            "agent": "SBF Risk Engine",
            "detail": f"Transfer ₹{operation_payload['amount']} requires OTP. Sent to {recip_email} (Code: {demo_otp})"
        })
        return {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "userMessage": prompt,
            "assistantResponse": (
                f"🔒 Out-of-Band OTP Verification Required for transfer of ₹{operation_payload['amount']:,.2f} "
                f"to {candidate.get('name')} (Account: {candidate.get('accountNo')}).\n\n"
                f"A 6-digit verification code has been dispatched to {recip_email}.\n"
                f"👉 **Demo OTP Code:** `{demo_otp}`\n\n"
                f"Please enter the code in the Active OTP Challenge box on the right to complete this transaction."
            ),
            "status": "OTP_REQUIRED",
            "challengeId": sbf_data.get("challengeId"),
            "demoOtpCode": demo_otp,
            "traces": traces
        }

    # APPROVED & EXECUTED
    exec_info = sbf_data.get("execution", {})
    traces.append({
        "step": "SBF Core Banking Execution",
        "agent": "SBF Core Banking Engine",
        "detail": f"COMPLETED: Tx ID {exec_info.get('transactionId', 'N/A')} | Remaining Balance: ₹{exec_info.get('remainingBalance', 'N/A')}"
    })

    return {
        "id": f"msg_{uuid.uuid4().hex[:8]}",
        "userMessage": prompt,
        "assistantResponse": (
            f"Transfer completed successfully! ₹{operation_payload['amount']:,.0f} sent to "
            f"{candidate.get('name')} (Account: {candidate.get('accountNo')}). "
            f"Transaction ID: {exec_info.get('transactionId', 'N/A')}. "
            f"Your remaining balance: ₹{exec_info.get('remainingBalance', 'N/A')}."
        ),
        "status": "APPROVED",
        "execution": exec_info,
        "traces": traces
    }
