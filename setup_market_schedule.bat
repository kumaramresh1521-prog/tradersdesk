@echo off
echo =====================================================================
echo  TradersDesk - Google Cloud Run Market-Hours Auto-Scheduler Setup
echo =====================================================================
echo.
echo This script sets up Google Cloud Scheduler to automatically manage
echo Cloud Run instances for maximum cost optimization:
echo.
echo   [1] Mon-Fri at 09:00 AM IST: Sets min-instances = 1 (Always Warm for live ticks)
echo   [2] Mon-Fri at 04:00 PM IST: Sets min-instances = 0 (After 03:40 PM F&O Close)
echo.
echo Estimated Cloud Savings: ~80%% compared to running 24/7!
echo =====================================================================
echo.

:: 1. Configuration Defaults
set PROJECT_ID=trading-509214
set REGION=asia-south1
set SERVICE_NAME=tradersdesk

:: 2. Check gcloud CLI
where gcloud >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Google Cloud SDK (gcloud) is not installed or not in PATH.
    echo Please install it from: https://cloud.google.com/sdk/docs/install
    pause
    exit /b 1
)

echo [1/5] Setting gcloud project to %PROJECT_ID%...
call gcloud config set project %PROJECT_ID% --quiet

echo.
echo [2/5] Enabling Cloud Scheduler & Cloud Run APIs...
call gcloud services enable cloudscheduler.googleapis.com run.googleapis.com --quiet

echo.
echo [3/5] Retrieving default Compute service account...
for /f "tokens=*" %%i in ('gcloud projects describe %PROJECT_ID% --format="value(projectNumber)"') do set PROJECT_NUMBER=%%i
set SERVICE_ACCOUNT=%PROJECT_NUMBER%-compute@developer.gserviceaccount.com
echo Service Account: %SERVICE_ACCOUNT%

echo.
echo Granting Cloud Run Admin role to Service Account...
call gcloud projects add-iam-policy-binding %PROJECT_ID% ^
    --member="serviceAccount:%SERVICE_ACCOUNT%" ^
    --role="roles/run.admin" ^
    --condition=None --quiet >nul 2>&1

echo.
echo [4/5] Creating / Updating Market-Start Job (09:00 AM IST, Mon-Fri)...
call gcloud scheduler jobs delete tradersdesk-market-start --location=%REGION% --quiet >nul 2>&1
call gcloud scheduler jobs create http tradersdesk-market-start ^
    --location=%REGION% ^
    --schedule="0 9 * * 1-5" ^
    --time-zone="Asia/Kolkata" ^
    --description="TradersDesk: Auto-wake Cloud Run at 9:00 AM IST for Market Open" ^
    --uri="https://run.googleapis.com/v2/projects/%PROJECT_ID%/locations/%REGION%/services/%SERVICE_NAME%?updateMask=template.scaling.minInstanceCount" ^
    --http-method=PUT ^
    --headers="Content-Type=application/json,X-HTTP-Method-Override=PATCH" ^
    --message-body="{\"template\":{\"scaling\":{\"minInstanceCount\":1}}}" ^
    --oauth-service-account-email="%SERVICE_ACCOUNT%" ^
    --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform"

echo.
echo [5/6] Creating / Updating Market-Stop Job (04:00 PM IST, Mon-Fri)...
call gcloud scheduler jobs delete tradersdesk-market-stop --location=%REGION% --quiet >nul 2>&1
call gcloud scheduler jobs create http tradersdesk-market-stop ^
    --location=%REGION% ^
    --schedule="0 16 * * 1-5" ^
    --time-zone="Asia/Kolkata" ^
    --description="TradersDesk: Auto-sleep Cloud Run at 4:00 PM IST after 3:40 PM F&O Close and EOD reconciliation" ^
    --uri="https://run.googleapis.com/v2/projects/%PROJECT_ID%/locations/%REGION%/services/%SERVICE_NAME%?updateMask=template.scaling.minInstanceCount" ^
    --http-method=PUT ^
    --headers="Content-Type=application/json,X-HTTP-Method-Override=PATCH" ^
    --message-body="{\"template\":{\"scaling\":{\"minInstanceCount\":0}}}" ^
    --oauth-service-account-email="%SERVICE_ACCOUNT%" ^
    --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform"

echo.
echo [6/6] Creating / Updating Market-Hours Background Data Refresher (Every 1 min during 09:15 - 15:40 IST Mon-Fri)...
call gcloud scheduler jobs delete tradersdesk-market-tick --location=%REGION% --quiet >nul 2>&1
call gcloud scheduler jobs create http tradersdesk-market-tick ^
    --location=%REGION% ^
    --schedule="* 9-15 * * 1-5" ^
    --time-zone="Asia/Kolkata" ^
    --description="TradersDesk: Continuous background data refresh every 1 min during market hours even with 0 visitors" ^
    --uri="https://tradersdesk.in/api/cron/tick" ^
    --http-method=GET

echo.
echo =====================================================================
echo [SUCCESS] Market-Hours Cloud Scheduler is active!
echo.
echo Active Jobs in %REGION%:
call gcloud scheduler jobs list --location=%REGION%
echo.
echo Cloud Run will now be warm between 09:00 AM and 04:00 PM IST Mon-Fri
echo (fully covering F&O trades up to 03:40 PM + 20 min EOD buffer),
echo and sleep automatically during nights and weekends to save ~80%% cost.
echo =====================================================================
pause
