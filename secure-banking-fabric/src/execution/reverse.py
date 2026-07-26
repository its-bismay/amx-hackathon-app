import time
import uuid
from typing import Dict, Any
from src.execution.transfer import MOCK_TRANSACTIONS, MOCK_ACCOUNTS, MOCK_LEDGER

async def execute_reversal(transaction_id: str, reason: str) -> Dict[str, Any]:
    """
    Executes a compensating reversal transaction for a previously completed transaction.
    Adds a CREDIT entry, updates ledger, and marks original transaction REVERSED.
    """
    target_tx = None
    for tx in MOCK_TRANSACTIONS:
        if tx["id"] == transaction_id:
            target_tx = tx
            break

    if not target_tx:
        return {"status": "FAILED", "reason": f"Transaction '{transaction_id}' not found"}

    if target_tx["status"] == "REVERSED":
        return {"status": "FAILED", "reason": f"Transaction '{transaction_id}' is already reversed"}

    account_id = target_tx["accountId"]
    account = MOCK_ACCOUNTS.get(account_id, MOCK_ACCOUNTS["acc_salary_101"])
    reversal_amount = target_tx["amount"]

    # Re-credit the account balance
    account["balance"] += reversal_amount

    reversal_tx_id = f"tx_rev_{uuid.uuid4().hex[:10]}"
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    reversal_entry = {
        "id": reversal_tx_id,
        "accountId": account["id"],
        "accountType": account["type"],
        "type": "CREDIT",
        "amount": reversal_amount,
        "counterparty": f"REVERSAL: {target_tx['counterparty']}",
        "requestId": f"req_rev_{uuid.uuid4().hex[:8]}",
        "status": "COMPLETED",
        "reversalOfId": target_tx["id"],
        "reversedById": None,
        "reason": reason,
        "createdAt": now
    }
    MOCK_TRANSACTIONS.append(reversal_entry)

    # Mark original transaction as REVERSED
    target_tx["status"] = "REVERSED"
    target_tx["reversedById"] = reversal_tx_id

    # Ledger entry for reversal
    ledger_entry = {
        "id": f"led_{uuid.uuid4().hex[:10]}",
        "transactionId": reversal_tx_id,
        "entryType": "CREDIT",
        "amount": reversal_amount,
        "balanceAfter": account["balance"],
        "createdAt": now
    }
    MOCK_LEDGER.append(ledger_entry)

    return {
        "status": "REVERSED",
        "originalTransactionId": target_tx["id"],
        "reversalTransactionId": reversal_tx_id,
        "amountReversed": reversal_amount,
        "updatedBalance": account["balance"],
        "reason": reason
    }
