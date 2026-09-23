# config.yaml is generated at startup by gen_config.py; no static config is shipped.
FROM ghcr.io/berriai/litellm:main-stable

COPY catalog.yaml /app/catalog.yaml
COPY gen_config.py /app/gen_config.py

# Port 4000 is fixed: the api.shadowrouter.ca custom domain targets it.
# Secrets (provider keys, DATABASE_URL, REDIS_*, LITELLM_MASTER_KEY, MARKUP) come from Railway Variables.
ENTRYPOINT ["sh", "-c", "python /app/gen_config.py /app/config.yaml && exec litellm --config /app/config.yaml --port 4000"]
