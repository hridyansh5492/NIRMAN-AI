# ==============================================================================
# Multi-Stage Dockerfile for Nirman-AI (PAIMANA)
# Stage 1: Build React 18 / Vite Frontend SPA
# Stage 2: Python 3.12 Slim Runtime for FastAPI, XGBoost, SHAP & AI Copilot
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Frontend Build
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies first for optimal Docker layer caching
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and build static bundle
COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Production Python Runtime
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS runner
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Install required system packages (libgomp1 required for XGBoost OpenMP acceleration)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application files, ML models, and dataset baselines
COPY api.py scoring.py fraud_detector.py verification_pipeline.py db_manager.py llm.py mock_data.py ./
COPY cop_model.json top_model.json ./
COPY schema.sql *.csv *.db ./

# Copy compiled frontend SPA from Stage 1 into the location expected by api.py
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port (default 8000)
EXPOSE 8000

# Health check to ensure the service is running and ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Start the unified FastAPI application via Uvicorn
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}"]
