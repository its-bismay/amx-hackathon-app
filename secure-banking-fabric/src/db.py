import asyncio
import logging
import sys
import subprocess
from src.generated.bank_client import Prisma

logger = logging.getLogger("db_client")
_bank_db: Prisma | None = None

def _ensure_query_engine():
    """Auto-fetch Prisma query engine binary if missing in production runtime container."""
    try:
        logger.info("Auto-fetching missing Prisma query engine binary...")
        res = subprocess.run(
            [sys.executable, "-m", "prisma", "py", "fetch"],
            capture_output=True,
            text=True,
            timeout=60
        )
        logger.info(f"Prisma fetch output: {res.stdout}")
        if res.stderr:
            logger.warning(f"Prisma fetch stderr: {res.stderr}")
    except Exception as e:
        logger.error(f"Failed auto-fetching Prisma query engine: {e}")

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
            err_msg = str(e)
            logger.warning(f"Database connection attempt {attempt + 1}/3 failed: {err_msg}")
            if "query-engine" in err_msg or "prisma py fetch" in err_msg:
                _ensure_query_engine()
            await asyncio.sleep(2.0)

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
