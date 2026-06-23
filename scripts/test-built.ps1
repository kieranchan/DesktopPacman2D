<#
.SYNOPSIS
  Same safety-net pattern as test-launch.ps1, but for the electron-builder
  output instead of `npm start`. Useful after build:dir or build:win:portable
  to confirm the packaged binary actually launches without runaway memory.

.PARAMETER ExePath
  Absolute path to the .exe to launch. Defaults to
  dist/win-unpacked/DesktopPacman2D.exe (the --dir output).

.PARAMETER Seconds
  Lifetime before forced termination. Default 8s.

.PARAMETER MaxMemMB
  Total working-set ceiling across the app's processes. Default 600 MB.

.PARAMETER MaxProcs
  Process-count ceiling. Default 10.
#>
[CmdletBinding()]
param(
    [string]$ExePath = $null,
    [int]$Seconds = 8,
    [int]$MaxMemMB = 600,
    [int]$MaxProcs = 10
)

$ErrorActionPreference = "Stop"

if (-not $ExePath) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $ExePath = (Join-Path (Split-Path -Parent $scriptDir) "dist\win-unpacked\DesktopPacman2D.exe")
}

if (-not (Test-Path $ExePath)) {
    Write-Host "ERROR: exe not found at $ExePath" -ForegroundColor Red
    Write-Host "Run: npm run build:dir   first." -ForegroundColor Yellow
    exit 2
}

$exeName = [IO.Path]::GetFileNameWithoutExtension($ExePath)

function Stop-AllApp {
    $procs = Get-Process $exeName -ErrorAction SilentlyContinue
    if ($procs) {
        $count = $procs.Count
        $procs | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 300
        return $count
    }
    return 0
}

Write-Host "=== test-built ===" -ForegroundColor Cyan
Write-Host "exe:       $ExePath"
Write-Host "duration:  ${Seconds}s"
Write-Host "limits:    <= $MaxProcs procs, <= $MaxMemMB MB"

$killedBefore = Stop-AllApp
if ($killedBefore -gt 0) {
    Write-Host "killed $killedBefore orphan process(es) before launch" -ForegroundColor Yellow
}

Write-Host "launching $exeName ..." -ForegroundColor Green
$launcher = Start-Process -FilePath $ExePath -PassThru -WindowStyle Hidden

$peakMem = 0.0
$peakProcs = 0
$breachReason = $null
$samples = @()

for ($i = 1; $i -le $Seconds; $i++) {
    Start-Sleep -Seconds 1
    $procs = Get-Process $exeName -ErrorAction SilentlyContinue
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

$killedAfter = Stop-AllApp

Write-Host ""
Write-Host "=== report ===" -ForegroundColor Cyan
Write-Host ("peak processes : {0}" -f $peakProcs)
Write-Host ("peak memory    : {0} MB" -f $peakMem)
Write-Host ("killed at end  : {0} procs" -f $killedAfter)

if ($breachReason) {
    Write-Host ("RESULT: BREACH -> {0}" -f $breachReason) -ForegroundColor Red
    exit 1
}
if ($peakProcs -eq 0) {
    Write-Host "RESULT: FAILED TO LAUNCH (process never appeared)" -ForegroundColor Red
    exit 2
}

Write-Host "RESULT: OK" -ForegroundColor Green
exit 0
