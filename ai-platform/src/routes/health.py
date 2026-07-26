from fastapi import APIRouter

router = APIRouter(tags=["Health"])

@router.get("/health")
async def health_check():
    return {
        "service": "ai-platform",
        "status": "healthy",
        "version": "1.0.0"
    }
