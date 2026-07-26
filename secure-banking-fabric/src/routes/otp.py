from fastapi import APIRouter
from pydantic import BaseModel
from src.execution.otp import verify_otp_code

router = APIRouter(prefix="/api/v1/otp", tags=["Out-Of-Band OTP"])

class OtpVerifyPayload(BaseModel):
    challengeId: str
    otpCode: str

@router.post("/verify")
async def verify_otp(payload: OtpVerifyPayload):
    """
    Direct user OTP verification endpoint.
    Called directly by the Browser -> SBF. The AI Platform NEVER sees the OTP digits.
    Executes transaction upon successful OTP verification.
    """
    success, code, data = await verify_otp_code(payload.challengeId, payload.otpCode)
    if success:
        exec_res = None
        # Perform core transfer execution upon successful OTP verification
        try:
            from src.routes.gateway import _execute_governed_core_transfer
            exec_res = await _execute_governed_core_transfer(
                customer_id=data.get("customerId", "cust_101"),
                target_identifier=data.get("counterparty", "Beneficiary"),
                amount=float(data.get("amount", 0.0)),
                request_id=data.get("requestId", "req_otp")
            )
        except Exception as e:
            exec_res = {"status": "FAILED", "reason": str(e)}

        if exec_res and exec_res.get("status") == "FAILED":
            return {
                "status": "FAILED",
                "code": "TRANSFER_FAILED",
                "detail": exec_res.get("reason", "Fund transfer execution failed in core bank"),
                "data": data,
                "execution": exec_res
            }

        return {
            "status": "VERIFIED",
            "code": code,
            "data": data,
            "execution": exec_res,
            "message": f"✅ OTP Verified successfully! Transfer of ₹{data.get('amount', 0):,.2f} completed."
        }
        
    return {
        "status": "FAILED",
        "code": code,
        "detail": data.get("error") if isinstance(data, dict) else "Invalid OTP code provided",
        "data": data
    }
