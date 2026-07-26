# AEGIS Governance Platform — Cloud Deployment Guide

This guide provides complete instructions for deploying the **AEGIS Enterprise AI Agent Governance Platform** using Docker Web Services on Render and Vercel.

---

## 🏗️ Production Docker Services Overview

Your codebase includes **3 dedicated production Dockerfiles**:

1. **`secure-banking-fabric/Dockerfile`** ➔ Core Banking & Governance API (Port 8001)
2. **`ai-platform/Dockerfile`** ➔ AI Reasoning & Agent Orchestrator (Port 8000)
3. **`Dockerfile.opa`** ➔ Open Policy Agent Governance Sidecar (Port 8181)

Using Docker on Render guarantees that `openssl` and all Prisma binaries (`prisma py fetch`) are baked directly into the image filesystem, avoiding cold-start query engine missing errors.

---

## ☁️ Render Dashboard Configuration Matrix

When creating or editing Web Services on Render, set **Root Directory** so Docker can find `src/` and `prisma/`:

| Service Name | Environment | Root Directory | Dockerfile Path |
| :--- | :--- | :--- | :--- |
| **`aegis-sbf`** | `Docker` | `secure-banking-fabric` | `Dockerfile` |
| **`aegis-ai-platform`** | `Docker` | `ai-platform` | `Dockerfile` |
| **`aegis-opa`** | `Docker` | `.` (or blank) | `Dockerfile.opa` |

---

## ⏳ Recommended Order of Deployment

To ensure each service can reference the live URLs of its dependencies, follow this exact sequence:

```
[1. Upstash Redis & Neon Postgres]
               │
               ▼
   [2. Deploy OPA on Render] ──► Generates OPA_URL
               │
               ▼
   [3. Deploy SBF on Render] ──► Generates SBF_URL
               │
               ▼
[4. Deploy AI Platform on Render] ──► Generates AI_PLATFORM_URL
               │
               ▼
  [5. Deploy Frontend on Vercel] ──► Connects everything with Warm-Up UI!
```

---

## 🛠️ Step 1: External Managed Services Setup

### 1.1 Upstash Redis (Replaces local `aegis-redis` container)
1. Sign up at [Upstash.com](https://upstash.com/).
2. Click **Create Database** ➔ Name: `aegis-redis`.
3. Enable **TLS**.
4. Copy the connection string: `rediss://default:<password>@<host>:6379`.

### 1.2 Neon PostgreSQL (Banking Ledger Database)
1. Sign up at [Neon.tech](https://neon.tech/).
2. Create project `aegis-banking`.
3. Copy connection string: `postgres://<user>:<pass>@<host>/<db>?sslmode=require`.

---

## 🐳 Step 2: Deploying Docker Web Services on Render

### 2.1 Deploy Service 1: `aegis-opa` (Docker Web Service)
1. Go to [Render Dashboard](https://dashboard.render.com/) ➔ **New +** ➔ **Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `aegis-opa`
   - **Environment**: `Docker`
   - **Root Directory**: `.` (or leave blank)
   - **Dockerfile Path**: `Dockerfile.opa`
4. Click **Create Web Service**.
5. Copy your deployed URL: `https://aegis-opa.onrender.com`.

### 2.2 Deploy Service 2: `secure-banking-fabric` (Docker Web Service)
1. In Render ➔ **New +** ➔ **Web Service**.
2. Connect repository.
3. Configure settings:
   - **Name**: `aegis-sbf`
   - **Environment**: `Docker`
   - **Root Directory**: `secure-banking-fabric`
   - **Dockerfile Path**: `Dockerfile`
4. Add **Environment Variables**:
   ```env
   PORT=8001
   BANK_DATABASE_URL=postgres://... (Neon Postgres string)
   GOVERNANCE_DATABASE_URL=postgres://... (Neon Postgres string)
   REDIS_URL=rediss://... (Upstash Redis string)
   OPA_URL=https://aegis-opa.onrender.com
   JWT_SECRET=your-secure-jwt-secret-key
   ```
5. Click **Create Web Service**. Copy URL: `https://aegis-sbf.onrender.com`.

### 2.3 Deploy Service 3: `ai-platform` (Docker Web Service)
1. In Render ➔ **New +** ➔ **Web Service**.
2. Connect repository.
3. Configure settings:
   - **Name**: `aegis-ai-platform`
   - **Environment**: `Docker`
   - **Root Directory**: `ai-platform`
   - **Dockerfile Path**: `Dockerfile`
4. Add **Environment Variables**:
   ```env
   PORT=8000
   SBF_URL=https://aegis-sbf.onrender.com
   REDIS_URL=rediss://... (Upstash Redis string)
   JWT_SECRET=your-secure-jwt-secret-key
   GEMINI_API_KEY_1=your-gemini-api-key
   ```
5. Click **Create Web Service**. Copy URL: `https://aegis-ai-platform.onrender.com`.

---

## ⚡ Step 3: Deploying Frontend on Vercel

1. Go to [Vercel](https://vercel.com/) ➔ **Add New...** ➔ **Project**.
2. Import repository and set **Root Directory** to `frontend`.
3. Under **Environment Variables**, set:
   - `VITE_SBF_URL` = `https://aegis-sbf.onrender.com`
   - `VITE_AI_PLATFORM_URL` = `https://aegis-ai-platform.onrender.com`
   - `VITE_OPA_URL` = `https://aegis-opa.onrender.com`
4. Click **Deploy**.

---

## ☕ Step 4: Render Free-Tier Cold-Start Handling (Warm-Up UI)

Because Render free tier services spin down after 15 minutes of inactivity:
- The frontend features an automatic **BootScreen (Warm-Up UI)** component.
- In production, it pings the `/health` endpoints of SBF and AI Platform with a 30s timeout until both services wake up.
- Shows live status badges (`WAKING UP` ➔ `ONLINE`) and a clear user notice so users know why services take 30-60s on initial load.

---

## ✅ Deployment Verification & Testing

Once deployed:
1. Open your Vercel URL.
2. The Warm-Up Boot Screen will wait for Render services to wake up.
3. Log in with demo credentials (`arjun@demo.in` / `demo1234`).
4. Click **"Spawn Rogue Agent"** in the User Dashboard.
5. Navigate to **Admin Dashboard ➔ Agent Fleet** and click **"Kill Rogue Now"** to demonstrate live cloud governance!
