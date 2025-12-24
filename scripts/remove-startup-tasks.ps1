$ErrorActionPreference = "Continue"

$names = @(
  "StockManagement Backend",
  "StockManagement Frontend",
  "StockManagement Nginx"
)

foreach ($name in $names) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
}

Write-Host "Startup tasks removed."
