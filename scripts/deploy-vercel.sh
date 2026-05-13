#!/bin/bash
# AdBazaar Vercel Deployment Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/apps/adbazaar"

echo "🚀 AdBazaar Vercel Deployment"
echo "================================"

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

cd "$APP_DIR"

# Check if already linked
if [ ! -f ".vercel/project.json ]; then
    echo "📌 Linking to Vercel project..."
    vercel link
fi

echo ""
echo "📝 Required Environment Variables:"
echo "----------------------------------"
read -p "NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL
read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_ANON
read -p "NEXT_PUBLIC_RAZORPAY_KEY_ID: " RAZORPAY_KEY
read -p "NEXT_PUBLIC_APP_URL (e.g., https://ad-bazaar.vercel.app): " APP_URL
read -p "RESEND_API_KEY: " RESEND_KEY
read -p "REZ_ADS_SERVICE_URL: " REZ_ADS_URL
read -p "REZ_WALLET_SERVICE_URL: " REZ_WALLET_URL
read -p "REZ_PAYMENT_SERVICE_URL: " REZ_PAYMENT_URL

echo ""
echo "📦 Setting environment variables..."

# Set production env vars
vercel env add NEXT_PUBLIC_SUPABASE_URL production <<< "$SUPABASE_URL"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production <<< "$SUPABASE_ANON"
vercel env add NEXT_PUBLIC_RAZORPAY_KEY_ID production <<< "$RAZORPAY_KEY"
vercel env add NEXT_PUBLIC_APP_URL production <<< "$APP_URL"
vercel env add RESEND_API_KEY production <<< "$RESEND_KEY"
vercel env add REZ_ADS_SERVICE_URL production <<< "$REZ_ADS_URL"
vercel env add REZ_WALLET_SERVICE_URL production <<< "$REZ_WALLET_URL"
vercel env add REZ_PAYMENT_SERVICE_URL production <<< "$REZ_PAYMENT_URL"

# Set development env vars (same values)
vercel env add NEXT_PUBLIC_SUPABASE_URL development <<< "$SUPABASE_URL"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development <<< "$SUPABASE_ANON"
vercel env add NEXT_PUBLIC_RAZORPAY_KEY_ID development <<< "$RAZORPAY_KEY"
vercel env add NEXT_PUBLIC_APP_URL development <<< "$APP_URL"
vercel env add RESEND_API_KEY development <<< "$RESEND_KEY"
vercel env add REZ_ADS_SERVICE_URL development <<< "$REZ_ADS_URL"
vercel env add REZ_WALLET_SERVICE_URL development <<< "$REZ_WALLET_URL"
vercel env add REZ_PAYMENT_SERVICE_URL development <<< "$REZ_PAYMENT_URL"

echo ""
echo "🔨 Building..."
npm install
npm run build

echo ""
read -p "Deploy to production now? (y/n): " DEPLOY
if [ "$DEPLOY" = "y" ]; then
    echo "🚀 Deploying to production..."
    vercel --prod
else
    echo "✅ Skipped. Run 'vercel --prod' when ready."
fi

echo ""
echo "================================"
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add GitHub secrets: VERCEL_TOKEN, VERCEL_ORG_ID"
echo "2. Add GitHub variable: VERCEL_ADBAZAAR_PROJECT_ID"
echo "3. Push to main to trigger auto-deploy"
