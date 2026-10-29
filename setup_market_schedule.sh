#!/bin/bash
set -e

echo "====================================================================="
echo " TradersDesk - Google Cloud Run Market-Hours Auto-Scheduler Setup"
echo "====================================================================="
echo ""
echo "This script sets up Google Cloud Scheduler to automatically manage"
echo "Cloud Run instances for maximum cost optimization:"
echo ""
echo "  [1] Mon-Fri at 09:00 AM IST: Sets min-instances = 1 (Always Warm for live ticks)"
echo "  [2] Mon-Fri at 03:45 PM IST: Sets min-instances = 0 (Scales to 0 for nights/weekends)"
echo ""
echo "Estimated Cloud Savings: ~81% compared to running 24/7!"
echo "====================================================================="
echo ""

PROJECT_ID="trading-509214"
REGION="asia-south1"
SERVICE_NAME="tradersdesk"

if ! command -v gcloud &> /dev/null; then
    echo "[ERROR] Google Cloud SDK (gcloud) is not installed."
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "[1/5] Setting gcloud project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID" --quiet

echo ""
echo "[2/5] Enabling Cloud Scheduler & Cloud Run APIs..."
gcloud services enable cloudscheduler.googleapis.com run.googleapis.com --quiet

echo ""
echo "[3/5] Retrieving default Compute service account..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "Service Account: $SERVICE_ACCOUNT"

echo ""
echo "Granting Cloud Run Admin role to Service Account..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/run.admin" \
    --condition=None --quiet >/dev/null 2>&1 || true

echo ""
echo "[4/5] Creating / Updating Market-Start Job (09:00 AM IST, Mon-Fri)..."
gcloud scheduler jobs delete tradersdesk-market-start --location="$REGION" --quiet >/dev/null 2>&1 || true
gcloud scheduler jobs create http tradersdesk-market-start \
    --location="$REGION" \
    --schedule="0 9 * * 1-5" \
    --time-zone="Asia/Kolkata" \
    --description="TradersDesk: Auto-wake Cloud Run at 9:00 AM IST for Market Open" \
    --uri="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services/${SERVICE_NAME}?updateMask=template.scaling.minInstanceCount" \
    --http-method=PATCH \
    --headers="Content-Type=application/json" \
    --message-body='{"template":{"scaling":{"minInstanceCount":1}}}' \
    --oauth-service-account-email="${SERVICE_ACCOUNT}" \
    --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform"

echo ""
echo "[5/5] Creating / Updating Market-Stop Job (03:45 PM IST, Mon-Fri)..."
gcloud scheduler jobs delete tradersdesk-market-stop --location="$REGION" --quiet >/dev/null 2>&1 || true
gcloud scheduler jobs create http tradersdesk-market-stop \
    --location="$REGION" \
    --schedule="45 15 * * 1-5" \
    --time-zone="Asia/Kolkata" \
    --description="TradersDesk: Auto-sleep Cloud Run at 3:45 PM IST for Market Close" \
    --uri="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services/${SERVICE_NAME}?updateMask=template.scaling.minInstanceCount" \
    --http-method=PATCH \
    --headers="Content-Type=application/json" \
    --message-body='{"template":{"scaling":{"minInstanceCount":0}}}' \
    --oauth-service-account-email="${SERVICE_ACCOUNT}" \
    --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform"

echo ""
echo "====================================================================="
echo "[SUCCESS] Market-Hours Cloud Scheduler is active!"
echo ""
echo "Active Jobs in $REGION:"
gcloud scheduler jobs list --location="$REGION"
echo ""
echo "Cloud Run will now be warm between 09:00 AM and 03:45 PM IST Mon-Fri,"
echo "and sleep automatically during nights and weekends to save ~81% cost."
echo "====================================================================="
