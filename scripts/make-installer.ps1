param([switch]$PackageOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$currentNode = (Get-Command node.exe).Source

& $currentNode (Join-Path $PSScriptRoot 'prepare-demo-build.js')
if ($LASTEXITCODE -ne 0) { throw "Demo database/runtime preparation failed ($LASTEXITCODE)." }

# Electron Forge 7 currently packages this project reliably with Node 20. The
# embedded API remains on the current Node runtime prepared above.
$forgeNode = $currentNode
if ($env:NVM_HOME) {
  $node20 = Get-ChildItem -LiteralPath $env:NVM_HOME -Directory -Filter 'v20.*' |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName 'node.exe' } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
  if ($node20) { $forgeNode = $node20 }
}
$forge = Join-Path $projectRoot 'node_modules/@electron-forge/cli/dist/electron-forge.js'
$command = if ($PackageOnly) { 'package' } else { 'make' }
& $forgeNode $forge $command
if ($LASTEXITCODE -ne 0) { throw "Electron Forge $command failed ($LASTEXITCODE)." }

if (-not $PackageOnly) {
  $installer = Join-Path $projectRoot 'out/make/squirrel.windows/x64/POSModernSetup.exe'
  if (-not (Test-Path -LiteralPath $installer)) { throw "Installer was not generated: $installer" }
  Write-Output "Installer ready: $installer"
}
