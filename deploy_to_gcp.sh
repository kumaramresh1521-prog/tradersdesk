#!/bin/bash
set -e

echo "=========================================================="
echo "🚀 Deploying Breadth Lab to Google Cloud Run"
echo "=========================================================="

SERVICE_NAME="tradersdesk"
REGION="asia-south1"
PROJECT_ID="trading-509214"

# 1. Collect global broker & platform environment variables from local .env if present
if [ -f ".env" ]; then
    echo "📋 Found local .env file! Packing broker credentials & platform settings into Cloud Run..."
    ENV_VARS_LIST=$(python3 pack_deploy_env.py "${PROJECT_ID}" 2>/dev/null || python pack_deploy_env.py "${PROJECT_ID}")
    echo "✅ Global broker credentials successfully prepared for Cloud Run deployment!"
else
    echo "ℹ️ No .env file found in $(pwd)."
    echo "   Tip: If you have broker credentials, save them in .env before deploying so Cloud Run stays configured globally."
    ENV_VARS_LIST="GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
fi

echo "Starting Cloud Run build and deploy (this normally takes 2–4 minutes)..."

gcloud run deploy "${SERVICE_NAME}" \
  --project ${PROJECT_ID} \
  --source . \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8000 \
  --memory 1Gi \
  --cpu 1 \
  --cpu-throttling \
  --min-instances 1 \
  --max-instances 10 \
  --concurrency 80 \
  --update-env-vars "${ENV_VARS_LIST}" \
  --quiet

echo ""
echo "=========================================================="
echo "✅ Deployment completed successfully!"
echo "🌐 Global Server Broker: Persistent across all reboots & devices"
echo "Public URL: https://tradersdesk.in"
echo "=========================================================="
