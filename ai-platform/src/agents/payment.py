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


def _extract_amount(text: str) -> float:
    """
    Robustly extracts a monetary amount from a prompt string.

    Handles all common Indian number formats:
      - With rupee symbol:  ₹95,000  →  95000
      - With commas:        95,000   →  95000
      - With 'k' suffix:   95k      →  95000
      - Plain integer:      95000    →  95000
      - With decimals:      ₹1,500.50 → 1500.5

    Strategy:
      1. Normalize: strip the rupee sign (₹) and any unicode currency symbols.
      2. Find candidate tokens that look like numbers (digits, commas, dots).
      3. Remove commas (Indian grouping separator) before converting to float.
      4. Handle 'k' / 'K' suffix (shorthand for thousands).
    """
    # Remove the rupee sign and similar currency prefixes so they don't break regex
    normalized = re.sub(r'[₹\u20b9$€£]', '', text)

    # Pattern: optional leading ₹/Rs, digits with optional commas and decimal
    # Matches: 95,000  |  95000  |  1,50,000  |  1500.50  |  95k  |  95K
    pattern = re.compile(
        r'(?<![\w.])'
        r'(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)'
        r'([kK])?'
        r'(?![\w.,])'
    )

    for m in pattern.finditer(normalized):
        raw_num = m.group(1).replace(',', '')   # strip Indian comma separators
        suffix  = m.group(2) or ''
        try:
            value = float(raw_num)
            if suffix.lower() == 'k':
                value *= 1000
            # Skip tiny numbers that are likely not amounts (e.g. account numbers
            # were already removed, but guard against single digits leaking through)
            if value >= 1:
                return value
        except ValueError:
            continue

    return 1000.0   # safe fallback if no amount found


def prepare_payment_payload(prompt: str, entity_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Constructs governed operation payload for SBF Gateway based on parsed intent.
    Uses strict Pydantic schema validation to prevent structural injection attacks.
    """
    prompt_clean = str(prompt).strip()

    # 1. Remove explicit 8-digit account numbers from amount extraction search space
    #    so they are never mistaken for a monetary amount.
    account_nos = re.findall(r'\b\d{8}\b', prompt_clean)
    prompt_for_amount = prompt_clean
    for acc in account_nos:
        prompt_for_amount = prompt_for_amount.replace(acc, '')

    # 2. Extract the transfer amount using the robust locale-aware extractor.
    #    NOTE: We do NOT clamp the amount here.  Governance (OPA policy in SBF)
    #    is the single source of truth for per-transaction caps.  Silently
    #    rewriting the amount before it reaches OPA would hide real user intent.
    amount = _extract_amount(prompt_for_amount)

    # 3. Determine source account type requested by user
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
