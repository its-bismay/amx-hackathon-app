const SBF_BASE_URL = "http://localhost:8001";

export async function registerUser(name: string, email: string, phone: string, password: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, phone, password }),
  });
  return resp.json();
}

export async function loginUser(email: string, password: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return resp.json();
}

export async function fetchMe(token: string) {
  const resp = await fetch(`${SBF_BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp.json();
}
