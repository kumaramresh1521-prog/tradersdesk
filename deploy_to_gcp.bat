@echo off
echo ==========================================================
echo  Deploying TradersDesk.in to Google Cloud Run
echo ==========================================================

set SERVICE_NAME=tradersdesk
set REGION=asia-south1
set PROJECT_ID=trading-509214
setlocal EnableDelayedExpansion
set SECRET_MAP=
set SECRET_CANDIDATES=ADMIN_SECRET_KEY=tradersdesk-admin-secret-key DATA_BROKER=tradersdesk-data-broker ANGEL_API_KEY=tradersdesk-angel-api-key ANGEL_CLIENT_CODE=tradersdesk-angel-client-code ANGEL_PIN=tradersdesk-angel-pin ANGEL_TOTP_SECRET=tradersdesk-angel-totp-secret ANGEL_TOTP_CODE=tradersdesk-angel-totp-code ANGEL_BASE_URL=tradersdesk-angel-base-url UPSTOX_ACCESS_TOKEN=tradersdesk-upstox-access-token UPSTOX_API_KEY=tradersdesk-upstox-api-key UPSTOX_API_SECRET=tradersdesk-upstox-api-secret UPSTOX_MOBILE=tradersdesk-upstox-mobile UPSTOX_PIN=tradersdesk-upstox-pin UPSTOX_TOTP_SECRET=tradersdesk-upstox-totp-secret UPSTOX_REDIRECT_URI=tradersdesk-upstox-redirect-uri KOTAK_ACCESS_TOKEN=tradersdesk-kotak-access-token KOTAK_CONSUMER_KEY=tradersdesk-kotak-consumer-key KOTAK_CONSUMER_SECRET=tradersdesk-kotak-consumer-secret KOTAK_UCC=tradersdesk-kotak-ucc KOTAK_MOBILE_NO=tradersdesk-kotak-mobile-no KOTAK_MPIN=tradersdesk-kotak-mpin KOTAK_TOTP_SECRET=tradersdesk-kotak-totp-secret KOTAK_VIEW_TOKEN=tradersdesk-kotak-view-token KOTAK_SID=tradersdesk-kotak-sid FYERS_APP_ID=tradersdesk-fyers-app-id FYERS_ACCESS_TOKEN=tradersdesk-fyers-access-token SUPABASE_URL=tradersdesk-supabase-url SUPABASE_ANON_KEY=tradersdesk-supabase-anon-key SUPABASE_SERVICE_ROLE_KEY=tradersdesk-supabase-service-role-key

echo Building and deploying to region: %REGION%...

for %%S in (%SECRET_CANDIDATES%) do (
  for /f "tokens=1,2 delims==" %%A in ("%%S") do (
    gcloud secrets describe %%B --project %PROJECT_ID% >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
      if defined SECRET_MAP (set SECRET_MAP=!SECRET_MAP!,)
      set SECRET_MAP=!SECRET_MAP!%%A=%%B:latest
    )
  )
)
if not defined SECRET_MAP (
  echo No Secret Manager values found. Run setup_cloud_secrets.ps1 first.
  exit /b 1
)
gcloud run deploy %SERVICE_NAME% --project %PROJECT_ID% --source . --region %REGION% --allow-unauthenticated --port 8000 --memory 1Gi --cpu 1 --cpu-throttling --min-instances 0 --max-instances 10 --concurrency 80 --set-env-vars GOOGLE_CLOUD_PROJECT=%PROJECT_ID% --update-secrets !SECRET_MAP!

if %ERRORLEVEL% equ 0 (
    echo.
    echo Deployment completed successfully!
) else (
    echo.
    echo Deployment failed. Please check your gcloud authentication and project configuration.
)

pause
