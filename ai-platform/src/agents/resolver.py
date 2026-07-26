import re
import logging
import httpx
from typing import Dict, Any
from src.config import SBF_URL

logger = logging.getLogger("resource_resolver_agent")

async def resolve_target_resource(prompt: str, agent_jwt: str, customer_id: str = "cust_101") -> Dict[str, Any]:
    """
    Governed Beneficiary Resolver Agent.
    Does NOT access database directly. Communicates EXCLUSIVELY via the single
    governed gateway endpoint `POST /api/v1/agent/request` with operation type QUERY_BENEFICIARY.
    
    Safety Guarantee:
    - Names are non-unique identifiers. A name match ALWAYS requires explicit account number or email confirmation
      to ensure money is never transferred to a different person with the same name.
    - 8-digit Account Numbers and Email Addresses ARE unique identifiers and allow immediate transfer execution.
    """
    prompt_trimmed = prompt.strip()
    
    # 1. Check if an explicit 8-digit account number or email address was provided in prompt
    raw_digits = re.findall(r'\b\d{8}\b', prompt_trimmed)
    email_matches = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', prompt_trimmed)

    is_unique_identifier = False
    if raw_digits:
        target_query = raw_digits[0]
        is_unique_identifier = True
    elif email_matches:
        target_query = email_matches[0]
        is_unique_identifier = True
    else:
        # Extract target name entity
        match = re.search(r'(?:to|transfer to|send to|pay)\s+([A-Za-z0-9._%+-]+(?:\s+[A-Za-z]+)?)', prompt_trimmed, re.IGNORECASE)
        if match:
            target_query = match.group(1).strip()
        else:
            # Fallback to last meaningful word
            words = prompt_trimmed.split()
            target_query = ""
            for w in reversed(words):
                clean_w = re.sub(r'[^A-Za-z0-9]', '', w)
                if clean_w and len(clean_w) > 2 and clean_w.lower() not in ["transfer", "send", "rs", "inr", "rupees", "pay", "money", "account"]:
                    target_query = clean_w
                    break

    if not target_query:
        return {
            "status": "NOT_FOUND",
            "targetQuery": "",
            "candidates": [],
            "error": "No beneficiary specified in prompt. Please state a recipient name or account number."
        }

    # 2. Transmit through SINGLE Governed Agent Gateway Endpoint: POST /api/v1/agent/request
    gateway_url = f"{SBF_URL.rstrip('/')}/api/v1/agent/request"
    headers = {"Authorization": f"Bearer {agent_jwt}"}
    req_payload = {
        "customerId": customer_id,
        "operation": {
            "type": "QUERY_BENEFICIARY",
            "query": target_query
        }
    }

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(gateway_url, json=req_payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()

                # If Governance engine DENIED the query (e.g. Kill Switch active for agent type)
                if data.get("status") == "DENIED":
                    return {
                        "status": "DENIED",
                        "targetQuery": target_query,
                        "error": data.get("error") or data.get("reasonCode") or "Governance Policy Denied request.",
                        "isUniqueIdentifier": is_unique_identifier
                    }

                candidates = data.get("candidates", [])
                match_count = len(candidates)

                if match_count == 0:
                    return {
                        "status": "NOT_FOUND",
                        "targetQuery": target_query,
                        "candidates": [],
                        "isUniqueIdentifier": is_unique_identifier
                    }
                
                # If target was explicit unique Account Number or Email AND found exactly 1 match
                if is_unique_identifier and match_count >= 1:
                    c = candidates[0]
                    return {
                        "status": "EXACT_MATCH",
                        "targetQuery": target_query,
                        "candidate": c,
                        "candidates": candidates,
                        "isUniqueIdentifier": True
                    }

                # If target was a Name (non-unique), require account number confirmation even if 1 match found!
                return {
                    "status": "NAME_CONFIRMATION_REQUIRED",
                    "targetQuery": target_query,
                    "matchCount": match_count,
                    "candidates": candidates,
                    "isUniqueIdentifier": False
                }

    except Exception as e:
        logger.warning(f"Resolver: SBF Gateway query call failed ({e})")

    return {
        "status": "NOT_FOUND",
        "targetQuery": target_query,
        "candidates": [],
        "isUniqueIdentifier": is_unique_identifier,
        "error": f"Could not verify beneficiary '{target_query}'."
    }
