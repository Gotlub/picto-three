FROM python:3.11-slim AS app-e2e
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app
RUN apt-get update && apt-get install -y --no-install-recommends libmagic1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 e2e && useradd --uid 1000 --gid 1000 --create-home e2e
WORKDIR /app
COPY requirements.txt .
COPY tests/e2e/requirements.lock /tmp/e2e-requirements.lock
RUN pip install --no-cache-dir -r requirements.txt -c /tmp/e2e-requirements.lock && pip check
COPY config.py .
COPY app/ app/
COPY migrations/ migrations/
COPY tests/e2e/support/ tests/e2e/support/
USER 1000:1000
CMD ["sh", "-c", "python tests/e2e/support/seed.py && exec gunicorn --chdir /app/tests/e2e/support --bind 0.0.0.0:5000 --workers 1 --threads 1 --worker-tmp-dir /tmp --access-logfile - bootstrap:app"]

FROM mcr.microsoft.com/playwright:v1.58.2-noble AS playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /runner
COPY tests/e2e/package.json tests/e2e/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tests/e2e/ ./
RUN npm run typecheck
USER pwuser
CMD ["npx", "playwright", "test", "--config=playwright.config.ts"]
