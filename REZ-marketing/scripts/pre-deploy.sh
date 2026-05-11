#!/bin/bash
# pre-deploy.sh - Pre-deployment validation script
# Runs before each Render deployment

set -e

echo "=============================================="
echo "REZ Marketing - Pre-Deploy Validation"
echo "=============================================="

# Check required environment variables
REQUIRED_VARS=("MONGODB_URI" "REDIS_URL" "INTERNAL_SERVICE_TOKENS_JSON")

echo "Checking required environment variables..."
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "ERROR: $var is not set"
        exit 1
    fi
    echo "  $var: OK"
done

# Validate MongoDB URI format
echo "Validating MongoDB URI..."
if ! echo "$MONGODB_URI" | grep -qE '^mongodb(\+srv)?://'; then
    echo "ERROR: Invalid MONGODB_URI format"
    exit 1
fi
echo "  MONGODB_URI: Valid"

# Validate Redis URL format
echo "Validating Redis URL..."
if ! echo "$REDIS_URL" | grep -qE '^redis(s)?://'; then
    echo "ERROR: Invalid REDIS_URL format"
    exit 1
fi
echo "  REDIS_URL: Valid"

# Check internal service tokens JSON is valid
echo "Validating INTERNAL_SERVICE_TOKENS_JSON..."
if ! echo "$INTERNAL_SERVICE_TOKENS_JSON" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
    echo "ERROR: Invalid INTERNAL_SERVICE_TOKENS_JSON - must be valid JSON"
    exit 1
fi
echo "  INTERNAL_SERVICE_TOKENS_JSON: Valid JSON"

echo ""
echo "=============================================="
echo "Pre-deploy validation PASSED"
echo "=============================================="
