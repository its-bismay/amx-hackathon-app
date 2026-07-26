import hashlib
import random
import string
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from src.db import get_bank_db
from src.gateway.auth import issue_user_token, get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["User Authentication"])

class RegisterPayload(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str

class LoginPayload(BaseModel):
    email: EmailStr
    password: str

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def generate_account_no() -> str:
    return "".join(random.choices(string.digits, k=8))

@router.post("/register")
async def register(payload: RegisterPayload):
    db = await get_bank_db()
    existing = await db.user.find_unique(where={"email": payload.email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Create Customer
    customer = await db.customer.create(
        data={
            "name": payload.name,
            "email": payload.email,
            "phone": payload.phone,
        }
    )

    # Create default Savings Account with ₹50,000 initial dummy balance
    account_no = generate_account_no()
    account = await db.account.create(
        data={
            "customerId": customer.id,
            "type": "savings",
            "accountNo": account_no,
            "balance": 50000.0,
            "currency": "INR",
            "status": "ACTIVE"
        }
    )

    # Create User
    user = await db.user.create(
        data={
            "email": payload.email,
            "passwordHash": hash_password(payload.password),
            "customerId": customer.id
        }
    )

    role = "ADMIN" if payload.email.lower() == "admin118@amx.in" else "USER"
    token = issue_user_token(user.id, customer.id, user.email, role=role)

    return {
        "status": "SUCCESS",
        "message": "Account created successfully",
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "customerId": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "role": role
        },
        "account": {
            "id": account.id,
            "accountNo": account.accountNo,
            "balance": account.balance,
            "type": account.type,
            "currency": account.currency
        }
    }

@router.post("/login")
async def login(payload: LoginPayload):
    db = await get_bank_db()

    # Special auto-provisioning for Root Admin if needed
    if payload.email.lower() == "admin118@amx.in" and payload.password == "12345678":
        admin_user = await db.user.find_unique(where={"email": "admin118@amx.in"})
        if not admin_user:
            cust = await db.customer.create(data={"name": "System Root Administrator", "email": "admin118@amx.in", "phone": "9999999999"})
            acc = await db.account.create(data={"customerId": cust.id, "type": "savings", "accountNo": "99999999", "balance": 1000000.0, "currency": "INR", "status": "ACTIVE"})
            admin_user = await db.user.create(data={"email": "admin118@amx.in", "passwordHash": hash_password("12345678"), "customerId": cust.id})

    user = await db.user.find_unique(where={"email": payload.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.passwordHash != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    customer = await db.customer.find_unique(where={"id": user.customerId})
    account = await db.account.find_first(where={"customerId": user.customerId, "type": "savings"})
    if not account:
        account = await db.account.find_first(where={"customerId": user.customerId})

    role = "ADMIN" if payload.email.lower() == "admin118@amx.in" else "USER"
    token = issue_user_token(user.id, user.customerId, user.email, role=role)

    return {
        "status": "SUCCESS",
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "customerId": customer.id,
            "name": customer.name if customer else "User",
            "phone": customer.phone if customer else "",
            "role": role
        },
        "account": {
            "id": account.id if account else None,
            "accountNo": account.accountNo if account else "0000000000",
            "balance": account.balance if account else 0.0,
            "type": account.type if account else "savings",
            "currency": account.currency if account else "INR"
        }
    }

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    db = await get_bank_db()
    user = await db.user.find_unique(where={"id": current_user["userId"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    customer = await db.customer.find_unique(where={"id": user.customerId})
    accounts = await db.account.find_many(where={"customerId": user.customerId})

    role = "ADMIN" if user.email.lower() == "admin118@amx.in" else "USER"

    return {
        "status": "SUCCESS",
        "user": {
            "id": user.id,
            "email": user.email,
            "customerId": user.customerId,
            "name": customer.name if customer else "",
            "phone": customer.phone if customer else "",
            "role": role
        },
        "accounts": [
            {
                "id": a.id,
                "accountNo": a.accountNo,
                "balance": a.balance,
                "type": a.type,
                "status": a.status,
                "currency": a.currency
            } for a in accounts
        ]
    }
