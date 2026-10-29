@echo off
echo =====================================================================
echo  TradersDesk: Set Cloud Run to WARM (min-instances = 1)
echo =====================================================================
set PROJECT_ID=trading-509214
set REGION=asia-south1
set SERVICE_NAME=tradersdesk

echo Setting min-instances=1 on %SERVICE_NAME%...
call gcloud run services update %SERVICE_NAME% --project %PROJECT_ID% --region %REGION% --min-instances 1 --no-cpu-throttling --quiet
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Cloud Run is now WARM and actively recording ticks.
) else (
    echo [ERROR] Failed to update service. Check gcloud login.
)
pause
