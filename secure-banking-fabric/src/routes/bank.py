import uuid
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from src.db import get_bank_db
from src.gateway.auth import get_current_user
from src.execution.otp import generate_otp_challenge, verify_otp_code
from src.utils.email_service import send_email
from src.inngest_app import inngest_client
import inngest

router = APIRouter(prefix="/api/v1/bank", tags=["Banking Core"])

# ──────────────────────────────────────────────────────────────────────────────
# DEMO ACCOUNT ALLOWLIST — Only these users appear in public-facing endpoints.
# Real user registrations are isolated from the demo directory.
# ──────────────────────────────────────────────────────────────────────────────
DEMO_ACCOUNT_EMAILS = {
    "arjun@demo.in",
    "priya@demo.in",
    "rohit@demo.in",
    "sneha@demo.in",
    "vikram@demo.in",
    "admin118@amx.in",
}

class ResolveTargetPayload(BaseModel):
    prompt: str

@router.post("/resolve-target")
async def resolve_target_dynamic(payload: ResolveTargetPayload):
    """
    Dynamically resolves beneficiary from live Neon PostgreSQL DB.
    Matches names, emails, and account numbers for ANY registered user/friend.
    """
    db = await get_bank_db()
    prompt = payload.prompt.strip()
    prompt_lower = prompt.lower()

    # Fetch all registered customers + accounts from PostgreSQL
    customers = await db.customer.find_many(
        include={
            "accounts": True,
            "user": True
        }
    )

    import re
    # 1. Look for explicit digits in prompt (8-digit account numbers or 6+ digit numbers)
    raw_digits = re.findall(r'\b\d{6,}\b', prompt)

    for c in customers:
        if not c.accounts:
            continue
        acc = c.accounts[0]
        acc_no = acc.accountNo
        cust_name = c.name or ""
        cust_email = c.user.email if c.user else ""

        # Check account number match
        for digit_str in raw_digits:
            if digit_str == acc_no or digit_str in acc_no:
                return {
                    "resolved": True,
                    "resolutionMethod": "DB_ACCOUNT_NUMBER_MATCH",
                    "name": cust_name,
                    "accountNo": acc_no,
                    "email": cust_email,
                    "customerId": c.id
                }

        # Check name or email match
        name_parts = [p.lower() for p in cust_name.split() if len(p) > 1]
        for part in name_parts:
            if part in prompt_lower:
                return {
                    "resolved": True,
                    "resolutionMethod": "DB_NAME_MATCH",
                    "name": cust_name,
                    "accountNo": acc_no,
                    "email": cust_email,
                    "customerId": c.id
                }

        if cust_email and cust_email.split("@")[0].lower() in prompt_lower:
            return {
                "resolved": True,
                "resolutionMethod": "DB_EMAIL_MATCH",
                "name": cust_name,
                "accountNo": acc_no,
                "email": cust_email,
                "customerId": c.id
            }

    return {
        "resolved": False,
        "resolutionMethod": "NONE",
        "name": "Unknown Beneficiary",
        "accountNo": None,
        "error": "No registered account found matching prompt. Please specify recipient name or account number."
    }

class TransferInitiatePayload(BaseModel):
    recipientAccountNo: str
    amount: float
    note: Optional[str] = None

class TransferConfirmPayload(BaseModel):
    challengeId: str
    otpCode: str

@router.get("/demo-accounts")
async def get_demo_accounts():
    """Unauthenticated endpoint returning DEMO user credentials for testing & evaluation.
    Only returns accounts in the known demo allowlist — never real user registrations."""
    db = await get_bank_db()
    users = await db.user.find_many(
        include={
            "customer": {
                "include": {
                    "accounts": True
                }
            }
        }
    )

    demo_list = []
    for u in users:
        # SECURITY: Only expose accounts in the hardcoded demo allowlist
        if u.email.lower() not in DEMO_ACCOUNT_EMAILS:
            continue
        # Skip the admin account from demo listing
        if u.email.lower() == "admin118@amx.in":
            continue
        cust = u.customer
        acc = cust.accounts[0] if cust and cust.accounts else None
        demo_list.append({
            "name": cust.name if cust else "User",
            "email": u.email,
            "password": "demo1234",
            "accountNo": acc.accountNo if acc else "N/A",
            "balance": acc.balance if acc else 0.0,
            "phone": cust.phone if cust else ""
        })

    return {
        "status": "SUCCESS",
        "notice": "FOR TESTING & EVALUATION PURPOSES ONLY",
        "defaultPassword": "demo1234",
        "demoAccounts": demo_list
    }

@router.get("/users")
async def list_public_users(current_user: dict = Depends(get_current_user)):
    """Lists demo bank users for the public network directory.
    Only returns accounts in the demo allowlist — real registrations are excluded.
    Balances are masked for privacy except for the currently logged-in user."""
    db = await get_bank_db()
    users = await db.user.find_many(
        include={
            "customer": {
                "include": {
                    "accounts": True
                }
            }
        }
    )

    result = []
    for u in users:
        # SECURITY: Only expose demo accounts in the public directory
        if u.email.lower() not in DEMO_ACCOUNT_EMAILS:
            continue
        if u.email.lower() == "admin118@amx.in":
            continue
        cust = u.customer
        acc = cust.accounts[0] if cust and cust.accounts else None
        is_self = u.id == current_user["userId"]
        result.append({
            "userId": u.id,
            "name": cust.name if cust else "User",
            "email": u.email,
            "phone": cust.phone if cust else "",
            "accountNo": acc.accountNo if acc else "N/A",
            # Only reveal balance for the currently authenticated user
            "balance": acc.balance if (acc and is_self) else None,
            "isCurrentUser": is_self
        })

    return {"status": "SUCCESS", "users": result}

@router.get("/transactions")
async def get_my_transactions(current_user: dict = Depends(get_current_user)):
    """Fetches full transaction ledger for current user."""
    db = await get_bank_db()
    cust_id = current_user["customerId"]
    accounts = await db.account.find_many(where={"customerId": cust_id})
    account_ids = [a.id for a in accounts]

    transactions = await db.transaction.find_many(
        where={"accountId": {"in": account_ids}},
        order={"createdAt": "desc"}
    )

    return {
        "status": "SUCCESS",
        "transactions": [
            {
                "id": t.id,
                "type": t.type,
                "amount": t.amount,
                "counterparty": t.counterparty,
                "requestId": t.requestId,
                "status": t.status,
                "createdAt": t.createdAt.isoformat()
            } for t in transactions
        ]
    }

@router.post("/transfer/initiate")
async def initiate_transfer(
    payload: TransferInitiatePayload,
    current_user: dict = Depends(get_current_user)
):
    """
    Step 1 of Direct API Money Transfer:
    Validates sender funds, verifies target account exists, generates & emails real OTP code to sender.
    """
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Transfer amount must be greater than 0")

    db = await get_bank_db()
    sender_cust = await db.customer.find_unique(where={"id": current_user["customerId"]})
    sender_acc = await db.account.find_first(where={"customerId": current_user["customerId"], "status": "ACTIVE"})

    if not sender_acc or sender_acc.balance < payload.amount:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Current balance: INR {sender_acc.balance if sender_acc else 0}")

    receiver_acc = await db.account.find_unique(where={"accountNo": payload.recipientAccountNo.strip()})
    if not receiver_acc:
        raise HTTPException(status_code=404, detail=f"Target account number '{payload.recipientAccountNo}' not found")

    if receiver_acc.id == sender_acc.id:
        raise HTTPException(status_code=400, detail="Cannot transfer money to your own account")

    receiver_cust = await db.customer.find_unique(where={"id": receiver_acc.customerId})
    counterparty_name = receiver_cust.name if receiver_cust else f"Account {receiver_acc.accountNo}"

    request_id = f"req_{uuid.uuid4().hex[:10]}"

    # Generate OTP and email it to sender
    challenge = await generate_otp_challenge(
        request_id=request_id,
        customer_id=current_user["customerId"],
        recipient_email=current_user["email"],
        amount=payload.amount,
        counterparty=counterparty_name
    )

    # Store transfer context temporarily in Redis or challenge metadata
    # (We save recipientAccountNo, amount, senderAccountId, receiverAccountId for completion)
    return {
        "status": "OTP_REQUIRED",
        "message": f"OTP has been dispatched to {current_user['email']}",
        "challengeId": challenge["challengeId"],
        "transferDetails": {
            "amount": payload.amount,
            "recipientName": counterparty_name,
            "recipientAccountNo": receiver_acc.accountNo,
            "senderEmail": current_user["email"]
        }
    }

@router.post("/transfer/confirm")
async def confirm_transfer(
    payload: TransferConfirmPayload,
    current_user: dict = Depends(get_current_user)
):
    """
    Step 2 of Direct API Money Transfer:
    Verifies OTP, executes debit & credit in Neon PostgreSQL DB, sends emails to both parties, and triggers Inngest event.
    """
    success, code, data = await verify_otp_code(payload.challengeId, payload.otpCode)
    if not success:
        raise HTTPException(status_code=400, detail=f"OTP Verification Failed: {code}")

    # Challenge verified! Perform database transaction
    db = await get_bank_db()
    sender_cust = await db.customer.find_unique(where={"id": current_user["customerId"]})
    sender_acc = await db.account.find_first(where={"customerId": current_user["customerId"], "status": "ACTIVE"})
    
    amount = data.get("amount", 0.0)
    counterparty_name = data.get("counterparty", "Beneficiary")
    request_id = data.get("requestId", f"req_{uuid.uuid4().hex[:8]}")

    if not sender_acc or sender_acc.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient funds at execution time")

    # Find receiver account from counterparty or last transaction attempt
    receiver_cust = await db.customer.find_first(where={"name": counterparty_name})
    if receiver_cust:
        receiver_acc = await db.account.find_first(where={"customerId": receiver_cust.id})
    else:
        receiver_acc = await db.account.find_first(where={"customerId": {"not": current_user["customerId"]}})

    receiver_user = await db.user.find_unique(where={"customerId": receiver_acc.customerId}) if receiver_acc else None
    receiver_email = receiver_user.email if receiver_user else "receiver@demo.in"

    # Deduct sender, credit receiver
    new_sender_bal = sender_acc.balance - amount
    new_receiver_bal = receiver_acc.balance + amount if receiver_acc else 0.0

    await db.account.update(
        where={"id": sender_acc.id},
        data={"balance": new_sender_bal}
    )

    if receiver_acc:
        await db.account.update(
            where={"id": receiver_acc.id},
            data={"balance": new_receiver_bal}
        )

    # Record Transactions
    tx_id = f"tx_{uuid.uuid4().hex[:10]}"
    tx_debit = await db.transaction.create(
        data={
            "accountId": sender_acc.id,
            "type": "DEBIT",
            "amount": amount,
            "counterparty": counterparty_name,
            "requestId": request_id,
            "status": "COMPLETED"
        }
    )

    if receiver_acc:
        await db.transaction.create(
            data={
                "accountId": receiver_acc.id,
                "type": "CREDIT",
                "amount": amount,
                "counterparty": sender_cust.name if sender_cust else "Sender",
                "requestId": request_id,
                "status": "COMPLETED"
            }
        )

    # Send Notification Emails to BOTH Parties
    sender_subject = f"AEGIS Bank — Transfer Successful (INR {amount:,.2f} sent)"
    sender_html = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #0a0f1e;">
        <h2 style="color: #10b981;">Transfer Successful ✅</h2>
        <p>Dear {sender_cust.name if sender_cust else 'Customer'},</p>
        <p>You have successfully transferred <strong>INR {amount:,.2f}</strong> to <strong>{counterparty_name}</strong>.</p>
        <p><strong>Transaction ID:</strong> {tx_id}</p>
        <p><strong>Updated Balance:</strong> INR {new_sender_bal:,.2f}</p>
    </div>
    """
    await send_email(current_user["email"], sender_subject, f"Transferred INR {amount} to {counterparty_name}", sender_html)

    if receiver_email:
        receiver_subject = f"AEGIS Bank — Money Received (INR {amount:,.2f} credited)"
        receiver_html = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #0a0f1e;">
            <h2 style="color: #10b981;">Account Credited 🎉</h2>
            <p>You have received <strong>INR {amount:,.2f}</strong> from <strong>{sender_cust.name if sender_cust else 'AEGIS User'}</strong>.</p>
            <p><strong>Transaction ID:</strong> {tx_id}</p>
            <p><strong>Updated Balance:</strong> INR {new_receiver_bal:,.2f}</p>
        </div>
        """
        await send_email(receiver_email, receiver_subject, f"Received INR {amount} from {sender_cust.name if sender_cust else 'AEGIS User'}", receiver_html)

    # Fire Inngest Event so background job workflow steps run & appear in Inngest dev window
    try:
        await inngest_client.send(
            inngest.Event(
                name="payment/transfer.completed",
                data={
                    "txId": tx_id,
                    "amount": amount,
                    "senderName": sender_cust.name if sender_cust else "Sender",
                    "senderEmail": current_user["email"],
                    "receiverName": counterparty_name,
                    "receiverEmail": receiver_email,
                    "requestId": request_id
                }
            )
        )
    except Exception as e:
        print(f"Inngest event dispatch note: {e}")

    return {
        "status": "SUCCESS",
        "message": f"Successfully transferred INR {amount:,.2f} to {counterparty_name}",
        "transactionId": tx_id,
        "newBalance": new_sender_bal
    }
