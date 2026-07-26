import asyncio
import logging
import os
import sys
import shutil
import subprocess
from pathlib import Path
from src.generated.bank_client import Prisma

logger = logging.getLogger("db_client")
_bank_db: Prisma | None = None

def _ensure_query_engine():
    """Auto-fetch Prisma query engine binary and place it in current directory with execute permissions."""
    try:
        logger.info("Auto-fetching Prisma query engine binary...")
        # 1. Run prisma py fetch
        res = subprocess.run(
            [sys.executable, "-m", "prisma", "py", "fetch"],
            capture_output=True,
            text=True,
            timeout=120
        )
        logger.info(f"Prisma fetch stdout: {res.stdout}")
        
        # 2. Search for downloaded binary in ~/.cache or /tmp or /opt/render/.cache
        target_name = "prisma-query-engine-debian-openssl-3.0.x"
        local_target = Path.cwd() / target_name
        
        if not local_target.exists():
            search_paths = [
                Path.home() / ".cache",
                Path("/opt/render/.cache"),
                Path("/tmp")
            ]
            found_binary = None
            for sp in search_paths:
                if sp.exists():
                    matches = list(sp.glob("**/prisma-query-engine*"))
                    if matches:
                        found_binary = matches[0]
                        break
            
            if found_binary:
                logger.info(f"Copying query engine binary from {found_binary} to {local_target}")
                shutil.copy(found_binary, local_target)
                os.chmod(local_target, 0o755)
            else:
                logger.warning(f"Could not locate downloaded query engine binary.")
        else:
            os.chmod(local_target, 0o755)

    except Exception as e:
        logger.error(f"Error ensuring Prisma query engine: {e}")

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
            if "query-engine" in err_msg or "prisma py fetch" in err_msg or attempt == 0:
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
