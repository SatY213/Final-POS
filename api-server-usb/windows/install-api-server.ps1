param(
  [string]$InstallDirectory = 'C:\POSModernAPI',
  [string]$DataDirectory = 'C:\ProgramData\POSModernAPI',
  [ValidateRange(1, 65535)][int]$Port = 3000
)
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'build-runtime'
$node = Join-Path $source 'node.exe'
$server = Join-Path $source 'server\server.js'
if (-not (Test-Path -LiteralPath $node) -or -not (Test-Path -LiteralPath $server)) {
  throw 'build-runtime est absent ou incomplet. Regenerez api-server-usb.'
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Executez ce script en tant qu administrateur.'
}

$taskName = 'POS Modern API'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}
New-Item -ItemType Directory -Path $InstallDirectory,$DataDirectory,(Join-Path $DataDirectory 'logs') -Force | Out-Null
Copy-Item -LiteralPath $node -Destination $InstallDirectory -Force
Copy-Item -LiteralPath (Join-Path $source 'server') -Destination $InstallDirectory -Recurse -Force
if (Test-Path -LiteralPath (Join-Path $source 'NODE-LICENSE')) {
  Copy-Item -LiteralPath (Join-Path $source 'NODE-LICENSE') -Destination $InstallDirectory -Force
}

$runner = Join-Path $InstallDirectory 'run-api-server.cmd'
$log = Join-Path $DataDirectory 'logs\api.log'
$content = @"
@echo off
set "POS_DATA_DIR=$DataDirectory"
set "POS_PORT=$Port"
cd /d "$InstallDirectory\server"
"$InstallDirectory\node.exe" "$InstallDirectory\server\server.js" >> "$log" 2>&1
"@
[IO.File]::WriteAllText($runner,$content,[Text.Encoding]::ASCII)

$firewallName = 'POS Modern API TCP'
if (-not (Get-NetFirewallRule -DisplayName $firewallName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $firewallName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private | Out-Null
}
$action = New-ScheduledTaskAction -Execute $env:ComSpec -Argument "/d /c `"$runner`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$account = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $account -Description 'Serveur central POS Modern API' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

$url = "http://127.0.0.1:$Port/api/health"
$healthy = $false
for ($i=0; $i -lt 30; $i+=1) {
  Start-Sleep -Milliseconds 500
  try {
    $health = Invoke-RestMethod -Uri $url -TimeoutSec 2
    if ($health.product -eq 'modern-pos-api') { $healthy=$true; break }
  } catch {}
}
if (-not $healthy) { throw "L API ne repond pas. Consultez $log" }
Write-Host 'POS Modern API est installee et active.' -ForegroundColor Green
Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred |
  Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' } |
  ForEach-Object { Write-Host "http://$($_.IPAddress):$Port" -ForegroundColor Cyan }
