import uuid
import hashlib
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/cards", tags=["Cards Tokenization"])

MOCK_USER_CARDS = [
    {"id": "card_01", "last4": "4242", "network": "VISA", "token": "tok_card_demo1", "status": "ACTIVE"},
    {"id": "card_02", "last4": "8888", "network": "MASTERCARD", "token": "tok_card_demo2", "status": "ACTIVE"}
]

class AddCardPayload(BaseModel):
    pan: str
    expiryMonth: int
    expiryYear: int
    cvv: str
    customerId: str

def luhn_checksum_valid(card_num: str) -> bool:
    digits = [int(d) for d in card_num if d.isdigit()]
    if not digits:
        return False
    checksum = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = d * 2
            checksum += doubled - 9 if doubled > 9 else doubled
        else:
            checksum += d
    return checksum % 10 == 0

def infer_network(pan: str) -> str:
    cleaned = ''.join(c for c in pan if c.isdigit())
    if cleaned.startswith("4"):
        return "VISA"
    elif cleaned.startswith(("51", "52", "53", "54", "55")):
        return "MASTERCARD"
    elif cleaned.startswith(("60", "65", "81")):
        return "RUPAY"
    return "VISA"

@router.get("")
async def list_cards():
    return {"cards": MOCK_USER_CARDS}

@router.post("")
async def add_card(payload: AddCardPayload):
    cleaned_pan = ''.join(c for c in payload.pan if c.isdigit())
    if len(cleaned_pan) < 13 or not luhn_checksum_valid(cleaned_pan):
        return {"status": "FAILED", "error": "Invalid Card Number (Failed Server-Side Luhn Validation)"}

    last4 = cleaned_pan[-4:]
    network = infer_network(cleaned_pan)
    cvv_hash = hashlib.sha256(payload.cvv.encode()).hexdigest()
    token = f"tok_card_{uuid.uuid4().hex[:8]}"

    card_record = {
        "id": f"card_{uuid.uuid4().hex[:6]}",
        "last4": last4,
        "network": network,
        "token": token,
        "status": "ACTIVE"
    }
    MOCK_USER_CARDS.append(card_record)

    return {
        "status": "SUCCESS",
        "cardToken": token,
        "last4": last4,
        "network": network,
        "message": "Card tokenized successfully. Raw PAN discarded."
    }
