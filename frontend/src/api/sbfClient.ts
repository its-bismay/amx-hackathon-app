const SBF_BASE_URL = import.meta.env.VITE_SBF_URL ?? "http://localhost:8001";

function getAuthHeader(token?: string): Record<string, string> {
  const authToken = token || localStorage.getItem("aegis_token") || "";
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

export async function verifyOtpDirect(challengeId: string, otpCode: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId, otpCode }),
  });
  return resp.json();
}

export async function addCardDirect(pan: string, expiryMonth: number, expiryYear: number, cvv: string, customerId: string = "cust_101") {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pan, expiryMonth, expiryYear, cvv, customerId }),
  });
  return resp.json();
}

export async function getCardsDirect() {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/cards`);
  return resp.json();
}

export async function getFleetStatus(token?: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/admin/fleet`, {
    headers: { ...getAuthHeader(token) }
  });
  return resp.json();
}

export async function toggleKillSwitch(level: "FLEET" | "TYPE" | "INSTANCE", target: string | null, status: string, token?: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/admin/kill-switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
    body: JSON.stringify({ level, target, status }),
  });
  return resp.json();
}

export async function getPolicy(token?: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/admin/policy`, {
    headers: { ...getAuthHeader(token) }
  });
  return resp.json();
}

export async function updatePolicy(policy: { perTransactionCap: number; dailyCap: number; requireOtpAbove: number; allowedOperations: string[] }, token?: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/admin/policy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
    body: JSON.stringify(policy),
  });
  return resp.json();
}

export async function getAuditLogs(token?: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/admin/audit`, {
    headers: { ...getAuthHeader(token) }
  });
  return resp.json();
}

export async function getBankOverview(token?: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/admin/bank/overview`, {
    headers: { ...getAuthHeader(token) }
  });
  return resp.json();
}

export async function triggerReversal(transactionId: string, reason: string, token?: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/admin/reversal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader(token) },
    body: JSON.stringify({ transactionId, reason }),
  });
  return resp.json();
}

export async function getRedisState(token?: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/admin/redis-state`, {
    headers: { ...getAuthHeader(token) }
  });
  return resp.json();
}

