#!/bin/bash
# post-deploy.sh - Post-deployment notification script
# Runs after successful deployment

set -e

echo "=============================================="
echo "REZ Marketing - Post-Deploy Notification"
echo "=============================================="

# Get deployment info
DEPLOYMENT_ID=${RENDER_DEPLOYMENT_ID:-"unknown"}
SERVICE_NAME=${RENDER_SERVICE_NAME:-"rez-marketing"}
DEPLOY_HOOK_URL=${RENDER_DEPLOY_HOOK_URL:-""}

# Log deployment completion
echo "Deployment completed successfully!"
echo "  Service: $SERVICE_NAME"
echo "  Deployment ID: $DEPLOYMENT_ID"
echo "  Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# Send deployment notification to webhook (optional)
if [ -n "$DEPLOY_HOOK_URL" ]; then
    curl -s -X POST "$DEPLOY_HOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"service\": \"$SERVICE_NAME\", \"status\": \"deployed\", \"deployment_id\": \"$DEPLOYMENT_ID\"}" \
        || echo "Warning: Failed to send deployment notification"
fi

# Health check after deployment
HEALTH_URL=${HEALTH_URL:-"http://localhost:10000/healthz"}
MAX_RETRIES=5
RETRY_DELAY=5

echo "Performing health check..."
for i in $(seq 1 $MAX_RETRIES); do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        echo "  Health check PASSED"
        exit 0
    fi
    echo "  Attempt $i/$MAX_RETRIES failed, retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
done

echo "WARNING: Health check did not pass within timeout"
echo "Service may still be starting up"
exit 0
