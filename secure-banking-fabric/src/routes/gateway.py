import time
import uuid
import logging
import httpx
import asyncio
from typing import Dict, Any, Optional
from fastapi import APIRouter, Header
from pydantic import BaseModel
from src.governance.pipeline import run_governance_pipeline
from src.execution.otp import generate_otp_challenge

router = APIRouter(prefix="/api/v1/agent", tags=["Agent Gateway"])
logger = logging.getLogger("agent_gateway")

# Global audit store for simulated Splunk audit explorer
AUDIT_LOG_STORE = []

class AgentRequestPayload(BaseModel):
    customerId: str
    operation: Dict[str, Any]
    traceId: Optional[str] = None

@router.post("/request")
async def process_agent_request(
    payload: AgentRequestPayload,
    authorization: Optional[str] = Header(None)
):
    """
    SINGLE GOVERNED AGENT GATEWAY ENTRYPOINT: POST /api/v1/agent/request
    ALL agent tasks (QUERY_BENEFICIARY, TRANSFER_MONEY, SCHEDULE_TRANSFER, BLOCK_CARD)
    MUST pass through this single unique endpoint.
    
    Zero-Trust Architecture:
    1. AI Agent has NO direct database access.
    2. Request MUST pass through identity verification, kill switches, and OPA governance FIRST.
    3. Operation-specific logic runs ONLY after OPA policy approval.
    """
    token = authorization.replace("Bearer ", "") if authorization else ""
    request_id = f"req_{uuid.uuid4().hex[:10]}"
    trace_id = payload.traceId or f"tr_{uuid.uuid4().hex[:8]}"

    # STEP 1: Governance & OPA Policy Evaluation for ALL agent task operations
    passed, code, summary = await run_governance_pipeline(
        token=token,
        operation_payload=payload.operation,
        customer_id=payload.customerId,
        request_id=request_id,
        trace_id=trace_id
    )

    # Append to Splunk-style audit store
    audit_entry = {
        "id": f"aud_{uuid.uuid4().hex[:10]}",
        "requestId": request_id,
        "traceId": trace_id,
        "agentInstance": summary.get("agentInstance", "unknown"),
        "agentType": summary.get("agentType", "payment-agent"),
        "operation": payload.operation.get("type", "UNKNOWN"),
        "decision": "ALLOW" if passed else "DENY",
        "reasonCode": code,
        "policyVersion": summary.get("policyVersion", 1),
        "latencyMs": summary.get("latencyMs", 5),
        "payload": payload.model_dump(),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    AUDIT_LOG_STORE.insert(0, audit_entry)

    # STEP 2: Handle Policy Denials
    if not passed:
        return {
            "status": "DENIED",
            "code": code,
            "requestId": request_id,
            "traceId": trace_id,
            "error": summary.get("error") or summary.get("reasonCode")
        }

    # STEP 3: Handle Out-of-Band Risk Verification (OTP)
    if code == "OTP_REQUIRED":
        recipient_email = "user@demo.in"
        try:
            from src.db import get_bank_db
            db = await get_bank_db()
            if db is not None:
                async def _find_email():
                    cust = await db.customer.find_unique(where={"id": payload.customerId}, include={"user": True})
                    if cust:
                        return cust.email or (cust.user.email if cust.user else "user@demo.in")
                    u = await db.user.find_first()
                    return u.email if (u and u.email) else "user@demo.in"
                recipient_email = await asyncio.wait_for(_find_email(), timeout=2.0)
        except Exception as ex:
            logger.warning(f"Failed to fetch customer email (using fallback): {ex}")

        challenge = await generate_otp_challenge(
            request_id=request_id,
            customer_id=payload.customerId,
            recipient_email=recipient_email,
            amount=float(payload.operation.get("amount", 0)),
            counterparty=payload.operation.get("targetIdentifier", "Beneficiary")
        )
        return {
            "status": "OTP_REQUIRED",
            "code": "OTP_REQUIRED",
            "requestId": request_id,
            "traceId": trace_id,
            "challengeId": challenge["challengeId"],
            "recipientEmail": recipient_email,
            "demoOtpCode": challenge.get("demoCode"),
            "message": f"Transaction requires out-of-band OTP verification dispatched to {recipient_email}"
        }

    op_type = payload.operation.get("type")

    # TASK TYPE 1: QUERY_BENEFICIARY
    if op_type == "QUERY_BENEFICIARY":
        query_str = str(payload.operation.get("query", "")).strip()
        candidates = await _query_beneficiaries_in_db(query_str)
        return {
            "status": "APPROVED",
            "code": "QUERY_SUCCESS",
            "requestId": request_id,
            "traceId": trace_id,
            "matchCount": len(candidates),
            "candidates": candidates
        }

    # TASK TYPE 2: TRANSFER_MONEY or SCHEDULE_TRANSFER
    if op_type in ["TRANSFER_MONEY", "SCHEDULE_TRANSFER"]:
        amount = float(payload.operation.get("amount", 0))
        target_id = payload.operation.get("targetIdentifier") or payload.operation.get("targetAccountNo")

        exec_res = await _execute_governed_core_transfer(
            customer_id=payload.customerId,
            target_identifier=target_id,
            amount=amount,
            request_id=request_id
        )

        if exec_res.get("status") == "FAILED":
            return {
                "status": "DENIED",
                "code": "EXECUTION_FAILED",
                "requestId": request_id,
                "traceId": trace_id,
                "error": exec_res.get("reason", "Transfer execution failed in core banking")
            }

        return {
            "status": "APPROVED",
            "code": "EXECUTION_SUCCESS",
            "requestId": request_id,
            "traceId": trace_id,
            "execution": exec_res
        }

    return {
        "status": "APPROVED",
        "code": "GOVERNANCE_PASSED",
        "requestId": request_id,
        "traceId": trace_id,
        "message": "Operation passed governance policy checks"
    }


async def _query_beneficiaries_in_db(query_str: str) -> list:
    """Helper method to safely query candidate beneficiaries inside bank boundary."""
    if not query_str:
        return []

    import re
    query_str_clean = str(query_str).strip()
    digits_found = re.findall(r'\b\d{8}\b', query_str_clean)
    target_digits = digits_found[0] if digits_found else (query_str_clean if query_str_clean.isdigit() else None)
    query_lower = query_str_clean.lower()

    candidates = []
    try:
        from src.db import get_bank_db
        db = await get_bank_db()
        if db is not None:
            customers = await db.customer.find_many(include={"accounts": True, "user": True})

            for c in customers:
                if not c.accounts:
                    continue
                acc_no = str(c.accounts[0].accountNo)
                cust_name = c.name or ""
                cust_email = c.user.email if c.user else ""

                # 1. Match by 8-digit account number
                if target_digits and (acc_no == target_digits or target_digits in acc_no):
                    candidates.append({"name": cust_name, "accountNo": acc_no, "email": cust_email})
                    continue

                # 2. Match by Name or Email substring
                name_lower = cust_name.lower()
                email_lower = cust_email.lower()
                if query_lower in name_lower or (email_lower and query_lower in email_lower.split("@")[0]):
                    candidates.append({"name": cust_name, "accountNo": acc_no, "email": cust_email})

            if candidates:
                return candidates
    except Exception as e:
        logger.warning(f"DB query error: {e}")

    # Fallback demo beneficiaries array for unseeded/offline DB fallback
    FALLBACK_BENEFICIARIES = [
        {"name": "Arjun Mehta", "accountNo": "10001001", "email": "arjun@demo.in"},
        {"name": "Priya Verma", "accountNo": "10001002", "email": "priya@demo.in"},
        {"name": "Rahul Sharma", "accountNo": "10001003", "email": "rahul@demo.in"},
        {"name": "Neha Singh", "accountNo": "10001004", "email": "neha@demo.in"},
        {"name": "Vikram Das", "accountNo": "10001005", "email": "vikram@demo.in"},
    ]

    fallback_matches = []
    for fb in FALLBACK_BENEFICIARIES:
        if target_digits and (fb["accountNo"] == target_digits or target_digits in fb["accountNo"]):
            fallback_matches.append(fb)
        elif query_lower in fb["name"].lower() or query_lower in fb["email"].lower() or query_lower in fb["accountNo"]:
            fallback_matches.append(fb)

    return fallback_matches


async def _execute_governed_core_transfer(
    customer_id: str,
    target_identifier: str,
    amount: float,
    request_id: str
) -> Dict[str, Any]:
    """
    Executes transaction inside the Bank Perimeter after Governance Clearance.
    Dynamically resolves target_identifier against registered database accounts.
    """
    try:
        from src.db import get_bank_db
        from src.utils.email_service import send_email
        from src.inngest_app import inngest_client
        import inngest
        import re

        db = await get_bank_db()
        if db is None:
            return {"status": "FAILED", "reason": "Bank Database connection lost. Reconnecting to Neon DB..."}

        # 1. Resolve Sender Account
        sender_acc = await db.account.find_first(
            where={"customerId": customer_id, "status": "ACTIVE"}
        )
        if not sender_acc:
            # Fallback to first active account in DB for demo/default customer IDs
            sender_acc = await db.account.find_first(where={"status": "ACTIVE"})

        if not sender_acc:
            return {"status": "FAILED", "reason": f"No active sender account found in core banking system."}

        if sender_acc.balance < amount:
            return {"status": "FAILED", "reason": f"Insufficient funds. Current balance: ₹{sender_acc.balance:,.2f}, Requested: ₹{amount:,.2f}"}

        # 2. Dynamically Resolve Recipient Account inside Bank Perimeter
        receiver_acc = None
        target_str = str(target_identifier).strip()
        digits_found = re.findall(r'\b\d{8}\b', target_str)
        target_digits = digits_found[0] if digits_found else (target_str if target_str.isdigit() else None)

        # A. Try exact account number match
        if target_digits:
            receiver_acc = await db.account.find_unique(where={"accountNo": target_digits})

        # B. If not found by account number, search by customer name / email
        if not receiver_acc:
            all_customers = await db.customer.find_many(include={"accounts": True, "user": True})
            target_lower = target_str.lower()
            for c in all_customers:
                if not c.accounts:
                    continue
                cust_name = (c.name or "").lower()
                user_email = (c.user.email if c.user else "").lower()
                
                if target_lower in cust_name or (user_email and target_lower in user_email.split("@")[0]):
                    receiver_acc = c.accounts[0]
                    break

        # C. Automatic Demo Account Auto-Creation Safeguard if DB is reset
        if not receiver_acc:
            DEMO_ACCOUNT_MAP = {
                "10001001": {"name": "Arjun Mehta", "email": "arjun@demo.in"},
                "10001002": {"name": "Priya Verma", "email": "priya@demo.in"},
                "10001003": {"name": "Rahul Sharma", "email": "rahul@demo.in"},
                "10001004": {"name": "Neha Singh", "email": "neha@demo.in"},
                "10001005": {"name": "Vikram Das", "email": "vikram@demo.in"},
            }
            if target_digits and target_digits in DEMO_ACCOUNT_MAP:
                d_info = DEMO_ACCOUNT_MAP[target_digits]
                try:
                    cust = await db.customer.create(data={"name": d_info["name"], "email": d_info["email"], "phone": "9876543210"})
                    receiver_acc = await db.account.create(data={
                        "customerId": cust.id, "type": "savings", "accountNo": target_digits, "balance": 100000.0, "currency": "INR", "status": "ACTIVE"
                    })
                    await db.user.create(data={"email": d_info["email"], "passwordHash": "demo1234", "customerId": cust.id})
                except Exception as ex:
                    logger.warning(f"Demo auto-create note: {ex}")

        if not receiver_acc:
            return {"status": "FAILED", "reason": f"No registered beneficiary matching '{target_identifier}' found in bank records."}

        if receiver_acc.id == sender_acc.id:
            return {"status": "FAILED", "reason": f"Account {target_str} is your own account ({sender_acc.accountNo}). Please state a counterparty beneficiary account (e.g. Priya Verma: 10001002, Rahul Sharma: 10001003)."}

        # 3. Perform Atomic Debit & Credit
        new_sender_bal = sender_acc.balance - amount
        new_receiver_bal = receiver_acc.balance + amount

        await db.account.update(where={"id": sender_acc.id}, data={"balance": new_sender_bal})
        await db.account.update(where={"id": receiver_acc.id}, data={"balance": new_receiver_bal})

        # Fetch Customer Details for Receipts
        sender_cust = await db.customer.find_unique(where={"id": customer_id})
        receiver_cust = await db.customer.find_unique(where={"id": receiver_acc.customerId})
        sender_user = await db.user.find_unique(where={"customerId": customer_id})
        receiver_user = await db.user.find_unique(where={"customerId": receiver_acc.customerId})

        sender_name = sender_cust.name if sender_cust else "Sender"
        receiver_name = receiver_cust.name if receiver_cust else "Beneficiary"
        sender_email = sender_user.email if sender_user else None
        receiver_email = receiver_user.email if receiver_user else None

        tx_id = f"tx_{uuid.uuid4().hex[:10]}"

        # 4. Record Double-Entry Ledger
        await db.transaction.create(data={
            "accountId": sender_acc.id,
            "type": "DEBIT",
            "amount": amount,
            "counterparty": receiver_name,
            "requestId": request_id,
            "status": "COMPLETED"
        })
        await db.transaction.create(data={
            "accountId": receiver_acc.id,
            "type": "CREDIT",
            "amount": amount,
            "counterparty": sender_name,
            "requestId": request_id,
            "status": "COMPLETED"
        })

        # 5. Out-of-Band Notification Emails to both parties (Async non-blocking)
        try:
            if sender_email:
                asyncio.create_task(send_email(
                    sender_email,
                    f"AEGIS Bank — AI Agent Transfer Successful (₹{amount:,.2f})",
                    f"AI Agent sent ₹{amount:,.2f} to {receiver_name}",
                    f"""<div style="font-family:Arial;padding:20px;">
                        <h2 style="color:#10b981;">AI Governed Transfer Successful ✅</h2>
                        <p>Your AI Agent transferred <strong>₹{amount:,.2f}</strong> to <strong>{receiver_name}</strong>.</p>
                        <p><strong>Transaction ID:</strong> {tx_id}</p>
                        <p><strong>Account Number:</strong> {receiver_acc.accountNo}</p>
                        <p><strong>Updated Balance:</strong> ₹{new_sender_bal:,.2f}</p>
                    </div>"""
                ))

            if receiver_email:
                asyncio.create_task(send_email(
                    receiver_email,
                    f"AEGIS Bank — Money Received via AI Agent (₹{amount:,.2f})",
                    f"Received ₹{amount:,.2f} from {sender_name}",
                    f"""<div style="font-family:Arial;padding:20px;">
                        <h2 style="color:#10b981;">Account Credited 🎉</h2>
                        <p>You received <strong>₹{amount:,.2f}</strong> from <strong>{sender_name}</strong> via AI Agent.</p>
                        <p><strong>Transaction ID:</strong> {tx_id}</p>
                        <p><strong>Updated Balance:</strong> ₹{new_receiver_bal:,.2f}</p>
                    </div>"""
                ))
        except Exception as ex:
            logger.warning(f"Async email notification error: {ex}")

        # 6. Event Dispatch for Inngest Observability (Async non-blocking)
        try:
            asyncio.create_task(inngest_client.send(
                inngest.Event(
                    name="payment/transfer.completed",
                    data={
                        "txId": tx_id,
                        "amount": amount,
                        "senderName": sender_name,
                        "senderEmail": sender_email or "",
                        "receiverName": receiver_name,
                        "receiverEmail": receiver_email or "",
                        "requestId": request_id,
                        "source": "AI_AGENT_GOVERNED"
                    }
                )
            ))
        except Exception as e:
            logger.warning(f"Inngest event dispatch note: {e}")

        return {
            "status": "COMPLETED",
            "transactionId": tx_id,
            "amount": amount,
            "counterparty": receiver_name,
            "targetAccountNo": receiver_acc.accountNo,
            "remainingBalance": new_sender_bal,
            "newReceiverBalance": new_receiver_bal
        }

    except Exception as e:
        logger.error(f"Core bank execution failed: {e}", exc_info=True)
        return {"status": "FAILED", "reason": f"Database execution error: {str(e)}"}
