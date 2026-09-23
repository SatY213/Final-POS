$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourcePath = Join-Path $projectRoot 'pos.png'
$assetDirectory = Join-Path $projectRoot 'build-assets'
New-Item -ItemType Directory -Force -Path $assetDirectory | Out-Null
$pngPath = Join-Path $assetDirectory 'app-icon.png'
$icoPath = Join-Path $assetDirectory 'app-icon.ico'

$source = [System.Drawing.Image]::FromFile($sourcePath)
$bitmap = New-Object System.Drawing.Bitmap(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $width = 232
  $height = [int][Math]::Round($width * $source.Height / $source.Width)
  $graphics.DrawImage($source, [System.Drawing.Rectangle]::new(12, [int]((256 - $height) / 2), $width, $height))
  $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
  $source.Dispose()
}

$pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
$writer = New-Object System.IO.BinaryWriter([System.IO.File]::Create($icoPath))
try {
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]1)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$pngBytes.Length)
  $writer.Write([UInt32]22)
  $writer.Write($pngBytes)
} finally {
  $writer.Dispose()
}
Write-Output "Created $pngPath and $icoPath"
