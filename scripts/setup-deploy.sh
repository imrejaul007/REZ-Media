#!/bin/bash
# Combined Deployment Setup Script

set -e

echo "========================================"
echo "  REZ Media - Deployment Setup"
echo "========================================"
echo ""
echo "This script will help you deploy:"
echo "  1. AdBazaar (Vercel) - Frontend"
echo "  2. Owner Service (Render) - Backend"
echo ""

read -p "Continue? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Cancelled."
    exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "========================================"
echo "Step 1: AdBazaar (Vercel)"
echo "========================================"
bash "$SCRIPT_DIR/deploy-vercel.sh"

echo ""
echo "========================================"
echo "Step 2: Owner Service (Render)"
echo "========================================"
bash "$SCRIPT_DIR/deploy-render.sh"

echo ""
echo "========================================"
echo "✅ Deployment Setup Complete!"
echo "========================================"
echo ""
echo "Summary:"
echo "--------"
echo "• AdBazaar: Deploy via Vercel dashboard or vercel --prod"
echo "• Owner Service: Deploy via Render Blueprints"
echo "• CI/CD: Push to main triggers auto-deploy"
echo ""
echo "Files created:"
echo "  - apps/adbazaar/vercel.json"
echo "  - rez-owner-service/render.yaml"
echo "  - scripts/deploy-*.sh"
echo "  - apps/adbazaar/DEPLOY.md"
