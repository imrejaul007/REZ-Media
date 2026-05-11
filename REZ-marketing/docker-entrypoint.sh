#!/bin/sh
# docker-entrypoint.sh - Production startup script for REZ Marketing Service
# Validates required environment variables before starting the application

set -e

echo "[Entry] Starting rez-marketing-service..."

# Validate required environment variables
required_vars="MONGODB_URI REDIS_URL"
missing_vars=""

for var in $required_vars; do
    if [ -z "${!var}" ]; then
        missing_vars="$missing_vars $var"
    fi
done

if [ -n "$missing_vars" ]; then
    echo "[Entry] ERROR: Missing required environment variables:$missing_vars"
    echo "[Entry] Set these variables before starting the container"
    exit 1
fi

# Validate MongoDB URI format
if ! echo "$MONGODB_URI" | grep -qE '^mongodb(\+srv)?://'; then
    echo "[Entry] ERROR: MONGODB_URI must be a valid MongoDB connection string"
    exit 1
fi

# Validate Redis URL format
if ! echo "$REDIS_URL" | grep -qE '^redis(s)?://'; then
    echo "[Entry] ERROR: REDIS_URL must be a valid Redis connection string"
    exit 1
fi

# Ensure internal service tokens are configured
if [ -z "$INTERNAL_SERVICE_TOKENS_JSON" ] && [ -z "$INTERNAL_SERVICE_TOKEN" ]; then
    echo "[Entry] WARNING: No internal service tokens configured. Service-to-service auth disabled."
fi

echo "[Entry] Environment validation complete"
echo "[Entry] Starting application..."

exec "$@"
