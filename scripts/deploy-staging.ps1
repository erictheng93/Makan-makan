# MakanMakan Staging Deployment Script
# 部署到 Staging 環境的 PowerShell 腳本
#
# 使用方式: .\scripts\deploy-staging.ps1
# 前提條件: 已登入 Cloudflare (npx wrangler login)

param(
    [switch]$SkipBuild,
    [switch]$SkipMigrations,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  MakanMakan Staging Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 切換到項目根目錄
Set-Location $ProjectRoot
Write-Host "Working directory: $ProjectRoot" -ForegroundColor Gray

# 1. 檢查 Wrangler 登入狀態
Write-Host "`n[1/6] Checking Cloudflare authentication..." -ForegroundColor Yellow
try {
    $whoami = npx wrangler whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Please login to Cloudflare first:" -ForegroundColor Red
        Write-Host "  npx wrangler login" -ForegroundColor White
        exit 1
    }
    Write-Host "Authenticated as: $whoami" -ForegroundColor Green
} catch {
    Write-Host "Error checking authentication: $_" -ForegroundColor Red
    exit 1
}

# 2. 安裝依賴
if (-not $SkipBuild) {
    Write-Host "`n[2/6] Installing dependencies..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# 3. 類型檢查
if (-not $SkipBuild) {
    Write-Host "`n[3/6] Running type check..." -ForegroundColor Yellow
    pnpm run typecheck
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Type check failed. Please fix errors before deploying." -ForegroundColor Red
        exit 1
    }
    Write-Host "Type check passed!" -ForegroundColor Green
}

# 4. 執行數據庫遷移
if (-not $SkipMigrations) {
    Write-Host "`n[4/6] Running database migrations..." -ForegroundColor Yellow
    if ($DryRun) {
        Write-Host "[DRY RUN] Would run: npx wrangler d1 migrations apply makanmakan-staging --env staging" -ForegroundColor Magenta
    } else {
        npx wrangler d1 migrations apply makanmakan-staging --env staging
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Database migration failed" -ForegroundColor Red
            exit 1
        }
    }
    Write-Host "Migrations completed!" -ForegroundColor Green
}

# 5. 部署 API 服務
Write-Host "`n[5/6] Deploying API service..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\apps\api"
if ($DryRun) {
    Write-Host "[DRY RUN] Would run: npx wrangler deploy --env staging" -ForegroundColor Magenta
} else {
    npx wrangler deploy --env staging
    if ($LASTEXITCODE -ne 0) {
        Write-Host "API deployment failed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "API deployed successfully!" -ForegroundColor Green

# 6. 部署 Realtime 服務
Write-Host "`n[6/6] Deploying Realtime service..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\apps\realtime"
if ($DryRun) {
    Write-Host "[DRY RUN] Would run: npx wrangler deploy --env staging" -ForegroundColor Magenta
} else {
    npx wrangler deploy --env staging
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Realtime deployment failed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "Realtime service deployed successfully!" -ForegroundColor Green

# 回到項目根目錄
Set-Location $ProjectRoot

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Staging URLs:" -ForegroundColor White
Write-Host "  API:      https://api-staging.makanmakan.com" -ForegroundColor Gray
Write-Host "  Realtime: wss://realtime-staging.makanmakan.workers.dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify API health: curl https://api-staging.makanmakan.com/api/v1/health" -ForegroundColor Gray
Write-Host "  2. Test WebSocket connection with Artillery" -ForegroundColor Gray
Write-Host "  3. Check Cloudflare dashboard for any errors" -ForegroundColor Gray
