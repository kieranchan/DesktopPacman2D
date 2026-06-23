<#
.SYNOPSIS
  Safely launch the Electron app for smoke testing with memory/process guards.

.DESCRIPTION
  Kills any orphaned electron processes first, launches the app, samples
  process count and total working-set memory once per second, force-kills
  the app if it exceeds thresholds, and always terminates cleanly after
  the requested duration. Prints a summary report.

  This script is the safety net for iterative development: run it after
  each change to verify the app still launches without leaking processes
  or runaway memory.

.PARAMETER Seconds
  How long to keep the app alive before terminating it. Default 8s.

.PARAMETER MaxMemMB
  Total working-set ceiling across all electron processes in MB.
  Exceeding this triggers an early kill. Default 600 MB.

.PARAMETER MaxProcs
  Maximum allowed electron process count. Exceeding this triggers an
  early kill. Default 10 (main + helpers usually = 4-5).

.PARAMETER ProjectPath
  Path to the project root containing package.json. Defaults to the
  parent directory of this script.

.EXAMPLE
  pwsh scripts/test-launch.ps1
  pwsh scripts/test-launch.ps1 -Seconds 30 -MaxMemMB 800
#>
[CmdletBinding()]
param(
    [int]$Seconds = 8,
    [int]$MaxMemMB = 600,
    [int]$MaxProcs = 10,
    [string]$ProjectPath = $null
)

$ErrorActionPreference = "Stop"

if (-not $ProjectPath) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $ProjectPath = (Resolve-Path (Join-Path $scriptDir "..")).Path
}

function Stop-AllElectron {
    $procs = Get-Process electron -ErrorAction SilentlyContinue
    if ($procs) {
        $count = $procs.Count
        $procs | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 300
        return $count
    }
    return 0
}

Write-Host "=== test-launch ===" -ForegroundColor Cyan
Write-Host "project:   $ProjectPath"
Write-Host "duration:  ${Seconds}s"
Write-Host "limits:    <= $MaxProcs procs, <= $MaxMemMB MB"

$killedBefore = Stop-AllElectron
if ($killedBefore -gt 0) {
    Write-Host "killed $killedBefore orphan electron process(es) before launch" -ForegroundColor Yellow
}

$logOut = Join-Path $env:TEMP "pacman-test.out.log"
$logErr = Join-Path $env:TEMP "pacman-test.err.log"
Remove-Item $logOut, $logErr -ErrorAction SilentlyContinue

Write-Host "launching npm start ..." -ForegroundColor Green
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
if (-not $npm) { $npm = (Get-Command npm -ErrorAction Stop) }

$launcher = Start-Process -FilePath $npm.Source `
    -ArgumentList @("start","--prefix",$ProjectPath) `
    -WorkingDirectory $ProjectPath `
    -RedirectStandardOutput $logOut `
    -RedirectStandardError $logErr `
    -PassThru `
    -WindowStyle Hidden

$peakMem = 0.0
$peakProcs = 0
$breachReason = $null
$samples = @()

for ($i = 1; $i -le $Seconds; $i++) {
    Start-Sleep -Seconds 1
    $procs = Get-Process electron -ErrorAction SilentlyContinue
    if (-not $procs) {
        $samples += "${i}s  procs=0  mem=0MB"
        continue
    }
    $count = ($procs | Measure-Object).Count
    $memMB = [math]::Round((($procs | Measure-Object WorkingSet64 -Sum).Sum / 1MB), 1)
    if ($memMB -gt $peakMem)   { $peakMem = $memMB }
    if ($count -gt $peakProcs) { $peakProcs = $count }
    $samples += "${i}s  procs=$count  mem=${memMB}MB"

    if ($count -gt $MaxProcs) {
        $breachReason = "process count $count > $MaxProcs"
        break
    }
    if ($memMB -gt $MaxMemMB) {
        $breachReason = "memory ${memMB}MB > ${MaxMemMB}MB"
        break
    }
}

Write-Host ""
Write-Host "=== samples ===" -ForegroundColor Cyan
$samples | ForEach-Object { Write-Host "  $_" }

# Always clean up
$killedAfter = Stop-AllElectron
if ($launcher -and -not $launcher.HasExited) {
    try { Stop-Process -Id $launcher.Id -Force -ErrorAction SilentlyContinue } catch {}
}

Write-Host ""
Write-Host "=== report ===" -ForegroundColor Cyan
Write-Host ("peak processes : {0}" -f $peakProcs)
Write-Host ("peak memory    : {0} MB" -f $peakMem)
Write-Host ("killed at end  : {0} electron procs" -f $killedAfter)

if ($breachReason) {
    Write-Host ("RESULT: BREACH -> {0}" -f $breachReason) -ForegroundColor Red
    if (Test-Path $logErr) {
        Write-Host ""
        Write-Host "=== stderr tail ===" -ForegroundColor Yellow
        Get-Content $logErr -Tail 20 -ErrorAction SilentlyContinue
    }
    exit 1
}

if ($peakProcs -eq 0) {
    Write-Host "RESULT: FAILED TO LAUNCH (no electron process ever appeared)" -ForegroundColor Red
    if (Test-Path $logOut) {
        Write-Host ""
        Write-Host "=== stdout tail ===" -ForegroundColor Yellow
        Get-Content $logOut -Tail 20 -ErrorAction SilentlyContinue
    }
    if (Test-Path $logErr) {
        Write-Host ""
        Write-Host "=== stderr tail ===" -ForegroundColor Yellow
        Get-Content $logErr -Tail 20 -ErrorAction SilentlyContinue
    }
    exit 2
}

Write-Host "RESULT: OK" -ForegroundColor Green
exit 0
