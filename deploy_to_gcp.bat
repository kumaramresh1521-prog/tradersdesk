@echo off
echo ==========================================================
echo  Deploying TradersDesk.in to Google Cloud Run
echo ==========================================================

set SERVICE_NAME=tradersdesk
set REGION=asia-south1
set PROJECT_ID=trading-509214

echo Packing broker credentials from local .env if present...
set ENV_VARS_LIST=GOOGLE_CLOUD_PROJECT=%PROJECT_ID%
if exist .env (
    for /f "delims=" %%i in ('python pack_deploy_env.py %PROJECT_ID% 2^>nul') do set ENV_VARS_LIST=%%i
    echo Broker credentials packed into Cloud Run environment variables.
)

echo Building and deploying to region: %REGION%...
gcloud run deploy %SERVICE_NAME% --project %PROJECT_ID% --source . --region %REGION% --allow-unauthenticated --port 8000 --memory 1Gi --cpu 1 --cpu-throttling --min-instances 1 --max-instances 10 --concurrency 80 --update-env-vars "%ENV_VARS_LIST%" --quiet

if %ERRORLEVEL% equ 0 (
    echo.
    echo ==========================================================
    echo Deployment completed successfully!
    echo Global Server Broker: Persistent across all reboots and devices
    echo Public URL: https://tradersdesk.in
    echo ==========================================================
) else (
    echo.
    echo Deployment failed. Please check your gcloud authentication and project configuration.
)

pause
