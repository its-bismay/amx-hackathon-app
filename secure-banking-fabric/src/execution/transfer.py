import time
import uuid
import logging
from typing import Dict, Any
import redis.asyncio as redis
from src.config import REDIS_URL

logger = logging.getLogger("execution_transfer")

# In-memory fallback bank database for demo stability
MOCK_ACCOUNTS = {
    "acc_salary_101": {"id": "acc_salary_101", "customerId": "cust_101", "type": "salary", "accountNo": "10001001", "balance": 150000.0, "currency": "INR", "status": "ACTIVE"},
    "acc_savings_101": {"id": "acc_savings_101", "customerId": "cust_101", "type": "savings", "accountNo": "10001002", "balance": 45000.0, "currency": "INR", "status": "ACTIVE"},
    "acc_escrow_101": {"id": "acc_escrow_101", "customerId": "cust_101", "type": "escrow", "accountNo": "10001003", "balance": 500000.0, "currency": "INR", "status": "ACTIVE"},
}

MOCK_TRANSACTIONS = []
MOCK_LEDGER = []

async def execute_transfer(
    account_id: str,
    amount: float,
    counterparty: str,
    request_id: str,
    customer_id: str
) -> Dict[str, Any]:
    """Executes money transfer in mock banking database & records ledger entry."""
    account = MOCK_ACCOUNTS.get(account_id)
    if not account:
        # Fallback to salary account if given unknown id
        account = MOCK_ACCOUNTS["acc_salary_101"]

    if account["balance"] < amount:
        return {"status": "FAILED", "reason": "Insufficient funds"}

    # Deduct balance
    account["balance"] -= amount

    tx_id = f"tx_{uuid.uuid4().hex[:10]}"
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    tx_entry = {
        "id": tx_id,
        "accountId": account["id"],
        "accountType": account["type"],
        "type": "DEBIT",
        "amount": amount,
        "counterparty": counterparty,
        "requestId": request_id,
        "status": "COMPLETED",
        "reversalOfId": None,
        "reversedById": None,
        "createdAt": now
    }
    MOCK_TRANSACTIONS.append(tx_entry)

    ledger_entry = {
        "id": f"led_{uuid.uuid4().hex[:10]}",
        "transactionId": tx_id,
        "entryType": "DEBIT",
        "amount": amount,
        "balanceAfter": account["balance"],
        "createdAt": now
    }
    MOCK_LEDGER.append(ledger_entry)

    # Accumulate Redis daily spend
    try:
        r = redis.from_url(REDIS_URL, decode_responses=True)
        await r.incrbyfloat(f"spend:{customer_id}", amount)
    except Exception as e:
        logger.warning(f"Could not update Redis spend accumulator: {e}")

    return {
        "status": "COMPLETED",
        "transactionId": tx_id,
        "amount": amount,
        "remainingBalance": account["balance"],
        "counterparty": counterparty
    }
