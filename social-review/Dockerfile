# One image, two entrypoints (brief §2):
#   api    — default CMD below (always-on)
#   weekly — Railway service overrides start command to: python -m app.cli run
FROM python:3.12-slim

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

CMD ["sh", "-c", "uvicorn app.api:app --host 0.0.0.0 --port ${PORT:-8000}"]
