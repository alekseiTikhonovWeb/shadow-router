FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
# Railway injects $PORT (local default 8000). Shell form so the variable expands.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
