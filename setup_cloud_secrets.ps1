param(
  [string]$ProjectId = "trading-509214",
  [string]$Region = "asia-south1",
  [string]$Service = "tradersdesk"
)

$ErrorActionPreference = "Stop"
$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path -LiteralPath $envFile)) { throw "Local .env was not found. Create it first; do not commit it." }

$requiredCli = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $requiredCli) { throw "Google Cloud CLI is not installed or is not on PATH. Run this script in Google Cloud Shell or install the Google Cloud CLI." }

$keys = @(
  "ADMIN_SECRET_KEY", "DATA_BROKER",
  "ANGEL_API_KEY", "ANGEL_CLIENT_CODE", "ANGEL_PIN", "ANGEL_TOTP_SECRET", "ANGEL_TOTP_CODE", "ANGEL_BASE_URL",
  "UPSTOX_ACCESS_TOKEN", "UPSTOX_API_KEY", "UPSTOX_API_SECRET", "UPSTOX_MOBILE", "UPSTOX_PIN", "UPSTOX_TOTP_SECRET", "UPSTOX_REDIRECT_URI",
  "KOTAK_ACCESS_TOKEN", "KOTAK_CONSUMER_KEY", "KOTAK_CONSUMER_SECRET", "KOTAK_UCC", "KOTAK_MOBILE_NO", "KOTAK_MPIN", "KOTAK_TOTP_SECRET", "KOTAK_VIEW_TOKEN", "KOTAK_SID",
  "FYERS_APP_ID", "FYERS_ACCESS_TOKEN", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"
)

$config = @{}
Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $config[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}

gcloud services enable secretmanager.googleapis.com --project $ProjectId --quiet
$serviceAccount = gcloud run services describe $Service --project $ProjectId --region $Region --format="value(spec.template.spec.serviceAccountName)"
if (-not $serviceAccount) {
  $projectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)"
  $serviceAccount = "$projectNumber-compute@developer.gserviceaccount.com"
}

foreach ($key in $keys) {
  $value = [string]$config[$key]
  if ([string]::IsNullOrWhiteSpace($value)) { continue }
  $secret = "tradersdesk-" + $key.ToLower().Replace("_", "-")
  gcloud secrets describe $secret --project $ProjectId > $null 2>&1
  if ($LASTEXITCODE -ne 0) {
    gcloud secrets create $secret --project $ProjectId --replication-policy=automatic --quiet
  }
  Write-Output -NoEnumerate $value | gcloud secrets versions add $secret --project $ProjectId --data-file=- --quiet
  gcloud secrets add-iam-policy-binding $secret --project $ProjectId --member="serviceAccount:$serviceAccount" --role="roles/secretmanager.secretAccessor" --quiet | Out-Null
  gcloud secrets add-iam-policy-binding $secret --project $ProjectId --member="serviceAccount:$serviceAccount" --role="roles/secretmanager.secretVersionAdder" --quiet | Out-Null
}

Write-Host "Secrets prepared. Run deploy_to_gcp.bat next."
