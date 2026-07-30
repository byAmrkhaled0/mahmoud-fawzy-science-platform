$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [string[]]$ArgumentList = @()
  )

  & $Executable @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $Executable $($ArgumentList -join ' ')"
  }
}

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "1/7 Verifying project..." -ForegroundColor Cyan
Invoke-Checked -Executable "npm" -ArgumentList @("test")

Write-Host "2/7 Building static site..." -ForegroundColor Cyan
Invoke-Checked -Executable "npm" -ArgumentList @("run", "build")

Write-Host "3/7 Installing Firebase Functions dependencies..." -ForegroundColor Cyan
Invoke-Checked -Executable "npm" -ArgumentList @("config", "set", "registry", "https://registry.npmjs.org/")
Invoke-Checked -Executable "npm" -ArgumentList @("--prefix", "functions", "ci", "--no-audit", "--no-fund")
Invoke-Checked -Executable "npm" -ArgumentList @("--prefix", "functions", "ls", "firebase-functions", "firebase-admin")

Write-Host "4/7 Deploying Firebase Functions..." -ForegroundColor Cyan
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"
Invoke-Checked -Executable "firebase" -ArgumentList @("deploy", "--only", "functions")

Write-Host "5/7 Deploying Firebase rules and indexes..." -ForegroundColor Cyan
Invoke-Checked -Executable "firebase" -ArgumentList @("deploy", "--only", "firestore:rules,firestore:indexes,storage")

Write-Host "6/7 Checking Git repository..." -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
  Write-Host "Firebase deployment completed, but this extracted folder is not connected to GitHub." -ForegroundColor Yellow
  Write-Host "Run .\prepare-github-folder.ps1, then run npm run deploy:production from the new folder." -ForegroundColor Yellow
  exit 0
}

Write-Host "7/7 Pushing production source to GitHub..." -ForegroundColor Cyan
Invoke-Checked -Executable "git" -ArgumentList @("add", "-A")
$changes = git status --porcelain
if ($changes) {
  Invoke-Checked -Executable "git" -ArgumentList @("commit", "-m", "Fix Windows production deploy V59.2.1")
  Invoke-Checked -Executable "git" -ArgumentList @("push", "origin", "main")
} else {
  Write-Host "No Git changes to push." -ForegroundColor Yellow
}

Write-Host "Done. Wait for the Vercel Production deployment to become Ready." -ForegroundColor Green
