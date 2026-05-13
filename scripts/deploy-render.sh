#!/bin/bash
# Owner Service Render Deployment Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$SCRIPT_DIR/rez-owner-service"

echo "🚀 REZ Owner Service - Render Deployment"
echo "=========================================="

# Check if render CLI is installed
if ! command -v render &> /dev/null; then
    echo "❌ Render CLI not found. Installing..."
    npm install -g @render/resrender
    # Actually let's use the proper package
    npm install -g render-cli
fi

cd "$SERVICE_DIR"

echo ""
echo "📝 Required Environment Variables:"
echo "----------------------------------"
read -p "CORS_ORIGIN (e.g., https://ad-bazaar.vercel.app): " CORS_ORIGIN
read -p "JWT_SECRET (generate with: openssl rand -hex 32): " JWT_SECRET
read -p "REDIS_URL (e.g., redis://localhost:6379 or Upstash URL): " REDIS_URL
read -p "PORT (default 10000): " PORT

PORT=${PORT:-10000}

echo ""
echo "🔧 Creating .env file..."
cat > .env << EOF
NODE_ENV=production
PORT=$PORT
CORS_ORIGIN=$CORS_ORIGIN
JWT_SECRET=$JWT_SECRET
REDIS_URL=$REDIS_URL
EOF

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔨 Building..."
npm run build

echo ""
echo "=========================================="
echo "Manual Steps Required:"
echo "=========================================="
echo ""
echo "1. Go to https://dashboard.render.com/blueprints"
echo ""
echo "2. Click 'New +' → 'Connect a repository'"
echo ""
echo "3. Select this GitHub repo: imrejaul007/REZ-Media"
echo ""
echo "4. Select the rez-owner-service/render.yaml file"
echo ""
echo "5. Configure environment variables:"
echo "   - NODE_ENV = production"
echo "   - PORT = $PORT"
echo "   - CORS_ORIGIN = $CORS_ORIGIN"
echo "   - JWT_SECRET = (use the one from .env)"
echo "   - REDIS_URL = $REDIS_URL"
echo ""
echo "6. Create the blueprint"
echo ""
echo "=========================================="
echo "GitHub Actions Setup:"
echo "=========================================="
echo ""
echo "1. Go to https://dashboard.render.com/user/settings → API Keys"
echo "2. Create new API key"
echo "3. Add to GitHub repo secrets: RENDER_DEPLOY_TOKEN"
echo "4. Get Service ID from Render dashboard → Service → Settings"
echo "5. Add to GitHub repo variables: RENDER_OWNER_SERVICE_ID"
echo ""
echo "✅ Files prepared at: $SERVICE_DIR"
