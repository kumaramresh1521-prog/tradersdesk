#!/usr/bin/env bash
set -e
set -o pipefail

echo "=========================================================="
echo "🚀 Deploying TradersDesk.in to Google Cloud Run"
echo "=========================================================="

SERVICE_NAME="tradersdesk"
REGION="asia-south1"
PROJECT_ID="trading-509214"
SECRET_CANDIDATES=(
  "ADMIN_SECRET_KEY=tradersdesk-admin-secret-key" "DATA_BROKER=tradersdesk-data-broker"
  "ANGEL_API_KEY=tradersdesk-angel-api-key" "ANGEL_CLIENT_CODE=tradersdesk-angel-client-code" "ANGEL_PIN=tradersdesk-angel-pin" "ANGEL_TOTP_SECRET=tradersdesk-angel-totp-secret" "ANGEL_TOTP_CODE=tradersdesk-angel-totp-code" "ANGEL_BASE_URL=tradersdesk-angel-base-url"
  "UPSTOX_ACCESS_TOKEN=tradersdesk-upstox-access-token" "UPSTOX_API_KEY=tradersdesk-upstox-api-key" "UPSTOX_API_SECRET=tradersdesk-upstox-api-secret" "UPSTOX_MOBILE=tradersdesk-upstox-mobile" "UPSTOX_PIN=tradersdesk-upstox-pin" "UPSTOX_TOTP_SECRET=tradersdesk-upstox-totp-secret" "UPSTOX_REDIRECT_URI=tradersdesk-upstox-redirect-uri"
  "KOTAK_ACCESS_TOKEN=tradersdesk-kotak-access-token" "KOTAK_CONSUMER_KEY=tradersdesk-kotak-consumer-key" "KOTAK_CONSUMER_SECRET=tradersdesk-kotak-consumer-secret" "KOTAK_UCC=tradersdesk-kotak-ucc" "KOTAK_MOBILE_NO=tradersdesk-kotak-mobile-no" "KOTAK_MPIN=tradersdesk-kotak-mpin" "KOTAK_TOTP_SECRET=tradersdesk-kotak-totp-secret" "KOTAK_VIEW_TOKEN=tradersdesk-kotak-view-token" "KOTAK_SID=tradersdesk-kotak-sid"
  "FYERS_APP_ID=tradersdesk-fyers-app-id" "FYERS_ACCESS_TOKEN=tradersdesk-fyers-access-token"
  "SUPABASE_URL=tradersdesk-supabase-url" "SUPABASE_ANON_KEY=tradersdesk-supabase-anon-key" "SUPABASE_SERVICE_ROLE_KEY=tradersdesk-supabase-service-role-key"
)
SECRET_MAP=""
echo "Checking Secret Manager configuration (one request)..."
if ! AVAILABLE_SECRETS="$(gcloud secrets list --project "${PROJECT_ID}" --format='value(name)' 2>&1)"; then
  echo "ERROR: Could not read Secret Manager. Run: gcloud auth login"
  echo "Details: ${AVAILABLE_SECRETS}"
  exit 1
fi

for pair in "${SECRET_CANDIDATES[@]}"; do
  env_name="${pair%%=*}"
  secret_name="${pair#*=}"
  if printf '%s\n' "${AVAILABLE_SECRETS}" | grep -Fxq "${secret_name}"; then
    [[ -n "${SECRET_MAP}" ]] && SECRET_MAP+=","
    SECRET_MAP+="${env_name}=${secret_name}:latest"
  fi
done
if [[ -z "${SECRET_MAP}" ]]; then
  echo "No Secret Manager values found. Run setup_cloud_secrets.ps1 first."
  exit 1
fi

SECRET_COUNT=$(tr ',' '\n' <<< "${SECRET_MAP}" | wc -l | tr -d ' ')
echo "Found ${SECRET_COUNT} configured secret(s)."
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
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
  --update-secrets "${SECRET_MAP}" \
  --quiet

echo ""
echo "✅ Deployment completed successfully!"
echo "Service URL: $(gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')"
