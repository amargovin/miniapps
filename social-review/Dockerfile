# One image, one deployed service: `api`, always on, started by the CMD below.
#
# The brief's §2 called for a second `weekly` service on a Railway cron. There isn't one
# (see CLAUDE.md amendments): POST /v1/runs starts the same pipeline in the background, so
# an external scheduler hitting that endpoint replaces the container entirely. The CLI is
# still here for shell access and as the fallback when the API is unreachable.
FROM python:3.12-slim

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

CMD ["sh", "-c", "uvicorn app.api:app --host 0.0.0.0 --port ${PORT:-8000}"]
