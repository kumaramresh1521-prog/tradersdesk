@echo off
echo ==========================================================
echo  Deploying Breadth Lab to Google Cloud Run
echo ==========================================================

set SERVICE_NAME=tradersdesk
set REGION=asia-south1
set PROJECT_ID=trading-509214

echo Building and deploying to region: %REGION%...

gcloud run deploy %SERVICE_NAME% --project %PROJECT_ID% --source . --region %REGION% --allow-unauthenticated --port 8000 --memory 1Gi --cpu 1 --cpu-throttling --min-instances 0 --max-instances 10 --concurrency 80

if %ERRORLEVEL% equ 0 (
    echo.
    echo Deployment completed successfully!
) else (
    echo.
    echo Deployment failed. Please check your gcloud authentication and project configuration.
)

pause
