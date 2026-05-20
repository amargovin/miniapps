FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
COPY app/ ./app/
COPY schema.sql ./

RUN pip install --upgrade pip && pip install -e .

# Pre-download embedding model so first request isn't a cold start.
RUN python -c "from sentence_transformers import SentenceTransformer; \
               SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Playwright + Chromium for the homepage-vision fetcher.
RUN playwright install --with-deps chromium

RUN mkdir -p data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
