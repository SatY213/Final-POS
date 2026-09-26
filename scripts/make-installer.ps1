param([switch]$PackageOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$currentNode = (Get-Command node.exe).Source
$nvmRoot = if ($env:NVM_HOME) { $env:NVM_HOME } else { Join-Path $env:APPDATA 'nvm' }

# The server's native SQLite module is built for Node 26. Select that runtime
# explicitly so packaging does not depend on whichever NVM version is active.
$runtimeNode = $currentNode
if (Test-Path -LiteralPath $nvmRoot) {
  $node26 = Get-ChildItem -LiteralPath $nvmRoot -Directory -Filter 'v26.*' |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName 'node.exe' } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
  if ($node26) { $runtimeNode = $node26 }
}

& $runtimeNode (Join-Path $PSScriptRoot 'prepare-install-build.js')
if ($LASTEXITCODE -ne 0) { throw "Clean database/runtime preparation failed ($LASTEXITCODE)." }

# Electron Forge 7 currently packages this project reliably with Node 20. The
# embedded API remains on the current Node runtime prepared above.
$forgeNode = $currentNode
if (Test-Path -LiteralPath $nvmRoot) {
  $node20 = Get-ChildItem -LiteralPath $nvmRoot -Directory -Filter 'v20.*' |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName 'node.exe' } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
  if ($node20) { $forgeNode = $node20 }
}
$command = if ($PackageOnly) { 'package' } else { 'make' }
Push-Location $projectRoot
try {
  # Use Forge's programmatic API. Its CLI launches a second JavaScript file and
  # can split the project path when it contains spaces (for example Final POS).
  $forgeBootstrap = "const {api}=require('@electron-forge/core');api.$command({dir:process.cwd(),interactive:true,arch:process.arch,platform:process.platform}).catch((error)=>{console.error(error);process.exitCode=1})"
  & $forgeNode -e $forgeBootstrap $command
  if ($LASTEXITCODE -ne 0) { throw "Electron Forge $command failed ($LASTEXITCODE)." }
} finally {
  Pop-Location
}

if (-not $PackageOnly) {
  $installer = Join-Path $projectRoot 'out/make/squirrel.windows/x64/POSModernSetup.exe'
  if (-not (Test-Path -LiteralPath $installer)) { throw "Installer was not generated: $installer" }
  Write-Output "Installer ready: $installer"
}
