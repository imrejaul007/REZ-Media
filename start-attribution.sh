#!/bin/bash
# REZ Attribution System - Start All Services

set -e

echo "=============================================="
echo "REZ Attribution System - Starting All Services"
echo "=============================================="

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to start a service
start_service() {
    local name=$1
    local dir=$2
    local port=$3

    echo -e "${GREEN}Starting $name (Port $port)...${NC}"

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}$name already running on port $port${NC}"
    else
        cd "$dir" 2>/dev/null && npm start &
        sleep 1
        echo -e "${GREEN}$name started${NC}"
    fi
}

# Start all attribution services
BASE="/Users/rejaulkarim/Documents/ReZ Full App"

start_service "REZ-attribution-hub" "$BASE/REZ-Media/REZ-attribution-hub" 4100
start_service "REZ-identity-graph" "$BASE/REZ-Media/REZ-identity-graph" 4065
start_service "REZ-meta-capi" "$BASE/REZ-Media/REZ-meta-capi" 4080
start_service "REZ-google-enhanced" "$BASE/REZ-Media/REZ-google-enhanced" 4085
start_service "REZ-tiktok-events" "$BASE/REZ-Media/REZ-tiktok-events" 4086
start_service "REZ-cross-device" "$BASE/REZ-Media/REZ-cross-device" 4068
start_service "REZ-ltv-attribution" "$BASE/REZ-Intelligence/REZ-ltv-attribution" 4090

echo ""
echo "=============================================="
echo -e "${GREEN}All services started!"
echo "=============================================="
echo ""
echo "Hub Health: http://localhost:4100/health"
echo "Test Event: curl -X POST http://localhost:4100/api/events \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"eventName\":\"Purchase\",\"merchantId\":\"test\",\"sessionId\":\"sess_1\",\"value\":999}'"
echo ""
echo "Stop all: pkill -f 'node dist/index.js'"
echo "=============================================="
