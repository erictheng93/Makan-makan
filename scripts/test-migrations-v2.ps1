# ============================================================================
# MakanMakan Database Migrations v2.0 - 測試執行腳本 (Windows PowerShell)
# ============================================================================
#
# 用途: 自動執行所有 16 個 migrations 到測試資料庫
# 使用: .\scripts\test-migrations-v2.ps1
#
# ============================================================================

$ErrorActionPreference = "Stop"

# 配置
$DB_NAME = "makanmakan-test-v2"
$MIGRATIONS_DIR = "packages\database\migrations_v2"
$LOG_DIR = "logs"
$LOG_FILE = "$LOG_DIR\migration-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

# 創建日誌目錄
if (!(Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR | Out-Null
}

# 顏色函數
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "════════════════════════════════════════════════════════" "Cyan"
Write-ColorOutput "  MakanMakan Database Migrations v2.0 - 測試執行" "Cyan"
Write-ColorOutput "════════════════════════════════════════════════════════" "Cyan"
Write-Host ""

# ============================================================================
# Step 1: 檢查環境
# ============================================================================

Write-ColorOutput "[1/6] 檢查執行環境..." "Yellow"

# 檢查 Node.js
try {
    $nodeVersion = node --version
    Write-ColorOutput "✓ Node.js 已安裝: $nodeVersion" "Green"
} catch {
    Write-ColorOutput "✗ Node.js 未安裝！請先安裝 Node.js" "Red"
    exit 1
}

# 檢查 pnpm
try {
    $pnpmVersion = pnpm --version
    Write-ColorOutput "✓ pnpm 已安裝: v$pnpmVersion" "Green"
} catch {
    Write-ColorOutput "! pnpm 未安裝，將使用 npx" "Yellow"
}

Write-Host ""

# ============================================================================
# Step 2: 創建測試資料庫
# ============================================================================

Write-ColorOutput "[2/6] 準備測試資料庫..." "Yellow"
Write-ColorOutput "資料庫名稱: $DB_NAME" "Cyan"

# 注意: 在 Windows 上，D1 資料庫通常使用 local 模式
Write-ColorOutput "✓ 將使用 local 模式執行測試" "Green"
Write-Host ""

# ============================================================================
# Step 3: 執行 Migrations
# ============================================================================

Write-ColorOutput "[3/6] 執行所有 Migrations..." "Yellow"

$MIGRATIONS = @(
    "01_tenants_and_settings.sql",
    "02_authentication.sql",
    "03_audit_system.sql",
    "04_product_catalog.sql",
    "05_order_management.sql",
    "06_customer_management.sql",
    "07_table_and_seating.sql",
    "08_qr_code_system.sql",
    "09_shift_scheduling.sql",
    "10_leave_management.sql",
    "11_attendance_tracking.sql",
    "12_business_analytics.sql",
    "13_ai_insights.sql",
    "14_inventory_management.sql",
    "15_promotions_and_coupons.sql",
    "16_loyalty_program.sql"
)

$MIGRATION_COUNT = 0
$FAILED_MIGRATIONS = @()
$SUCCESS_COUNT = 0

foreach ($migration in $MIGRATIONS) {
    $MIGRATION_COUNT++
    Write-ColorOutput "[${MIGRATION_COUNT}/16] 執行 ${migration}..." "Cyan"

    $MIGRATION_FILE = Join-Path $MIGRATIONS_DIR $migration

    if (!(Test-Path $MIGRATION_FILE)) {
        Write-ColorOutput "  ✗ 找不到 migration 檔案: ${MIGRATION_FILE}" "Red"
        $FAILED_MIGRATIONS += $migration
        continue
    }

    try {
        # 執行 migration
        $output = npx wrangler d1 execute $DB_NAME --local --file="$MIGRATION_FILE" 2>&1
        Add-Content -Path $LOG_FILE -Value $output
        Write-ColorOutput "  ✓ ${migration} 執行成功" "Green"
        $SUCCESS_COUNT++
    } catch {
        Write-ColorOutput "  ✗ ${migration} 執行失敗: $_" "Red"
        $FAILED_MIGRATIONS += $migration
        Add-Content -Path $LOG_FILE -Value "ERROR: ${migration} - $_"
    }
}

Write-Host ""
Write-ColorOutput "✓ Migrations 執行完成" "Green"
Write-ColorOutput "  成功: ${SUCCESS_COUNT}/${MIGRATION_COUNT}" "Green"

if ($FAILED_MIGRATIONS.Count -gt 0) {
    Write-ColorOutput "  失敗: $($FAILED_MIGRATIONS.Count)" "Red"
    Write-ColorOutput "  失敗的 migrations: $($FAILED_MIGRATIONS -join ', ')" "Red"
}
Write-Host ""

# ============================================================================
# Step 4: 驗證資料庫結構
# ============================================================================

Write-ColorOutput "[4/6] 驗證資料庫結構..." "Yellow"

# 檢查表數量
Write-ColorOutput "檢查表數量..." "Cyan"
try {
    $tableCountOutput = npx wrangler d1 execute $DB_NAME --local --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'" --json 2>&1
    $TABLE_COUNT = if ($tableCountOutput -match '"count":(\d+)') { [int]$matches[1] } else { 0 }
} catch {
    $TABLE_COUNT = 0
}

Write-Host "  預期: 67 個表"
Write-Host "  實際: ${TABLE_COUNT} 個表"

if ($TABLE_COUNT -eq 67) {
    Write-ColorOutput "  ✓ 表數量正確" "Green"
} else {
    Write-ColorOutput "  ! 表數量不符預期" "Yellow"
}

# 檢查索引數量
Write-ColorOutput "檢查索引數量..." "Cyan"
try {
    $indexCountOutput = npx wrangler d1 execute $DB_NAME --local --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'" --json 2>&1
    $INDEX_COUNT = if ($indexCountOutput -match '"count":(\d+)') { [int]$matches[1] } else { 0 }
} catch {
    $INDEX_COUNT = 0
}

Write-Host "  預期: 461 個索引"
Write-Host "  實際: ${INDEX_COUNT} 個索引"

if ($INDEX_COUNT -eq 461) {
    Write-ColorOutput "  ✓ 索引數量正確" "Green"
} else {
    Write-ColorOutput "  ! 索引數量不符預期" "Yellow"
}

# 檢查視圖數量
Write-ColorOutput "檢查視圖數量..." "Cyan"
try {
    $viewCountOutput = npx wrangler d1 execute $DB_NAME --local --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='view'" --json 2>&1
    $VIEW_COUNT = if ($viewCountOutput -match '"count":(\d+)') { [int]$matches[1] } else { 0 }
} catch {
    $VIEW_COUNT = 0
}

Write-Host "  預期: 60 個視圖"
Write-Host "  實際: ${VIEW_COUNT} 個視圖"

if ($VIEW_COUNT -eq 60) {
    Write-ColorOutput "  ✓ 視圖數量正確" "Green"
} else {
    Write-ColorOutput "  ! 視圖數量不符預期" "Yellow"
}

# 檢查觸發器數量
Write-ColorOutput "檢查觸發器數量..." "Cyan"
try {
    $triggerCountOutput = npx wrangler d1 execute $DB_NAME --local --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger'" --json 2>&1
    $TRIGGER_COUNT = if ($triggerCountOutput -match '"count":(\d+)') { [int]$matches[1] } else { 0 }
} catch {
    $TRIGGER_COUNT = 0
}

Write-Host "  預期: 108 個觸發器"
Write-Host "  實際: ${TRIGGER_COUNT} 個觸發器"

if ($TRIGGER_COUNT -eq 108) {
    Write-ColorOutput "  ✓ 觸發器數量正確" "Green"
} else {
    Write-ColorOutput "  ! 觸發器數量不符預期" "Yellow"
}

Write-Host ""
Write-ColorOutput "✓ 資料庫結構驗證完成" "Green"
Write-Host ""

# ============================================================================
# Step 5: 列出所有表
# ============================================================================

Write-ColorOutput "[5/6] 列出所有資料表..." "Yellow"
try {
    $tables = npx wrangler d1 execute $DB_NAME --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name" 2>&1
    Write-Host $tables
    Add-Content -Path $LOG_FILE -Value "`n=== Tables ==="
    Add-Content -Path $LOG_FILE -Value $tables
} catch {
    Write-ColorOutput "! 無法列出資料表: $_" "Yellow"
}
Write-Host ""

# ============================================================================
# Step 6: 生成測試報告
# ============================================================================

Write-ColorOutput "[6/6] 生成測試報告..." "Yellow"

$REPORT_DIR = "docs\migrations_v2"
if (!(Test-Path $REPORT_DIR)) {
    New-Item -ItemType Directory -Path $REPORT_DIR | Out-Null
}

$REPORT_FILE = "$REPORT_DIR\TEST_REPORT_$(Get-Date -Format 'yyyyMMdd-HHmmss').md"

$reportContent = @"
# MakanMakan Migrations v2.0 - 測試報告

**測試日期**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
**測試資料庫**: $DB_NAME
**測試環境**: Windows (Local)

---

## 測試結果總覽

| 項目 | 預期 | 實際 | 狀態 |
|------|------|------|------|
| Migrations 執行 | 16 | ${SUCCESS_COUNT} | $(if ($SUCCESS_COUNT -eq 16) { "✅" } else { "⚠️" }) |
| 資料表數量 | 67 | ${TABLE_COUNT} | $(if ($TABLE_COUNT -eq 67) { "✅" } else { "⚠️" }) |
| 索引數量 | 461 | ${INDEX_COUNT} | $(if ($INDEX_COUNT -eq 461) { "✅" } else { "⚠️" }) |
| 視圖數量 | 60 | ${VIEW_COUNT} | $(if ($VIEW_COUNT -eq 60) { "✅" } else { "⚠️" }) |
| 觸發器數量 | 108 | ${TRIGGER_COUNT} | $(if ($TRIGGER_COUNT -eq 108) { "✅" } else { "⚠️" }) |

---

## Migrations 執行詳情

成功: ${SUCCESS_COUNT}/${MIGRATION_COUNT}

"@

if ($FAILED_MIGRATIONS.Count -gt 0) {
    $reportContent += "`n失敗的 Migrations:`n"
    foreach ($failed in $FAILED_MIGRATIONS) {
        $reportContent += "- $failed`n"
    }
} else {
    $reportContent += "`n所有 Migrations 執行成功 ✅`n"
}

$reportContent += @"

---

## 詳細日誌

完整日誌請查看: ``$LOG_FILE``

---

## 下一步

"@

if ($SUCCESS_COUNT -eq 16 -and $TABLE_COUNT -eq 67) {
    $reportContent += @"
✅ **所有基礎測試通過！**

建議繼續執行:
1. 資料完整性測試 (外鍵、約束)
2. 觸發器功能測試
3. 視圖查詢測試
4. 效能基準測試
"@
} else {
    $reportContent += @"
⚠️ **部分測試未通過**

請檢查:
1. 失敗的 migrations
2. 資料庫結構差異
3. 詳細日誌檔案
"@
}

Set-Content -Path $REPORT_FILE -Value $reportContent -Encoding UTF8

Write-ColorOutput "✓ 測試報告已生成: $REPORT_FILE" "Green"
Write-Host ""

# ============================================================================
# 完成
# ============================================================================

Write-ColorOutput "════════════════════════════════════════════════════════" "Cyan"
Write-ColorOutput "  測試執行完成！" "Green"
Write-ColorOutput "════════════════════════════════════════════════════════" "Cyan"
Write-Host ""
Write-Host "測試報告: $REPORT_FILE"
Write-Host "詳細日誌: $LOG_FILE"
Write-Host ""

if ($SUCCESS_COUNT -eq 16 -and $TABLE_COUNT -eq 67) {
    Write-ColorOutput "✅ 所有測試通過！" "Green"
    exit 0
} else {
    Write-ColorOutput "⚠️  部分測試未通過，請檢查日誌" "Yellow"
    exit 1
}
