#!/usr/bin/env bash
set -e
set -o pipefail

echo "=========================================================="
echo "🚀 Deploying TradersDesk.in to Google Cloud Run"
echo "=========================================================="

SERVICE_NAME="tradersdesk"
REGION="asia-south1"
PROJECT_ID="trading-509214"
# Do not query Secret Manager at deploy time.  Cloud Run keeps the service's
# existing secret bindings when --update-secrets/--set-secrets is omitted.
# This avoids a deployment being blocked by a Secret Manager list permission
# or API issue, while keeping broker credentials outside the source tree.
echo "Preserving the existing Cloud Run secret bindings."
echo "Starting Cloud Run build and deploy (this normally takes 2–5 minutes)..."

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
  --update-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
  --quiet

echo ""
echo "✅ Deployment completed successfully!"
echo "Public URL: https://tradersdesk.in"
