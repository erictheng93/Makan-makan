# 📚 MakanMakan Database Migrations v2.0

> 模組化、清晰、可維護的資料庫架構

---

## 🎯 總覽

這是 MakanMakan 的全新模組化資料庫架構，採用分層設計，每個模組職責清晰，易於理解和維護。

### 架構設計原則

```
✅ 模組化優先      - 每個功能獨立 migration
✅ 資料一致性      - 統一的資料類型和命名規範
✅ 清晰的依賴關係  - 6 層架構，單向依賴
✅ 完整的約束      - 外鍵、CHECK、唯一性
✅ 效能優化        - 合理的索引策略
✅ 未來擴展性      - 預留擴展欄位
```

---

## 📊 架構總覽

```
┌─────────────────────────────────────────────────────────┐
│                  MakanMakan v2.0 架構                    │
└─────────────────────────────────────────────────────────┘

Layer 6 (進階功能) - 3 個 migrations
  ├─ 14_inventory_management.sql
  ├─ 15_promotions_and_coupons.sql
  └─ 16_loyalty_program.sql
          ↓
Layer 5 (分析層) - 2 個 migrations
  ├─ 12_business_analytics.sql
  └─ 13_ai_insights.sql
          ↓
Layer 4 (員工管理) - 3 個 migrations
  ├─ 09_shift_scheduling.sql
  ├─ 10_leave_management.sql
  └─ 11_attendance_tracking.sql
          ↓
Layer 3 (空間管理) - 2 個 migrations
  ├─ 07_table_and_seating.sql
  └─ 08_qr_code_system.sql
          ↓
Layer 2 (核心業務) - 3 個 migrations
  ├─ 04_product_catalog.sql
  ├─ 05_order_management.sql
  └─ 06_customer_management.sql
          ↓
Layer 1 (基礎層) - 3 個 migrations ✅ COMPLETED
  ├─ 01_tenants_and_settings.sql    ✅
  ├─ 02_authentication.sql          ✅
  └─ 03_audit_system.sql            ✅
```

---

## 📋 Migration 清單

### ✅ Layer 1: 基礎層 (Foundation) - COMPLETED

| Migration                     | 狀態 | 表數 | 說明                         |
| ----------------------------- | ---- | ---- | ---------------------------- |
| `01_tenants_and_settings.sql` | ✅   | 2    | 餐廳管理、多租戶、訂閱       |
| `02_authentication.sql`       | ✅   | 4    | 用戶、會話、認證、權限       |
| `03_audit_system.sql`         | ✅   | 3    | 審計日誌、錯誤報告、變更歷史 |

**總計**: 9 個表，57 個索引，8 個視圖，5 個觸發器

---

### ✅ Layer 2: 核心業務層 (Core Business) - COMPLETED

| Migration                    | 狀態 | 表數 | 說明                       |
| ---------------------------- | ---- | ---- | -------------------------- |
| `04_product_catalog.sql`     | ✅   | 6    | 分類、菜單、選項、標籤     |
| `05_order_management.sql`    | ✅   | 3    | 訂單、訂單項目、付款       |
| `06_customer_management.sql` | ✅   | 4    | 顧客資料、地址、偏好、最愛 |

**總計**: 13 個表，84 個索引，11 個視圖，28 個觸發器

---

### ✅ Layer 3: 空間管理層 (Space Management) - COMPLETED

| Migration                  | 狀態 | 表數 | 說明                       |
| -------------------------- | ---- | ---- | -------------------------- |
| `07_table_and_seating.sql` | ✅   | 4    | 區域、桌位、座位、預訂     |
| `08_qr_code_system.sql`    | ✅   | 4    | QR 模板、QR 碼、批次、掃描 |

**總計**: 8 個表，76 個索引，8 個視圖，20 個觸發器

---

### ✅ Layer 4: 員工管理層 (Employee Management) - COMPLETED

| Migration                    | 狀態 | 表數 | 說明                         |
| ---------------------------- | ---- | ---- | ---------------------------- |
| `09_shift_scheduling.sql`    | ✅   | 6    | 排班、班別、換班、規則、衝突 |
| `10_leave_management.sql`    | ✅   | 5    | 請假、假別、審批、餘額、日曆 |
| `11_attendance_tracking.sql` | ✅   | 3    | 打卡、考勤、加班、工時統計   |

**總計**: 14 個表，111 個索引，12 個視圖，24 個觸發器

---

### ✅ Layer 5: 分析層 (Analytics) - COMPLETED

| Migration                   | 狀態 | 表數 | 說明                |
| --------------------------- | ---- | ---- | ------------------- |
| `12_business_analytics.sql` | ✅   | 4    | 業務指標、報表、KPI |
| `13_ai_insights.sql`        | ✅   | 4    | AI 配置、洞察、預測 |

**總計**: 8 個表，39 個索引，8 個視圖，10 個觸發器

---

### ✅ Layer 6: 進階功能層 (Advanced Features) - COMPLETED

| Migration                       | 狀態 | 表數 | 說明               |
| ------------------------------- | ---- | ---- | ------------------ |
| `14_inventory_management.sql`   | ✅   | 5    | 庫存、供應商、採購 |
| `15_promotions_and_coupons.sql` | ✅   | 5    | 促銷、優惠券、活動 |
| `16_loyalty_program.sql`        | ✅   | 5    | 會員、積分、獎勵   |

**總計**: 15 個表，94 個索引，15 個視圖，21 個觸發器

---

## 🎨 統一資料標準

### ID 策略

```sql
-- 統一使用 TEXT 類型的 UUID
id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))

-- 外鍵引用
restaurant_id TEXT NOT NULL
FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
```

### 時間戳策略

```sql
-- 統一使用 INTEGER 類型的 Unix timestamp (毫秒)
created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
deleted_at INTEGER  -- 軟刪除
```

### 布爾值策略

```sql
-- 統一使用 INTEGER (0/1) + CHECK 約束
is_active INTEGER NOT NULL DEFAULT 1
CHECK (is_active IN (0, 1))
```

### JSON 欄位策略

```sql
-- 所有 JSON 欄位使用 TEXT 類型，預設為有效 JSON
settings TEXT DEFAULT '{}'
preferences TEXT DEFAULT '[]'
metadata TEXT DEFAULT '{}'
```

---

## 📁 文件結構

```
migrations_v2/
├── README.md                          ← 你在這裡
├── 01_tenants_and_settings.sql        ✅ 完成
├── 02_authentication.sql               ✅ 完成
├── 03_audit_system.sql                 ✅ 完成
├── 04_product_catalog.sql              ✅ 完成
├── 05_order_management.sql             ✅ 完成
├── 06_customer_management.sql          ✅ 完成
├── 07_table_and_seating.sql            ✅ 完成
├── 08_qr_code_system.sql               ✅ 完成
├── 09_shift_scheduling.sql             ✅ 完成
├── 10_leave_management.sql             ✅ 完成
├── 11_attendance_tracking.sql          ✅ 完成
├── 12_business_analytics.sql           ✅ 完成
├── 13_ai_insights.sql                  ✅ 完成
├── 14_inventory_management.sql         ✅ 完成
├── 15_promotions_and_coupons.sql       ✅ 完成
└── 16_loyalty_program.sql              ✅ 完成
```

---

## 🚀 使用方法

### 本地開發

```bash
# 1. 創建測試資料庫
npx wrangler d1 create makanmakan-test-v2

# 2. 執行 Layer 1 migrations
npx wrangler d1 execute makanmakan-test-v2 --file=migrations_v2/01_tenants_and_settings.sql
npx wrangler d1 execute makanmakan-test-v2 --file=migrations_v2/02_authentication.sql
npx wrangler d1 execute makanmakan-test-v2 --file=migrations_v2/03_audit_system.sql

# 3. 驗證
npx wrangler d1 execute makanmakan-test-v2 --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### Staging 部署

```bash
# 執行所有 migrations (按順序)
for file in migrations_v2/*.sql; do
  echo "Executing $file..."
  npx wrangler d1 execute makanmasak-staging --file="$file" --env staging
done
```

### Production 部署

```bash
# ⚠️ 謹慎操作！先備份！
./scripts/migration-v2/backup-database.sh production

# 執行 migrations
npx wrangler d1 execute makanmakan-prod --file=migrations_v2/01_tenants_and_settings.sql --env production
# ... 依次執行其他 migrations
```

---

## ✅ 驗證清單

### Layer 1 驗證 ✅

```sql
-- 1. 檢查表是否創建
SELECT name FROM sqlite_master WHERE type='table'
ORDER BY name;

-- 預期: 9 個表
-- audit_logs, change_history, email_verification_tokens,
-- error_reports, password_reset_tokens, restaurant_settings,
-- restaurants, sessions, users

-- 2. 檢查索引
SELECT name FROM sqlite_master WHERE type='index'
ORDER BY name;

-- 預期: 57 個索引

-- 3. 檢查視圖
SELECT name FROM sqlite_master WHERE type='view'
ORDER BY name;

-- 預期: 8 個視圖

-- 4. 測試插入餐廳
INSERT INTO restaurants (name, slug, business_type, phone, address_line1, city, country)
VALUES ('Test Restaurant', 'test-restaurant', 'restaurant', '0912345678', '123 Test St', 'Taichung', 'TW');

-- 5. 測試插入用戶
INSERT INTO users (restaurant_id, username, full_name, password_hash, role)
SELECT id, 'testuser', 'Test User', 'test_hash', 'owner'
FROM restaurants WHERE slug = 'test-restaurant';

-- 6. 測試審計日誌
INSERT INTO audit_logs (restaurant_id, user_id, action, resource_type, description, category)
SELECT r.id, u.id, 'create', 'users', 'Created test user', 'auth'
FROM restaurants r
JOIN users u ON r.id = u.restaurant_id
WHERE r.slug = 'test-restaurant';
```

---

## 📊 進度追蹤

```
總進度: ████████████████████ 100% (16/16 完成) 🎉✨

Layer 1: ████████████████████ 100% (3/3) ✅
Layer 2: ████████████████████ 100% (3/3) ✅
Layer 3: ████████████████████ 100% (2/2) ✅
Layer 4: ████████████████████ 100% (3/3) ✅
Layer 5: ████████████████████ 100% (2/2) ✅
Layer 6: ████████████████████ 100% (3/3) ✅
```

---

## 🐛 已知問題

目前沒有已知問題。

---

## 🔧 維護指南

### 新增 Migration

1. 確定正確的 Layer
2. 使用標準模板
3. 遵循命名規範
4. 加入完整註釋
5. 執行驗證測試

### 修改現有 Migration

⚠️ **不要修改已部署的 migrations**

如果需要修改：

1. 創建新的 migration
2. 說明變更原因
3. 提供回滾方案

---

## 📚 相關文檔

- **重構計劃**: `docs/DATABASE_REFACTORING_PLAN.md`
- **架構對比**: `docs/DATABASE_ARCHITECTURE_COMPARISON.md`
- **執行摘要**: `docs/DATABASE_REFACTORING_EXECUTIVE_SUMMARY.md`
- **執行日誌**: `docs/migrations_v2/EXECUTION_LOG.md`

---

## 🎊 專案總結

### 最終統計

```
📊 總表數: 67 個表
📈 總索引數: 461 個索引
👁️ 總視圖數: 60 個視圖
⚡ 總觸發器數: 108 個觸發器
📄 總程式碼行數: ~10,000+ 行 SQL
```

### 各層統計

| Layer             | Tables | Indexes | Views  | Triggers | Status |
| ----------------- | ------ | ------- | ------ | -------- | ------ |
| Layer 1: 基礎層   | 9      | 57      | 8      | 5        | ✅     |
| Layer 2: 核心業務 | 13     | 84      | 11     | 28       | ✅     |
| Layer 3: 空間管理 | 8      | 76      | 8      | 20       | ✅     |
| Layer 4: 員工管理 | 14     | 111     | 12     | 24       | ✅     |
| Layer 5: 分析層   | 8      | 39      | 8      | 10       | ✅     |
| Layer 6: 進階功能 | 15     | 94      | 15     | 21       | ✅     |
| **總計**          | **67** | **461** | **60** | **108**  | ✅     |

---

**狀態**: 🎉 **COMPLETED** | 100% Finished!
**最後更新**: 2025-10-30 22:00
**下一步**: 測試驗證 → 資料遷移 → Production 部署
