#!/bin/bash
set -e

echo "====================================================================="
echo " TradersDesk - Google Cloud Run Automated Deployment"
echo "====================================================================="
echo ""

if ! command -v gcloud &> /dev/null; then
    echo "[ERROR] Google Cloud SDK (gcloud) is not installed."
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

SERVICE_NAME="tradersdesk"
REGION="asia-south1"

echo "[INFO] Deploying container directly to Google Cloud Run..."
echo "Service: $SERVICE_NAME"
echo "Region:  $REGION"
echo ""

gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 4

echo ""
echo "====================================================================="
echo "[SUCCESS] TradersDesk is LIVE on Google Cloud!"
echo "Manage everything from your secret Admin Console: /admin.html"
echo "====================================================================="
