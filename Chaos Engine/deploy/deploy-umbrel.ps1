# Builds the Chaos Engine on this PC and installs it on the Umbrel over SSH.
# Usage: .\deploy\deploy-umbrel.ps1 [-UmbrelHost umbrel@umbrel.local]
param(
  [string]$UmbrelHost = $(if ($env:CHAOS_UMBREL_HOST) { $env:CHAOS_UMBREL_HOST } else { 'umbrel@umbrel.local' }),
  [string]$TailscaleIp = '100.78.163.65'
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$remoteDir = 'chaos-engine'
$tar = Join-Path $env:TEMP 'chaos-engine-image.tar'
$lanName = ($UmbrelHost -split '@')[-1]

function Step($text) { Write-Host "`n== $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "`n$text" -ForegroundColor Red; exit 1 }
function Run($exe, [string[]]$argv) {
  & $exe @argv
  if ($LASTEXITCODE -ne 0) { Fail "Stopped: '$exe $($argv -join ' ')' failed. Nothing on the Umbrel was changed." }
}

# ------------------------------------------------------------ before anything slow
Step 'Checking the way to the Umbrel'
& ssh -o BatchMode=yes -o ConnectTimeout=8 $UmbrelHost 'true' 2>$null
if ($LASTEXITCODE -ne 0) {
  Fail @"
Cannot log in to $UmbrelHost with this PC's SSH key.
- Is the Umbrel on, and is this PC on the same network?
- If the key was never installed, run this once and enter the Umbrel password:
  cat ~/.ssh/id_ed25519.pub | ssh $UmbrelHost 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
"@
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Starting Docker Desktop...'
  $dd = @("$env:ProgramFiles\Docker\Docker\Docker Desktop.exe", "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $dd) { Fail 'Docker Desktop is not installed on this PC.' }
  Start-Process $dd
  $ready = $false
  for ($i = 0; $i -lt 90 -and -not $ready; $i++) {
    Start-Sleep -Seconds 2
    & docker info *> $null
    $ready = ($LASTEXITCODE -eq 0)
  }
  if (-not $ready) { Fail 'Docker Desktop did not start within three minutes.' }
}

# ------------------------------------------------------------ build
Step 'Testing: nothing ships unless every test passes'
Run npx @('ng', 'test', '--watch=false')
Run node @('--test', 'tools/serve.test.mjs')

Step 'Building the app'
Run npx @('ng', 'build', '--configuration', 'production')

Step 'Building the image'
Run docker @('build', '-q', '-t', 'chaos-engine:latest', '.')
Run docker @('save', '-o', $tar, 'chaos-engine:latest')

# ------------------------------------------------------------ install
Step "Copying to $UmbrelHost"
Run ssh @($UmbrelHost, "mkdir -p ~/$remoteDir/data")
Run scp @('-q', $tar, 'deploy/docker-compose.yml', "${UmbrelHost}:~/$remoteDir/")
Remove-Item $tar -ErrorAction SilentlyContinue

Step 'Starting it on the Umbrel (the Umbrel password is asked for once)'
# Docker on umbrelOS needs sudo for the umbrel user, unless it has been added to the docker group.
$remote = @"
set -e
cd ~/$remoteDir
if docker info >/dev/null 2>&1; then D=docker; else D='sudo docker'; fi
`$D load -i chaos-engine-image.tar >/dev/null
`$D compose up -d --force-recreate
rm chaos-engine-image.tar
`$D image prune -f >/dev/null
"@
Run ssh @('-t', $UmbrelHost, $remote.Replace("`r", ''))

Step 'Checking it answers'
$ok = $false
for ($i = 0; $i -lt 15 -and -not $ok; $i++) {
  Start-Sleep -Seconds 1
  try { $ok = (Invoke-RestMethod -TimeoutSec 3 "http://${lanName}:7400/api/health").storage -eq 'server' } catch { }
}
if (-not $ok) { Fail "Installed, but http://${lanName}:7400 is not answering yet. Check it with: ssh $UmbrelHost 'sudo docker logs chaos-engine'" }

Write-Host "`nThe Chaos Engine is live, with its data on the Umbrel." -ForegroundColor Green
Write-Host "  At home:         http://${lanName}:7400/dm"
Write-Host "  Over Tailscale:  http://${TailscaleIp}:7400/dm"
