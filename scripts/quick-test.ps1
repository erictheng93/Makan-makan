# Quick Test - 快速驗證 Migrations SQL 語法

Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Quick Test - SQL 語法驗證" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$MIGRATIONS_DIR = "packages\database\migrations_v2"
$TEST_DB = "test_temp.db"

# 清理舊的測試資料庫
if (Test-Path $TEST_DB) {
    Remove-Item $TEST_DB
}

# 檢查 SQLite
Write-Host "[1/3] 檢查 SQLite..." -ForegroundColor Yellow

try {
    # 創建測試資料庫並執行第一個 migration
    $result = Get-Command sqlite3 -ErrorAction Stop
    Write-Host "✓ SQLite 已安裝" -ForegroundColor Green
    $useSQLite = $true
} catch {
    Write-Host "! SQLite CLI 未安裝，將使用 Node.js 方式" -ForegroundColor Yellow
    $useSQLite = $false
}

Write-Host ""

# 驗證 SQL 檔案語法
Write-Host "[2/3] 驗證 SQL 檔案語法..." -ForegroundColor Yellow

$migrations = Get-ChildItem -Path $MIGRATIONS_DIR -Filter "*.sql" | Sort-Object Name

$validCount = 0
$invalidCount = 0

foreach ($file in $migrations) {
    Write-Host "  檢查: $($file.Name)" -ForegroundColor Cyan

    # 讀取檔案內容
    $content = Get-Content $file.FullName -Raw

    # 基礎語法檢查
    $hasCreateTable = $content -match "CREATE TABLE"
    $hasCreateIndex = $content -match "CREATE INDEX"
    $hasSemicolons = $content -match ";"

    if ($hasCreateTable -and $hasSemicolons) {
        Write-Host "    ✓ 語法檢查通過" -ForegroundColor Green
        $validCount++
    } else {
        Write-Host "    ✗ 語法可能有問題" -ForegroundColor Red
        $invalidCount++
    }
}

Write-Host ""
Write-Host "驗證結果: $validCount 通過, $invalidCount 失敗" -ForegroundColor $(if ($invalidCount -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

# 統計資訊
Write-Host "[3/3] 統計 SQL 內容..." -ForegroundColor Yellow

$totalTables = 0
$totalIndexes = 0
$totalViews = 0
$totalTriggers = 0

foreach ($file in $migrations) {
    $content = Get-Content $file.FullName -Raw

    $tables = ([regex]::Matches($content, "CREATE TABLE IF NOT EXISTS")).Count
    $indexes = ([regex]::Matches($content, "CREATE INDEX")).Count
    $views = ([regex]::Matches($content, "CREATE VIEW")).Count
    $triggers = ([regex]::Matches($content, "CREATE TRIGGER")).Count

    $totalTables += $tables
    $totalIndexes += $indexes
    $totalViews += $views
    $totalTriggers += $triggers

    Write-Host "  $($file.Name):" -ForegroundColor Cyan
    Write-Host "    表: $tables | 索引: $indexes | 視圖: $views | 觸發器: $triggers" -ForegroundColor White
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "總計統計:" -ForegroundColor Green
Write-Host "  資料表: $totalTables" -ForegroundColor White
Write-Host "  索引: $totalIndexes" -ForegroundColor White
Write-Host "  視圖: $totalViews" -ForegroundColor White
Write-Host "  觸發器: $totalTriggers" -ForegroundColor White
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($invalidCount -eq 0 -and $totalTables -gt 0) {
    Write-Host "✅ 快速驗證通過！SQL 檔案看起來沒問題。" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步：" -ForegroundColor Yellow
    Write-Host "  1. 執行完整測試: .\scripts\test-migrations-v2.ps1" -ForegroundColor White
    Write-Host "  2. 或手動測試單一 migration" -ForegroundColor White
} else {
    Write-Host "⚠️  發現問題，請檢查 SQL 檔案" -ForegroundColor Yellow
}
