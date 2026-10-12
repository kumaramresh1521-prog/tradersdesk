#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "🚀 Deploying Breadth Lab to Google Cloud Run"
echo "=========================================================="

SERVICE_NAME="tradersdesk"
REGION="asia-south1"
PROJECT_ID="trading-509214"

echo "Building and deploying to project: ${PROJECT_ID}, region: ${REGION}..."

gcloud run deploy ${SERVICE_NAME} \
  --project ${PROJECT_ID} \
  --source . \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8000 \
  --memory 1Gi \
  --cpu 1 \
  --cpu-throttling \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --set-env-vars ADMIN_SECRET_KEY=9771897535

echo ""
echo "✅ Deployment completed successfully!"
