import uuid
import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from src.agents.orchestrator import run_agent_orchestration_chain
from src.gemini_pool import gemini_pool
from src.inngest_app import inngest_client
import inngest

router = APIRouter(prefix="/api/chat", tags=["AI Platform Chat"])

class ChatMessagePayload(BaseModel):
    userId: Optional[str] = "usr_demo101"
    customerId: Optional[str] = "cust_101"
    conversationId: Optional[str] = None
    message: str

@router.post("/message")
async def send_chat_message(payload: ChatMessagePayload):
    """
    Receives chat message from browser UI.
    Orchestrates agent execution chain, calls SBF Gateway, and returns result + live trace strip info.
    Also fires an `agent/run.requested` Inngest event for observability in the Dev UI.
    """
    conv_id = payload.conversationId or f"conv_{uuid.uuid4().hex[:8]}"
    run_id = f"run_{uuid.uuid4().hex[:10]}"

    try:
        result = await run_agent_orchestration_chain(
            prompt=payload.message,
            user_id=payload.userId or "usr_demo101",
            customer_id=payload.customerId or "cust_101"
        )
    except RuntimeError as e:
        result = {
            "status": "ERROR",
            "message": str(e),
            "traces": []
        }

    # Fire-and-forget: dispatch Inngest event for agent run observability
    # This makes the run visible in the Inngest Dev UI without blocking the response
    async def _dispatch_inngest_event():
        try:
            await inngest_client.send(inngest.Event(
                name="agent/run.requested",
                data={
                    "runId": run_id,
                    "prompt": payload.message,
                    "userId": payload.userId or "usr_demo101",
                    "customerId": payload.customerId or "cust_101",
                    "conversationId": conv_id,
                    "status": result.get("status", "APPROVED"),
                    "traceCount": len(result.get("traces", [])),
                    "source": "CHAT_API"
                }
            ))
        except Exception as e:
            pass  # Never let observability failures affect the user response

    asyncio.create_task(_dispatch_inngest_event())

    # orchestrator now returns assistantResponse directly; fall back to message for legacy
    assistant_response = result.get("assistantResponse") or result.get("message", "Request processed.")

    return {
        "id": result.get("id") or f"msg_{uuid.uuid4().hex[:8]}",
        "conversationId": conv_id,
        "userMessage": payload.message,
        "assistantResponse": assistant_response,
        "status": result.get("status", "APPROVED"),
        "challengeId": result.get("challengeId"),
        "execution": result.get("execution"),
        "traces": result.get("traces", [])
    }

@router.get("/gemini-status")
async def get_gemini_pool_status():
    return {
        "pool": gemini_pool.get_pool_status()
    }
