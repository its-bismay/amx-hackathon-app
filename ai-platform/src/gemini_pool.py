import time
import heapq
import logging
from typing import List, Dict, Any

logger = logging.getLogger("gemini_key_pool")

class KeyState:
    def __init__(self, key_id: str, api_key: str):
        self.key_id = key_id
        self.api_key = api_key
        self.rpm_used = 0
        self.tpm_used = 0
        self.rpd_used = 0
        self.window_start = time.time()
        self.next_available_at = time.time()

    def __lt__(self, other: "KeyState"):
        return self.next_available_at < other.next_available_at

class GeminiKeyPool:
    def __init__(self, api_keys: List[str]):
        now = time.time()
        self.heap: List[KeyState] = []
        for idx, key in enumerate(api_keys, 1):
            ks = KeyState(f"key-{idx}", key)
            heapq.heappush(self.heap, ks)

    def _reset_expired_windows(self):
        now = time.time()
        for ks in self.heap:
            if now - ks.window_start >= 60.0:
                ks.rpm_used = 0
                ks.tpm_used = 0
                ks.window_start = now
                ks.next_available_at = now
        heapq.heapify(self.heap)

    def acquire_key(self, estimated_tokens: int = 500, _depth: int = 0) -> KeyState:
        """
        Picks the soonest available key from min-heap.
        Enforces RPM <= 10, TPM <= 250k, RPD <= 500.
        Raises RuntimeError if all 4 keys are fully saturated (RPD >= 500).
        """
        if _depth > len(self.heap) + 1:
            raise RuntimeError("All Gemini API keys are fully saturated (daily limit reached).")

        self._reset_expired_windows()
        ks = heapq.heappop(self.heap)

        if ks.rpm_used >= 10 or (ks.tpm_used + estimated_tokens) >= 250_000 or ks.rpd_used >= 500:
            # Shift availability to next window start
            ks.next_available_at = ks.window_start + 60.0
            heapq.heappush(self.heap, ks)
            logger.info(f"Gemini Key '{ks.key_id}' saturated. Picking next key from pool.")
            return self.acquire_key(estimated_tokens, _depth=_depth + 1)

        # Update stats
        ks.rpm_used += 1
        ks.tpm_used += estimated_tokens
        ks.rpd_used += 1
        heapq.heappush(self.heap, ks)

        logger.info(f"Acquired Gemini Key '{ks.key_id}' (RPM: {ks.rpm_used}/10, TPM: {ks.tpm_used})")
        return ks

    def get_pool_status(self) -> List[Dict[str, Any]]:
        self._reset_expired_windows()
        return [
            {
                "keyId": ks.key_id,
                "rpmUsed": ks.rpm_used,
                "tpmUsed": ks.tpm_used,
                "rpdUsed": ks.rpd_used,
                "nextAvailableIn": max(0.0, round(ks.next_available_at - time.time(), 2))
            }
            for ks in self.heap
        ]

# Global Gemini Pool Instance initialized with 4 keys
from src.config import GEMINI_API_KEYS
gemini_pool = GeminiKeyPool(GEMINI_API_KEYS)
