$ErrorActionPreference = "Stop"

function Confirm-LastCommand {
    param([string]$Label)

    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Label"
    }
}

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "1/7 Verifying project..." -ForegroundColor Cyan
npm test
Confirm-LastCommand "npm test"

Write-Host "2/7 Building static site..." -ForegroundColor Cyan
npm run build
Confirm-LastCommand "npm run build"

Write-Host "3/7 Installing Firebase Functions dependencies..." -ForegroundColor Cyan
npm config set registry https://registry.npmjs.org/
Confirm-LastCommand "npm config set registry"

npm --prefix functions ci --no-audit --no-fund
Confirm-LastCommand "npm --prefix functions ci"

npm --prefix functions ls firebase-functions firebase-admin
Confirm-LastCommand "npm --prefix functions ls"

Write-Host "4/7 Deploying Firebase Functions..." -ForegroundColor Cyan
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"
firebase deploy --only functions
Confirm-LastCommand "firebase deploy --only functions"

Write-Host "5/7 Deploying Firebase rules and indexes..." -ForegroundColor Cyan
firebase deploy --only "firestore:rules,firestore:indexes,storage"
Confirm-LastCommand "firebase rules and indexes deployment"

Write-Host "6/7 Checking Git repository..." -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
    Write-Host "Firebase deployment completed, but this folder is not connected to GitHub." -ForegroundColor Yellow
    exit 0
}

Write-Host "7/7 Pushing production source to GitHub..." -ForegroundColor Cyan
git add -A
Confirm-LastCommand "git add"

$Changes = git status --porcelain

if ($Changes) {
    git commit -m "Fix Windows production deployment V59.2.1"
    Confirm-LastCommand "git commit"

    git push origin main
    Confirm-LastCommand "git push"
} else {
    Write-Host "No Git changes to push." -ForegroundColor Yellow
}

Write-Host "Production deployment completed successfully." -ForegroundColor Green
