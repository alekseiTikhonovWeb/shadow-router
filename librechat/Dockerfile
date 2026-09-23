# LibreChat on Railway (service Root Directory = librechat): official image + our config + branding.
FROM ghcr.io/danny-avila/librechat:latest

COPY librechat.yaml /app/librechat.yaml
ENV CONFIG_PATH=/app/librechat.yaml

# Logo copied to both public and dist: the served path depends on the image version.
COPY assets/logo.svg /app/client/public/assets/logo.svg
COPY assets/logo.svg /app/client/dist/assets/logo.svg

# $PORT, MONGO_URI, OPENID_* and the branding vars come from Railway Variables.
