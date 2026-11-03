$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $Root
try {
  New-Item -ItemType Directory -Path 'dist' -Force | Out-Null
  $env:GOOS='windows'; $env:GOARCH='amd64'; $env:CGO_ENABLED='0'
  go build -trimpath -ldflags '-H windowsgui -s -w' -o LeadForge.exe .\packaging\launcher\main.go
  if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed' }
  $runtime=@('index.html','saved.html','completed.html','about.html','styles.css','app.js','saved.js','completed.js','community-hub.js','reddit-engine.js','storage-utils.js','brand-ui.js','server.ps1','launch_chrome.ps1','START_APP.bat','LeadForge.exe','LeadForge.ico','leadforge-mark.svg')
  $zip=Join-Path $Root 'packaging\installer\payload.zip'
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path $runtime -DestinationPath $zip -CompressionLevel Optimal -Force
  go build -trimpath -ldflags '-H windowsgui -s -w' -o 'dist\LeadForge-Setup-1.0.0.exe' .\packaging\installer\main.go
  if ($LASTEXITCODE -ne 0) { throw 'Setup compilation failed' }
  Get-FileHash 'dist\LeadForge-Setup-1.0.0.exe' -Algorithm SHA256 | ForEach-Object { "$($_.Hash.ToLower())  LeadForge-Setup-1.0.0.exe" } | Set-Content 'dist\SHA256SUMS.txt'
  Write-Host 'Built LeadForge v1.0.0 under dist\'
} finally { Pop-Location }
