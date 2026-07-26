import time
import uuid
import random
import hashlib
import redis.asyncio as redis
from typing import Dict, Any, Tuple, Optional
from src.config import REDIS_URL
from src.utils.email_service import send_email

MOCK_OTP_CHALLENGES: Dict[str, Dict[str, Any]] = {}

async def generate_otp_challenge(
    request_id: str,
    customer_id: str,
    recipient_email: Optional[str] = None,
    amount: float = 0.0,
    counterparty: str = "Beneficiary"
) -> Dict[str, Any]:
    """Generates a real 6-digit OTP challenge, stores it, and emails the code to the user."""
    challenge_id = f"otp_chal_{uuid.uuid4().hex[:8]}"
    plaintext_otp = str(random.randint(100000, 999999))
    otp_hash = hashlib.sha256(plaintext_otp.encode()).hexdigest()
    
    challenge = {
        "challengeId": challenge_id,
        "requestId": request_id,
        "customerId": customer_id,
        "otpHash": otp_hash,
        "demoCode": plaintext_otp,
        "recipientEmail": recipient_email,
        "amount": amount,
        "counterparty": counterparty,
        "status": "PENDING",
        "attempts": 0,
        "createdAt": time.time(),
        "expiresAt": time.time() + 300 # 5 minutes
    }
    MOCK_OTP_CHALLENGES[challenge_id] = challenge

    # Send email asynchronously if recipient provided
    if recipient_email:
        subject = f"AEGIS Bank — OTP Verification ({plaintext_otp})"
        text_content = f"Your AEGIS Bank OTP code is {plaintext_otp} for your transfer of INR {amount:,.2f} to {counterparty}. Valid for 5 minutes."
        html_content = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #0a0f1e; background-color: #f8fafc; border-radius: 12px;">
            <h2 style="color: #0f172a;">AEGIS Banking — Verification Required</h2>
            <p>You have initiated a money transfer of <strong>INR {amount:,.2f}</strong> to <strong>{counterparty}</strong>.</p>
            <div style="background-color: #0a0f1e; color: #c9a84c; font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 8px; padding: 16px; text-align: center; border-radius: 8px; margin: 20px 0;">
                {plaintext_otp}
            </div>
            <p style="color: #64748b; font-size: 13px;">This code is valid for 5 minutes. If you did not initiate this transaction, please contact security immediately.</p>
        </div>
        """
        import asyncio
        try:
            asyncio.create_task(send_email(
                recipient=recipient_email,
                subject=subject,
                text_content=text_content,
                html_content=html_content
            ))
        except Exception as ex:
            pass

    return challenge

async def verify_otp_code(challenge_id: str, otp_code: str) -> Tuple[bool, str, Dict[str, Any]]:
    """Verifies a user-provided OTP code against active challenge."""
    challenge = MOCK_OTP_CHALLENGES.get(challenge_id)
    if not challenge:
        return False, "CHALLENGE_NOT_FOUND", {}

    if challenge["status"] != "PENDING":
        return False, f"CHALLENGE_{challenge['status']}", {}

    if time.time() > challenge["expiresAt"]:
        challenge["status"] = "EXPIRED"
        return False, "OTP_EXPIRED", {}

    input_hash = hashlib.sha256(otp_code.strip().encode()).hexdigest()
    if input_hash == challenge["otpHash"]:
        challenge["status"] = "VERIFIED"
        
        # Publish event to Redis so Inngest / AI Platform step unblocks
        try:
            r = redis.from_url(REDIS_URL, decode_responses=True)
            await r.publish("otp:verified", challenge["requestId"])
            await r.set(f"otp:status:{challenge['requestId']}", "VERIFIED", ex=300)
        except Exception:
            pass

        return True, "VERIFIED", {
            "challengeId": challenge_id,
            "requestId": challenge["requestId"],
            "customerId": challenge["customerId"],
            "amount": challenge.get("amount", 0.0),
            "counterparty": challenge.get("counterparty", ""),
            "status": "VERIFIED"
        }
    else:
        challenge["attempts"] += 1
        if challenge["attempts"] >= 3:
            challenge["status"] = "FAILED"
        return False, "INVALID_OTP", {"attemptsRemaining": 3 - challenge["attempts"]}
