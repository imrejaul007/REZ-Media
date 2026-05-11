#!/bin/bash
# =============================================================================
# REZ-Media Deployment Script
# Deploys all advertising and marketing services to Render
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER_API_KEY="${RENDER_API_KEY:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${SCRIPT_DIR}/logs/deploy-rez-media_${TIMESTAMP}.log"

# Advertising services
AD_SERVICES=(
    "REZ-ads-service"
    "REZ-ad-campaigns"
    "REZ-ad-ai"
    "REZ-abandonment-tracker"
    "REZ-decision-service"
)

# Marketing services
MARKETING_SERVICES=(
    "REZ-marketing"
    "REZ-marketing-backend"
    "REZ-lead-intelligence"
    "REZ-discovery-platform"
    "REZ-gamification-service"
    "REZ-communications-platform"
    "REZ-economic-engine"
)

# Media services
MEDIA_SERVICES=(
    "REZ-media-events"
    "rez-automation-service"
    "REZ-feedback-service"
    "rez-dooh-service"
)

# Nested marketing backend services
NESTED_SERVICES=(
    "REZ-marketing-backend/services/decision-service"
    "REZ-marketing-backend/services/unified-messaging"
    "REZ-marketing-backend/services/lead-intelligence"
    "REZ-marketing-backend/services/ads-service"
    "REZ-marketing-backend/services/marketing-service"
    "REZ-marketing-backend/services/abandonment-tracker"
)

ALL_SERVICES=("${AD_SERVICES[@]}" "${MARKETING_SERVICES[@]}" "${MEDIA_SERVICES[@]}" "${NESTED_SERVICES[@]}")

# Counters
SUCCESS_COUNT=0
FAILED_COUNT=0
SKIP_COUNT=0

# =============================================================================
# Helper Functions
# =============================================================================

log() {
    local level="$1"
    local message="$2"
    echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_success() {
    log "${GREEN}SUCCESS${NC}" "$1"
}

log_error() {
    log "${RED}ERROR${NC}" "$1"
}

log_warning() {
    log "${YELLOW}WARNING${NC}" "$1"
}

log_info() {
    log "${BLUE}INFO${NC}" "$1"
}

log_header() {
    echo ""
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}============================================================================${NC}"
    echo ""
}

# =============================================================================
# Deployment Functions
# =============================================================================

deploy_service() {
    local service_path="$1"
    local service_name=$(basename "$service_path")
    local dir="${SCRIPT_DIR}/${service_path}"
    local render_yaml="${dir}/render.yaml"

    log_info "Processing: ${service_name}"

    if [ ! -d "$dir" ]; then
        log_warning "Directory not found: $dir"
        ((SKIP_COUNT++))
        return 1
    fi

    if [ ! -f "$render_yaml" ]; then
        log_warning "No render.yaml found in ${service_path}, skipping"
        ((SKIP_COUNT++))
        return 1
    fi

    # Check if Render CLI is available
    if command -v render &> /dev/null; then
        log_info "Deploying ${service_name} using Render CLI..."
        if render deploy --spec "$render_yaml" --service-type=web 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Deployed: ${service_name}"
            ((SUCCESS_COUNT++))
            return 0
        else
            log_error "Failed to deploy: ${service_name}"
            ((FAILED_COUNT++))
            return 1
        fi
    else
        # Fallback: Use Render API via curl
        log_info "Using Render API for ${service_name}..."
        if deploy_via_api "$service_name" "$dir"; then
            log_success "Deployed: ${service_name}"
            ((SUCCESS_COUNT++))
            return 0
        else
            log_error "Failed to deploy: ${service_name}"
            ((FAILED_COUNT++))
            return 1
        fi
    fi
}

deploy_via_api() {
    local service_name="$1"
    local dir="$2"
    local blueprint_file="${dir}/render.yaml"

    if [ -z "$RENDER_API_KEY" ]; then
        log_warning "RENDER_API_KEY not set, cannot deploy via API"
        return 1
    fi

    # Create blueprint on Render
    local response=$(curl -s -X POST "https://api.render.com/v1/blueprints" \
        -H "Authorization: Bearer ${RENDER_API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"repo\": \"https://github.com/your-org/${service_name}\", \"spec\": \"$(cat "$blueprint_file" | base64)\"}")

    if echo "$response" | grep -q "\"id\""; then
        return 0
    else
        log_error "API response: $response"
        return 1
    fi
}

# =============================================================================
# Pre-deployment Checks
# =============================================================================

check_prerequisites() {
    log_header "REZ-MEDIA PRE-DEPLOYMENT CHECKS"

    mkdir -p "${SCRIPT_DIR}/logs"

    # Check curl
    if ! command -v curl &> /dev/null; then
        log_error "curl is required"
        exit 1
    fi

    # Check Render CLI or API key
    if ! command -v render &> /dev/null && [ -z "$RENDER_API_KEY" ]; then
        log_warning "Neither Render CLI nor RENDER_API_KEY available"
        log_info "Install CLI: brew install render"
        log_info "Or set: export RENDER_API_KEY=your_key"
    fi

    log_success "Prerequisites checked"
}

# =============================================================================
# Main Deployment
# =============================================================================

main() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                     REZ-MEDIA DEPLOYMENT                        ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    check_prerequisites

    local total_services=${#ALL_SERVICES[@]}
    local current=0

    log_header "DEPLOYING ${total_services} MEDIA/ADVERTISING SERVICES"

    for service in "${ALL_SERVICES[@]}"; do
        ((current++))
        echo -e "\n${YELLOW}[${current}/${total_services}]${NC}"
        deploy_service "$service" || true
    done

    # Print summary
    log_header "DEPLOYMENT SUMMARY - REZ-MEDIA"

    echo -e "${GREEN}Successful: ${SUCCESS_COUNT}${NC}"
    echo -e "${RED}Failed: ${FAILED_COUNT}${NC}"
    echo -e "${YELLOW}Skipped: ${SKIP_COUNT}${NC}"
    echo ""

    if [ $FAILED_COUNT -eq 0 ]; then
        log_success "All REZ-Media services deployed successfully!"
    else
        log_error "${FAILED_COUNT} service(s) failed to deploy"
    fi

    log_info "Full log: ${LOG_FILE}"
}

# Entry point
main "$@"
