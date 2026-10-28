@echo off
echo =====================================================================
echo  TradersDesk - Google Cloud Run Automated Deployment
echo =====================================================================
echo.

:: 1. Check gcloud CLI
where gcloud >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Google Cloud SDK (gcloud) is not installed or not in PATH.
    echo Please install it from: https://cloud.google.com/sdk/docs/install
    pause
    exit /b 1
)

:: 2. Set Project & Region
set SERVICE_NAME=tradersdesk
set REGION=asia-south1

echo [INFO] Deploying container directly to Google Cloud Run...
echo Service: %SERVICE_NAME%
echo Region:  %REGION%
echo.

gcloud run deploy %SERVICE_NAME% ^
    --source . ^
    --region %REGION% ^
    --platform managed ^
    --allow-unauthenticated ^
    --memory 1Gi ^
    --cpu 1 ^
    --min-instances 0 ^
    --max-instances 4

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =====================================================================
    echo [SUCCESS] TradersDesk is LIVE on Google Cloud!
    echo Manage everything from your secret Admin Console: /admin.html
    echo =====================================================================
) else (
    echo.
    echo [ERROR] Deployment encountered an error. Check gcloud output above.
)
pause
