const SBF_BASE_URL = "http://localhost:8001";

export async function fetchDemoAccounts() {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/bank/demo-accounts`);
  return resp.json();
}

export async function fetchPublicUsers(token: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/bank/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp.json();
}

export async function fetchMyTransactions(token: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/bank/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp.json();
}

export async function initiateDirectTransfer(token: string, recipientAccountNo: string, amount: number, note?: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/bank/transfer/initiate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ recipientAccountNo, amount, note }),
  });
  return resp.json();
}

export async function confirmDirectTransfer(token: string, challengeId: string, otpCode: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/bank/transfer/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ challengeId, otpCode }),
  });
  return resp.json();
}
