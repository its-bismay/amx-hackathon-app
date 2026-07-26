import asyncio
import hashlib
from src.generated.bank_client import Prisma

USERS_DATA = [
    {"email": "admin118@amx.in", "name": "System Root Administrator", "phone": "9999999999", "accountNo": "99999999", "balance": 1000000.0, "password": "12345678", "role": "ADMIN"},
    {"email": "arjun@demo.in", "name": "Arjun Mehta", "phone": "9876543210", "accountNo": "10001001", "balance": 150000.0, "password": "demo1234", "role": "USER"},
    {"email": "priya@demo.in", "name": "Priya Verma", "phone": "9876543211", "accountNo": "10001002", "balance": 75000.0, "password": "demo1234", "role": "USER"},
    {"email": "rahul@demo.in", "name": "Rahul Sharma", "phone": "9876543212", "accountNo": "10001003", "balance": 100000.0, "password": "demo1234", "role": "USER"},
    {"email": "neha@demo.in", "name": "Neha Singh", "phone": "9876543213", "accountNo": "10001004", "balance": 50000.0, "password": "demo1234", "role": "USER"},
    {"email": "vikram@demo.in", "name": "Vikram Das", "phone": "9876543214", "accountNo": "10001005", "balance": 200000.0, "password": "demo1234", "role": "USER"},
]

def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

async def seed():
    db = Prisma()
    await db.connect()
    print("Connected to Neon Bank DB. Seeding users and Root Admin...")

    for u in USERS_DATA:
        existing_user = await db.user.find_unique(where={"email": u["email"]})
        if existing_user:
            print(f"User {u['email']} already exists. Skipping...")
            continue

        cust = await db.customer.create(
            data={
                "name": u["name"],
                "email": u["email"],
                "phone": u["phone"],
            }
        )

        acc = await db.account.create(
            data={
                "customerId": cust.id,
                "type": "savings",
                "accountNo": u["accountNo"],
                "balance": u["balance"],
                "currency": "INR",
                "status": "ACTIVE"
            }
        )

        user = await db.user.create(
            data={
                "email": u["email"],
                "passwordHash": hash_pw(u["password"]),
                "customerId": cust.id
            }
        )
        print(f"Created User {user.email} (Cust ID: {cust.id}, Account No: {acc.accountNo}, Balance: INR {acc.balance})")

    await db.disconnect()
    print("Seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed())
