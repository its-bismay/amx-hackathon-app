# Production Dockerfile for Secure Banking Fabric (SBF)
FROM python:3.11-slim

WORKDIR /app

# Install build tools & system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir hatchling && pip install --no-cache-dir -r requirements.txt

# Copy application source code & prisma schemas
COPY src/ ./src/
COPY prisma/ ./prisma/

# Fetch query engine and generate Prisma clients for bank & governance schemas inside the image
RUN prisma py fetch && \
    prisma generate --schema=prisma/bank.prisma && \
    prisma generate --schema=prisma/governance.prisma

EXPOSE 8001

# Run Uvicorn server bound to 0.0.0.0 and dynamic $PORT
CMD ["sh", "-c", "python -m uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
