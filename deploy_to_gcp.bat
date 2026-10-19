@echo off
echo ==========================================================
echo  Deploying TradersDesk.in to Google Cloud Run
echo ==========================================================

set SERVICE_NAME=tradersdesk
set REGION=asia-south1
set PROJECT_ID=trading-509214
echo Preserving existing Cloud Run secret bindings.
echo Building and deploying to region: %REGION%...
gcloud run deploy %SERVICE_NAME% --project %PROJECT_ID% --source . --region %REGION% --allow-unauthenticated --port 8000 --memory 1Gi --cpu 1 --cpu-throttling --min-instances 0 --max-instances 10 --concurrency 80 --update-env-vars GOOGLE_CLOUD_PROJECT=%PROJECT_ID% --quiet

if %ERRORLEVEL% equ 0 (
    echo.
    echo Deployment completed successfully!
    echo Public URL: https://tradersdesk.in
) else (
    echo.
    echo Deployment failed. Please check your gcloud authentication and project configuration.
)

pause
