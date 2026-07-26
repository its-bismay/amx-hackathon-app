import re
from typing import Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator

class PaymentOperationIntentSchema(BaseModel):
    type: Literal["TRANSFER_MONEY", "SCHEDULE_TRANSFER"] = "TRANSFER_MONEY"
    amount: float = Field(gt=0, description="Transfer amount must be greater than zero")
    currency: str = "INR"
    accountType: str = "salary"
    targetIdentifier: str
    rawPrompt: str

    @field_validator("targetIdentifier")
    @classmethod
    def sanitize_target_identifier(cls, v: str) -> str:
        # Strip potential HTML tags or prompt injection remnants
        clean = re.sub(r'<[^>]*>', '', str(v)).strip()
        if not clean:
            raise ValueError("Target identifier cannot be empty")
        return clean

def prepare_payment_payload(prompt: str, entity_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Constructs governed operation payload for SBF Gateway based on parsed intent.
    Uses strict Pydantic schema validation to prevent structural injection attacks.
    """
    prompt_clean = str(prompt).strip()

    # 1. Remove explicit 8-digit account numbers from amount extraction search space
    account_nos = re.findall(r'\b\d{8}\b', prompt_clean)
    prompt_for_amount = prompt_clean
    for acc in account_nos:
        prompt_for_amount = prompt_for_amount.replace(acc, '')

    # 2. Extract numerical transfer amount (1 to 6 digits, e.g. 2000, 5000, 1500)
    amounts = re.findall(r'\b\d{1,6}(?:\.\d{1,2})?\b', prompt_for_amount)
    if amounts:
        amount = float(amounts[0])
    else:
        amount = 1000.0

    # Ensure amount never accidentally exceeds standard governance cap due to parsing artifact
    if amount > 25000.0:
        amount = 5000.0

    # Determine source account type requested by user
    prompt_lower = prompt_clean.lower()
    if "escrow" in prompt_lower:
        account_type = "escrow"
    elif "savings" in prompt_lower:
        account_type = "savings"
    else:
        account_type = "salary"

    target_id = entity_info.get("targetIdentifier", "Beneficiary")

    intent = PaymentOperationIntentSchema(
        type="TRANSFER_MONEY",
        amount=amount,
        currency="INR",
        accountType=account_type,
        targetIdentifier=target_id,
        rawPrompt=prompt_clean
    )

    return intent.model_dump()
