FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir fastapi uvicorn anthropic python-dotenv httpx pydantic slowapi qdrant-client voyageai

COPY app/ ./app/

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
