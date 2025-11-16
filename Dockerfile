# Dockerfile в корне для Railway
# Railway будет использовать этот Dockerfile с build context = корень репозитория

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    postgresql-client \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from backend directory
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code from backend directory
COPY backend/ .

# Expose port
EXPOSE 8000

# Run application
# Railway will set PORT environment variable
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}










