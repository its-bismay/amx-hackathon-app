# Production Dockerfile for AI Platform
FROM python:3.11-slim

WORKDIR /app

# Install build tools & system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package definitions and install dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir hatchling && pip install --no-cache-dir .

# Copy application source code
COPY src/ ./src/

EXPOSE 8000

# Run Uvicorn server bound to 0.0.0.0 and dynamic $PORT
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
