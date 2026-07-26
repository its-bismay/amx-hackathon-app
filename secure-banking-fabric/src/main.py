from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.config import PORT
from src.db import get_bank_db, close_bank_db
from src.routes.auth import router as auth_router
from src.routes.bank import router as bank_router
from src.routes.gateway import router as gateway_router
from src.routes.otp import router as otp_router
from src.routes.cards import router as cards_router
from src.routes.admin import router as admin_router
from src.routes.health import router as health_router
from src.inngest_app import register_inngest_app

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to Prisma Neon DB
    try:
        await get_bank_db()
        print("Prisma DB connected successfully.")
    except Exception as e:
        print(f"Prisma connection notice: {e}")
    yield
    # Shutdown: Disconnect DB
    await close_bank_db()

app = FastAPI(
    title="Secure Banking Fabric (SBF)",
    description="Enterprise Banking Security, Governance Pipeline & Core Banking API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for browser frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth_router)
app.include_router(bank_router)
app.include_router(gateway_router)
app.include_router(otp_router)
app.include_router(cards_router)
app.include_router(admin_router)
app.include_router(health_router)

# Mount Inngest endpoint
try:
    register_inngest_app(app)
except Exception as e:
    print(f"Inngest registration note: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
