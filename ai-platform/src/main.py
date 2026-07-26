from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.config import PORT
from src.routes.chat import router as chat_router
from src.routes.health import router as health_router
from src.routes.rogue import router as rogue_router
from src.inngest_app import register_inngest_app

app = FastAPI(
    title="AI Platform",
    description="AI Reasoning, Multi-Agent Orchestrator & Gemini Key Pool Engine",
    version="1.0.0"
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
app.include_router(chat_router)
app.include_router(health_router)
app.include_router(rogue_router)

# Mount Inngest endpoint
try:
    register_inngest_app(app)
except Exception as e:
    print(f"Inngest registration note: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
