#!/bin/bash
# Deploy New REZ-Media Services
# Usage: ./deploy-new-services.sh

echo "=========================================="
echo "REZ-Media - Deploy New Services"
echo "=========================================="

SERVICES=(
  "rez-shopify-connector"
  "reks-whatsapp-commerce"
  "REZ-ai-campaign-builder"
  "REZ-discovery-platform"
  "REZ-engagement-platform"
  "REZ-pricing-engine"
  "REZ-journey-service"
)

echo ""
echo "Services to deploy: ${#SERVICES[@]}"
echo ""

for svc in "${SERVICES[@]}"; do
  echo "----------------------------------------"
  echo "📦 $svc"
  echo "----------------------------------------"

  if [ -d "$svc" ]; then
    test -f "$svc/package.json" && echo "  ✅ package.json"
    test -f "$svc/src/index.ts" && echo "  ✅ source"
    test -f "$svc/render.yaml" && echo "  ✅ render.yaml"

    echo ""
    echo "  🌐 Deploy: https://dashboard.render.com"
    echo "  📂 GitHub: github.com/imrejaul007/REZ-Media"
  else
    echo "  ❌ Not found"
  fi
done

echo ""
echo "=========================================="
echo "After deploy, update .env with URLs"
echo "=========================================="
