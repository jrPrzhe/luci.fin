# Dockerfile для Railway Scheduler (ежедневные напоминания)
FROM python:3.11-slim

# Set working directory
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

# Copy requirements first for better caching
COPY backend/requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ /app/backend/

# Set PYTHONPATH so imports work correctly
ENV PYTHONPATH=/app

# Default command (will be overridden by Railway Start Command)
CMD ["python", "backend/scripts/send_daily_reminders.py"]









