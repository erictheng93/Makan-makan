#!/bin/bash

# ============================================================================
# MakanMakan Database Migrations v2.0 - 測試執行腳本
# ============================================================================
#
# 用途: 自動執行所有 16 個 migrations 到測試資料庫
# 使用: ./scripts/test-migrations-v2.sh
#
# ============================================================================

set -e  # 遇到錯誤立即停止

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
DB_NAME="makanmakan-test-v2"
MIGRATIONS_DIR="packages/database/migrations_v2"
LOG_FILE="logs/migration-test-$(date +%Y%m%d-%H%M%S).log"

# 創建日誌目錄
mkdir -p logs

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  MakanMakan Database Migrations v2.0 - 測試執行${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================================
# Step 1: 檢查 wrangler CLI
# ============================================================================

echo -e "${YELLOW}[1/6] 檢查 wrangler CLI...${NC}"
if ! command -v npx &> /dev/null; then
    echo -e "${RED}✗ npx 未安裝！請先安裝 Node.js${NC}"
    exit 1
fi

echo -e "${GREEN}✓ wrangler CLI 已就緒${NC}"
echo ""

# ============================================================================
# Step 2: 創建測試資料庫
# ============================================================================

echo -e "${YELLOW}[2/6] 創建測試資料庫...${NC}"
echo -e "${BLUE}資料庫名稱: ${DB_NAME}${NC}"

# 檢查資料庫是否已存在
DB_EXISTS=$(npx wrangler d1 list 2>/dev/null | grep -c "${DB_NAME}" || true)

if [ "$DB_EXISTS" -eq "0" ]; then
    echo "創建新的測試資料庫..."
    npx wrangler d1 create "${DB_NAME}" 2>&1 | tee -a "${LOG_FILE}"
    echo -e "${GREEN}✓ 測試資料庫創建成功${NC}"
else
    echo -e "${YELLOW}! 測試資料庫已存在，將使用現有資料庫${NC}"
fi
echo ""

# ============================================================================
# Step 3: 執行 Migrations
# ============================================================================

echo -e "${YELLOW}[3/6] 執行所有 Migrations...${NC}"

MIGRATIONS=(
    "01_tenants_and_settings.sql"
    "02_authentication.sql"
    "03_audit_system.sql"
    "04_product_catalog.sql"
    "05_order_management.sql"
    "06_customer_management.sql"
    "07_table_and_seating.sql"
    "08_qr_code_system.sql"
    "09_shift_scheduling.sql"
    "10_leave_management.sql"
    "11_attendance_tracking.sql"
    "12_business_analytics.sql"
    "13_ai_insights.sql"
    "14_inventory_management.sql"
    "15_promotions_and_coupons.sql"
    "16_loyalty_program.sql"
)

MIGRATION_COUNT=0
FAILED_MIGRATIONS=()

for migration in "${MIGRATIONS[@]}"; do
    MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
    echo -e "${BLUE}[${MIGRATION_COUNT}/16] 執行 ${migration}...${NC}"

    MIGRATION_FILE="${MIGRATIONS_DIR}/${migration}"

    if [ ! -f "$MIGRATION_FILE" ]; then
        echo -e "${RED}✗ 找不到 migration 檔案: ${MIGRATION_FILE}${NC}"
        FAILED_MIGRATIONS+=("${migration}")
        continue
    fi

    # 執行 migration
    if npx wrangler d1 execute "${DB_NAME}" --local --file="${MIGRATION_FILE}" >> "${LOG_FILE}" 2>&1; then
        echo -e "${GREEN}  ✓ ${migration} 執行成功${NC}"
    else
        echo -e "${RED}  ✗ ${migration} 執行失敗${NC}"
        FAILED_MIGRATIONS+=("${migration}")
    fi
done

echo ""
echo -e "${GREEN}✓ Migrations 執行完成${NC}"
echo -e "  成功: $((MIGRATION_COUNT - ${#FAILED_MIGRATIONS[@]}))/${MIGRATION_COUNT}"
if [ ${#FAILED_MIGRATIONS[@]} -gt 0 ]; then
    echo -e "${RED}  失敗: ${#FAILED_MIGRATIONS[@]}${NC}"
    echo -e "${RED}  失敗的 migrations: ${FAILED_MIGRATIONS[*]}${NC}"
fi
echo ""

# ============================================================================
# Step 4: 驗證資料庫結構
# ============================================================================

echo -e "${YELLOW}[4/6] 驗證資料庫結構...${NC}"

# 檢查表數量
echo -e "${BLUE}檢查表數量...${NC}"
TABLE_COUNT=$(npx wrangler d1 execute "${DB_NAME}" --local --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'" --json 2>/dev/null | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")

echo "  預期: 67 個表"
echo "  實際: ${TABLE_COUNT} 個表"

if [ "$TABLE_COUNT" -eq "67" ]; then
    echo -e "${GREEN}  ✓ 表數量正確${NC}"
else
    echo -e "${YELLOW}  ! 表數量不符預期${NC}"
fi

# 檢查索引數量
echo -e "${BLUE}檢查索引數量...${NC}"
INDEX_COUNT=$(npx wrangler d1 execute "${DB_NAME}" --local --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'" --json 2>/dev/null | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")

echo "  預期: 461 個索引"
echo "  實際: ${INDEX_COUNT} 個索引"

if [ "$INDEX_COUNT" -eq "461" ]; then
    echo -e "${GREEN}  ✓ 索引數量正確${NC}"
else
    echo -e "${YELLOW}  ! 索引數量不符預期${NC}"
fi

# 檢查視圖數量
echo -e "${BLUE}檢查視圖數量...${NC}"
VIEW_COUNT=$(npx wrangler d1 execute "${DB_NAME}" --local --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='view'" --json 2>/dev/null | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")

echo "  預期: 60 個視圖"
echo "  實際: ${VIEW_COUNT} 個視圖"

if [ "$VIEW_COUNT" -eq "60" ]; then
    echo -e "${GREEN}  ✓ 視圖數量正確${NC}"
else
    echo -e "${YELLOW}  ! 視圖數量不符預期${NC}"
fi

# 檢查觸發器數量
echo -e "${BLUE}檢查觸發器數量...${NC}"
TRIGGER_COUNT=$(npx wrangler d1 execute "${DB_NAME}" --local --command="SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger'" --json 2>/dev/null | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")

echo "  預期: 108 個觸發器"
echo "  實際: ${TRIGGER_COUNT} 個觸發器"

if [ "$TRIGGER_COUNT" -eq "108" ]; then
    echo -e "${GREEN}  ✓ 觸發器數量正確${NC}"
else
    echo -e "${YELLOW}  ! 觸發器數量不符預期${NC}"
fi

echo ""
echo -e "${GREEN}✓ 資料庫結構驗證完成${NC}"
echo ""

# ============================================================================
# Step 5: 列出所有表
# ============================================================================

echo -e "${YELLOW}[5/6] 列出所有資料表...${NC}"
npx wrangler d1 execute "${DB_NAME}" --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name" 2>/dev/null | tee -a "${LOG_FILE}"
echo ""

# ============================================================================
# Step 6: 測試報告
# ============================================================================

echo -e "${YELLOW}[6/6] 生成測試報告...${NC}"

REPORT_FILE="docs/migrations_v2/TEST_REPORT_$(date +%Y%m%d-%H%M%S).md"
mkdir -p docs/migrations_v2

cat > "${REPORT_FILE}" << EOF
# MakanMakan Migrations v2.0 - 測試報告

**測試日期**: $(date +"%Y-%m-%d %H:%M:%S")
**測試資料庫**: ${DB_NAME}

---

## 測試結果總覽

| 項目 | 預期 | 實際 | 狀態 |
|------|------|------|------|
| Migrations 執行 | 16 | $((MIGRATION_COUNT - ${#FAILED_MIGRATIONS[@]})) | $([ ${#FAILED_MIGRATIONS[@]} -eq 0 ] && echo "✅" || echo "⚠️") |
| 資料表數量 | 67 | ${TABLE_COUNT} | $([ "$TABLE_COUNT" -eq "67" ] && echo "✅" || echo "⚠️") |
| 索引數量 | 461 | ${INDEX_COUNT} | $([ "$INDEX_COUNT" -eq "461" ] && echo "✅" || echo "⚠️") |
| 視圖數量 | 60 | ${VIEW_COUNT} | $([ "$VIEW_COUNT" -eq "60" ] && echo "✅" || echo "⚠️") |
| 觸發器數量 | 108 | ${TRIGGER_COUNT} | $([ "$TRIGGER_COUNT" -eq "108" ] && echo "✅" || echo "⚠️") |

---

## Migrations 執行詳情

成功: $((MIGRATION_COUNT - ${#FAILED_MIGRATIONS[@]}))/${MIGRATION_COUNT}

EOF

if [ ${#FAILED_MIGRATIONS[@]} -gt 0 ]; then
    echo "失敗的 Migrations:" >> "${REPORT_FILE}"
    for failed in "${FAILED_MIGRATIONS[@]}"; do
        echo "- ${failed}" >> "${REPORT_FILE}"
    done
else
    echo "所有 Migrations 執行成功 ✅" >> "${REPORT_FILE}"
fi

cat >> "${REPORT_FILE}" << EOF

---

## 詳細日誌

完整日誌請查看: \`${LOG_FILE}\`

EOF

echo -e "${GREEN}✓ 測試報告已生成: ${REPORT_FILE}${NC}"
echo ""

# ============================================================================
# 完成
# ============================================================================

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  測試執行完成！${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "測試報告: ${REPORT_FILE}"
echo -e "詳細日誌: ${LOG_FILE}"
echo ""

if [ ${#FAILED_MIGRATIONS[@]} -eq 0 ] && [ "$TABLE_COUNT" -eq "67" ]; then
    echo -e "${GREEN}✅ 所有測試通過！${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  部分測試未通過，請檢查日誌${NC}"
    exit 1
fi
