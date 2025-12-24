$ErrorActionPreference = "Stop"

$base = "C:\stock_management"
$tasks = @(
  @{ Name = "StockManagement Backend"; Script = "$base\scripts\start-backend.bat"; WorkDir = "$base\backend" },
  @{ Name = "StockManagement Frontend"; Script = "$base\scripts\start-frontend.bat"; WorkDir = "$base\frontend" },
  @{ Name = "StockManagement Nginx"; Script = "$base\scripts\start-nginx.bat"; WorkDir = "C:\nginx-1.28.0" }
)

$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew

foreach ($t in $tasks) {
  $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$($t.Script)`"" -WorkingDirectory $t.WorkDir
  Register-ScheduledTask -TaskName $t.Name -Action $action -Trigger $trigger -Settings $settings -User "SYSTEM" -RunLevel Highest -Force
}

Write-Host "Startup tasks installed."
