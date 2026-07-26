# Enterprise AI Agent Governance Platform for Banking

AEGIS is an enterprise safety infrastructure designed to run autonomous AI agent fleets safely over critical banking APIs. Reasoning (AI Platform) is strictly decoupled from Execution & Banking Data (Secure Banking Fabric).

---

## 🏗 Architecture Overview

```text
                     USER / ADMIN BROWSER
                              │
                              ▼
                       React Frontend
                    (User & Admin Portals)
                              │
         ┌────────────────────┴────────────────────┐
         │                                         │
         ▼                                         ▼
  AI Platform (FastAPI)                   Secure Banking Fabric (SBF)
┌─────────────────────────┐             ┌──────────────────────────────┐
│ • Chat & Reasoning      │             │ • Agent Gateway              │
│ • LangChain / LangGraph │             │ • OPA Governance Policy      │
│ • Gemini 4-Key Pool     │             │ • Redis Kill Switches        │
│ • Short-lived Agent JWT │             │ • Core Banking & Ledger      │
│ • Inngest Orchestration │             │ • Out-of-Band OTP Engine     │
└────────────┬────────────┘             │ • Card Tokenization Engine   │
             │                          └──────────────┬───────────────┘
             │                                         │
             └────── POST /api/v1/agent/request ───────┘
                     (Bearer mTLS + Agent JWT)
```

---

## 🚀 Quick Start Instructions

### Prerequisites
- Python 3.10+ & `uv` package manager
- Node.js 18+ & `npm`
- Docker & Docker Compose

### Step 1: Start Redis & OPA Sidecar
```bash
docker-compose up -d
```

### Step 2: Start Secure Banking Fabric (SBF) Microservice
```bash
cd secure-banking-fabric
uv run uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload
```

### Step 3: Start AI Platform Microservice
```bash
cd ai-platform
uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 4: Start Frontend Portal
```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛡 Security Guardrails Highlight

1. **Decoupled Trust Boundary**: AI Platform `.env` never contains banking DB credentials.
2. **Out-of-Band OTP**: Browser submits OTP code directly to SBF. Agent never processes OTP digits.
3. **Card Tokenization**: PAN/CVV tokenized directly with SBF (`tok_card_...`). Agent only sees tokens.
4. **3-Level Emergency Controls**: Instance kill, Agent-type disable, Fleet-wide Red Kill Switch (`system:ai`).
5. **Compensating Transaction Reversal**: Real-world reversal pattern with audit trail logging.
6. **Gemini Min-Heap Pool**: Round-robin rate limit scheduling across 4 API keys.
