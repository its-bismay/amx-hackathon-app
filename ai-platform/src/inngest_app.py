import os
import inngest
import inngest.fast_api
from src.config import load_dotenv
import time

load_dotenv()
is_dev = os.getenv("INNGEST_DEV", "0") == "1"

inngest_client = inngest.Inngest(
    app_id="agent-orchestration",
    is_production=not is_dev
)

@inngest_client.create_function(
    fn_id="run-agent-chain",
    trigger=inngest.TriggerEvent(event="agent/run.requested"),
)
async def handle_agent_chain_run(ctx: inngest.Context) -> dict:
    """
    Durable observability handler for agent orchestration runs.
    Visible in Inngest Dev UI — records each agent run as structured durable steps.
    The actual orchestration already ran synchronously in the chat API; this logs it.
    """
    step = ctx.step
    data = ctx.event.data or {}

    prompt = data.get("prompt", "")
    user_id = data.get("userId", "usr_demo")
    customer_id = data.get("customerId", "cust_101")
    status = data.get("status", "APPROVED")
    trace_count = data.get("traceCount", 0)
    run_id = data.get("runId", ctx.run_id)
    conv_id = data.get("conversationId", "")

    # Step 1: Log agent run initiation
    async def _log_run_start():
        return {
            "runId": run_id,
            "prompt": prompt[:120] + ("..." if len(prompt) > 120 else ""),
            "customerId": customer_id,
            "userId": user_id,
            "initiatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": data.get("source", "CHAT_API")
        }

    run_meta = await step.run("log-agent-run-initiation", _log_run_start)

    # Step 2: Log governance & execution outcome
    async def _log_governance_outcome():
        return {
            "runId": run_id,
            "governanceStatus": status,
            "traceStepsExecuted": trace_count,
            "conversationId": conv_id,
            "completedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "policyEngine": "OPA/Rego via SBF Gateway",
            "orchestrator": "Gemini Min-Heap Pool + Zero-Trust SBF"
        }

    outcome = await step.run("log-governance-outcome", _log_governance_outcome)

    # Step 3: Write to compliance audit trail
    async def _write_audit_entry():
        return {
            "auditCode": f"AGENT_RUN_{status}",
            "runId": run_id,
            "customerId": customer_id,
            "prompt_hash": str(hash(prompt))[-8:],
            "complianceStatus": "LOGGED",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }

    audit = await step.run("write-agent-compliance-log", _write_audit_entry)

    return {
        "status": "OBSERVED",
        "runId": run_id,
        "governanceStatus": status,
        "stepsLogged": ["log-agent-run-initiation", "log-governance-outcome", "write-agent-compliance-log"]
    }

def register_inngest_app(app):
    inngest.fast_api.serve(
        app,
        inngest_client,
        [handle_agent_chain_run],
    )

