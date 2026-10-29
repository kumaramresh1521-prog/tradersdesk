@echo off
echo =====================================================================
echo  TradersDesk: Set Cloud Run to SLEEP (min-instances = 0)
echo =====================================================================
set PROJECT_ID=trading-509214
set REGION=asia-south1
set SERVICE_NAME=tradersdesk

echo Setting min-instances=0 on %SERVICE_NAME%...
call gcloud run services update %SERVICE_NAME% --project %PROJECT_ID% --region %REGION% --min-instances 0 --cpu-throttling --quiet
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Cloud Run is now in SLEEP MODE. (Zero compute charges)
) else (
    echo [ERROR] Failed to update service. Check gcloud login.
)
pause
