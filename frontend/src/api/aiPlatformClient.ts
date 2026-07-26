const AI_PLATFORM_BASE_URL = "http://localhost:8000";

export async function sendChatMessage(message: string, userId: string = "usr_demo101", customerId: string = "cust_101") {
  const resp = await fetch(`${AI_PLATFORM_BASE_URL}/api/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, customerId, message }),
  });
  return resp.json();
}

export async function getGeminiPoolStatus() {
  const resp = await fetch(`${AI_PLATFORM_BASE_URL}/api/chat/gemini-status`);
  return resp.json();
}

export interface SpawnRoguePayload {
  customerId?: string;
  targetAccountNo?: string;
  attemptAmount?: number;
  label?: string;
}

/**
 * Spawns a rogue autonomous agent on the AI Platform.
 * The agent continuously fires unauthorized high-value transfer requests to
 * the SBF Gateway. Admin can stop it via the Kill Switch in the Admin Dashboard.
 */
export async function spawnRogueAgent(payload: SpawnRoguePayload = {}) {
  const resp = await fetch(`${AI_PLATFORM_BASE_URL}/api/rogue/spawn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId: payload.customerId ?? "cust_101",
      targetAccountNo: payload.targetAccountNo ?? "10001002",
      attemptAmount: payload.attemptAmount ?? 999999,
      label: payload.label ?? "ROGUE-TRANSFER-BOT",
    }),
  });
  return resp.json();
}

/** Lists currently active rogue agent instances from Redis. */
export async function getRogueAgents() {
  const resp = await fetch(`${AI_PLATFORM_BASE_URL}/api/rogue/active`);
  return resp.json();
}
