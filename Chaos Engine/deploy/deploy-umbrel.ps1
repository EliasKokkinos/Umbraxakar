# Builds the Chaos Engine on this PC and installs it on the Umbrel over SSH.
# Usage: .\deploy\deploy-umbrel.ps1 [-UmbrelHost umbrel@umbrel.local]
param(
  [string]$UmbrelHost = $(if ($env:CHAOS_UMBREL_HOST) { $env:CHAOS_UMBREL_HOST } else { 'umbrel@umbrel.local' })
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$remoteDir = 'chaos-engine'
$tar = Join-Path $env:TEMP 'chaos-engine-image.tar'

function Step($text) { Write-Host "`n== $text" -ForegroundColor Yellow }
function Run($exe, [string[]]$argv) {
  & $exe @argv
  if ($LASTEXITCODE -ne 0) { throw "$exe $($argv -join ' ') failed (exit $LASTEXITCODE)" }
}

Step 'Testing: nothing ships unless every test passes'
Run npx @('ng', 'test', '--watch=false')
Run node @('--test', 'tools/serve.test.mjs')

Step 'Building the app'
Run npx @('ng', 'build', '--configuration', 'production')

Step 'Building the image'
Run docker @('build', '-t', 'chaos-engine:latest', '.')
Run docker @('save', '-o', $tar, 'chaos-engine:latest')

Step "Copying to $UmbrelHost"
Run ssh @($UmbrelHost, "mkdir -p ~/$remoteDir/data")
Run scp @($tar, 'deploy/docker-compose.yml', "${UmbrelHost}:~/$remoteDir/")

Step 'Starting it on the Umbrel'
# umbrelOS may or may not let the umbrel user run docker directly; fall back to sudo.
$remote = @"
set -e
cd ~/$remoteDir
if docker info >/dev/null 2>&1; then D=docker; else D='sudo docker'; fi
`$D load -i chaos-engine-image.tar
`$D compose up -d --force-recreate
rm chaos-engine-image.tar
`$D ps --filter name=chaos-engine --format '{{.Names}}: {{.Status}}'
"@
Run ssh @('-t', $UmbrelHost, $remote.Replace("`r", ''))
Remove-Item $tar -ErrorAction SilentlyContinue

$name = ($UmbrelHost -split '@')[-1]
Step 'Done'
Write-Host "On the LAN:      http://${name}:7400/dm"
Write-Host "Over Tailscale:  http://<the Umbrel's Tailscale name or 100.x address>:7400/dm"
