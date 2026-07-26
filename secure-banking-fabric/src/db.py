import asyncio
import logging
from src.generated.bank_client import Prisma

logger = logging.getLogger("db_client")
_bank_db: Prisma | None = None

async def get_bank_db() -> Prisma | None:
    global _bank_db
    if _bank_db is not None:
        if _bank_db.is_connected():
            return _bank_db
        else:
            try:
                await _bank_db.disconnect()
            except Exception:
                pass
            _bank_db = None

    _bank_db = Prisma()
    for attempt in range(3):
        try:
            await _bank_db.connect()
            logger.info("Successfully connected to Bank Database")
            return _bank_db
        except Exception as e:
            logger.warning(f"Database connection attempt {attempt + 1}/3 failed: {e}")
            await asyncio.sleep(1.0)

    _bank_db = None
    return None

async def close_bank_db():
    global _bank_db
    if _bank_db is not None:
        try:
            if _bank_db.is_connected():
                await _bank_db.disconnect()
        except Exception:
            pass
        _bank_db = None
