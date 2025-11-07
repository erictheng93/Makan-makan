# 🧪 MakanMakan Migrations v2.0 - 測試指南

> 完整的測試流程與驗證步驟

---

## 📋 目錄

1. [測試總覽](#測試總覽)
2. [環境準備](#環境準備)
3. [執行測試](#執行測試)
4. [測試腳本說明](#測試腳本說明)
5. [預期結果](#預期結果)
6. [疑難排解](#疑難排解)

---

## 測試總覽

### 測試目標

```
✅ 驗證所有 16 個 migrations 可以正確執行
✅ 確認資料庫結構完整性 (表、索引、視圖、觸發器)
✅ 測試資料完整性約束 (外鍵、CHECK、UNIQUE)
✅ 驗證觸發器功能正常
✅ 測試查詢效能與索引效果
✅ 確保視圖可正常查詢
```

### 測試層級

```
┌─────────────────────────────────────────┐
│         測試金字塔結構                  │
└─────────────────────────────────────────┘

Level 3: 效能測試 🚀
  ├─ 查詢效能基準
  ├─ 索引使用驗證
  └─ 複雜查詢優化
        ↓
Level 2: 整合測試 🔗
  ├─ 觸發器功能測試
  ├─ 視圖查詢測試
  └─ 業務邏輯測試
        ↓
Level 1: 基礎測試 ✅
  ├─ Migrations 執行
  ├─ 結構驗證
  └─ 約束測試
```

---

## 環境準備

### 必要條件

```bash
# 1. Node.js 20+
node --version  # 應該顯示 v20.x.x 或更高

# 2. pnpm (推薦) 或 npm
pnpm --version

# 3. Wrangler CLI
npx wrangler --version
```

### 安裝依賴

```bash
# 安裝專案依賴
pnpm install

# 登入 Cloudflare (如果尚未登入)
npx wrangler login
```

---

## 執行測試

### 🎯 快速開始 (全自動測試)

**Windows (PowerShell)**:
```powershell
# 執行完整測試套件
.\scripts\test-migrations-v2.ps1
```

**Linux/Mac (Bash)**:
```bash
# 賦予執行權限
chmod +x scripts/test-migrations-v2.sh

# 執行完整測試套件
./scripts/test-migrations-v2.sh
```

這個腳本會自動執行:
1. ✅ 創建測試資料庫
2. ✅ 執行所有 16 個 migrations
3. ✅ 驗證資料庫結構
4. ✅ 列出所有表
5. ✅ 生成測試報告

---

### 📝 逐步測試 (手動執行)

#### Step 1: 創建測試資料庫

```bash
# 創建本地測試資料庫
npx wrangler d1 create makanmakan-test-v2

# 或使用遠端資料庫 (可選)
npx wrangler d1 create makanmakan-test-v2 --env staging
```

#### Step 2: 執行 Migrations

```bash
# 執行單一 migration
npx wrangler d1 execute makanmakan-test-v2 --local \
  --file=packages/database/migrations_v2/01_tenants_and_settings.sql

# 或執行所有 migrations (循環)
for file in packages/database/migrations_v2/*.sql; do
  echo "Executing $file..."
  npx wrangler d1 execute makanmakan-test-v2 --local --file="$file"
done
```

#### Step 3: 驗證資料庫結構

```bash
# 檢查表數量 (預期: 67)
npx wrangler d1 execute makanmakan-test-v2 --local \
  --command="SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"

# 檢查索引數量 (預期: 461)
npx wrangler d1 execute makanmakan-test-v2 --local \
  --command="SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"

# 檢查視圖數量 (預期: 60)
npx wrangler d1 execute makanmakan-test-v2 --local \
  --command="SELECT COUNT(*) FROM sqlite_master WHERE type='view'"

# 檢查觸發器數量 (預期: 108)
npx wrangler d1 execute makanmakan-test-v2 --local \
  --command="SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'"
```

#### Step 4: 資料完整性測試

```bash
# 執行完整性測試 SQL
npx wrangler d1 execute makanmakan-test-v2 --local \
  --file=scripts/test-data-integrity.sql
```

#### Step 5: 效能基準測試

```bash
# 執行效能測試 SQL
npx wrangler d1 execute makanmakan-test-v2 --local \
  --file=scripts/test-performance.sql
```

---

## 測試腳本說明

### 1. test-migrations-v2.ps1 / .sh

**用途**: 自動化測試主腳本

**功能**:
- ✅ 環境檢查 (Node.js, Wrangler)
- ✅ 創建測試資料庫
- ✅ 循序執行所有 16 個 migrations
- ✅ 驗證資料庫結構
- ✅ 生成測試報告

**輸出**:
- 終端機即時輸出
- 日誌檔案: `logs/migration-test-YYYYMMDD-HHMMSS.log`
- 測試報告: `docs/migrations_v2/TEST_REPORT_YYYYMMDD-HHMMSS.md`

**使用時機**: 第一次執行或完整驗證

---

### 2. test-data-integrity.sql

**用途**: 資料完整性與約束測試

**測試項目**:
```
✅ Test 1: 基礎資料插入
✅ Test 2: 外鍵約束 (FOREIGN KEY)
✅ Test 3: CHECK 約束
✅ Test 4: UNIQUE 約束
✅ Test 5: updated_at 觸發器
✅ Test 6: 業務邏輯觸發器
✅ Test 7: 視圖查詢
✅ Test 8: 軟刪除機制
✅ Test 9: 審計日誌
✅ Test 10: 複雜查詢
```

**特點**:
- 自動創建測試資料
- 執行完畢自動清理
- 驗證級聯刪除

**使用時機**: 驗證資料完整性

---

### 3. test-performance.sql

**用途**: 效能基準測試與索引驗證

**測試項目**:
```
✅ Test 1: 基礎單表查詢
✅ Test 2: JOIN 查詢
✅ Test 3: 聚合查詢 (COUNT, GROUP BY)
✅ Test 4: 視圖查詢
✅ Test 5: 索引使用驗證
✅ Test 6: 實際業務查詢
```

**特點**:
- 使用 EXPLAIN QUERY PLAN 分析查詢
- 驗證索引是否被使用
- 識別全表掃描問題

**使用時機**: 效能優化與索引驗證

---

## 預期結果

### ✅ 成功標準

#### 1. Migrations 執行

```
預期結果:
✅ 16/16 migrations 執行成功
✅ 0 個失敗
✅ 無 SQL 語法錯誤
```

#### 2. 資料庫結構

```
預期數量:
✅ 表 (Tables): 67
✅ 索引 (Indexes): 461
✅ 視圖 (Views): 60
✅ 觸發器 (Triggers): 108
```

#### 3. 資料完整性測試

```
預期通過率:
✅ 外鍵約束: 100%
✅ CHECK 約束: 100%
✅ UNIQUE 約束: 100%
✅ 觸發器功能: 100%
✅ 級聯刪除: 100%
```

#### 4. 效能測試

```
預期行為:
✅ 主鍵查詢: 使用 PRIMARY KEY
✅ 索引查詢: 使用 COVERING INDEX
✅ JOIN 查詢: 使用 AUTOMATIC INDEX (合理)
✅ 無不必要的全表掃描
```

---

### ⚠️ 常見問題

#### 問題 1: Migration 執行失敗

```
錯誤訊息:
Error: table "xxx" already exists
```

**原因**: 資料庫已存在舊資料

**解決方案**:
```bash
# 刪除測試資料庫重新開始
npx wrangler d1 delete makanmakan-test-v2

# 或使用新的資料庫名稱
npx wrangler d1 create makanmakan-test-v2-new
```

---

#### 問題 2: 表/索引數量不符

```
預期: 67 表
實際: 65 表
```

**原因**: 部分 migrations 未執行成功

**解決方案**:
1. 檢查日誌檔案找出失敗的 migration
2. 手動執行失敗的 migration
3. 查看詳細錯誤訊息

```bash
# 查看詳細錯誤
npx wrangler d1 execute makanmakan-test-v2 --local \
  --file=packages/database/migrations_v2/XX_failed_migration.sql
```

---

#### 問題 3: 觸發器未觸發

```
測試失敗: updated_at 未更新
```

**原因**: SQLite 觸發器需要特定條件

**檢查方式**:
```sql
-- 列出所有觸發器
SELECT name, tbl_name FROM sqlite_master
WHERE type = 'trigger'
ORDER BY tbl_name;

-- 查看觸發器定義
SELECT sql FROM sqlite_master
WHERE type = 'trigger' AND name = 'trg_restaurants_updated_at';
```

---

#### 問題 4: 效能測試顯示全表掃描

```
EXPLAIN QUERY PLAN: SCAN TABLE users
```

**原因**: 索引未被使用或不存在

**檢查方式**:
```sql
-- 檢查表的索引
SELECT name FROM sqlite_master
WHERE type = 'index' AND tbl_name = 'users';

-- 確認索引定義
SELECT sql FROM sqlite_master
WHERE type = 'index' AND name = 'idx_users_restaurant';
```

---

## 疑難排解

### Debug 模式

**啟用詳細日誌**:
```bash
# 設定環境變數
export DEBUG=1  # Linux/Mac
$env:DEBUG=1    # Windows PowerShell

# 執行測試
./scripts/test-migrations-v2.sh
```

### 查看 SQLite 資料庫

**使用 SQLite CLI**:
```bash
# 找到 .wrangler/state/v3/d1 資料庫檔案
sqlite3 .wrangler/state/v3/d1/<database-id>.sqlite

# SQLite 命令
.tables          # 列出所有表
.schema users    # 查看表結構
.indexes users   # 查看表索引
```

### 重置測試環境

**完全清理**:
```bash
# 1. 刪除測試資料庫
npx wrangler d1 delete makanmakan-test-v2

# 2. 清除 .wrangler 緩存
rm -rf .wrangler/state  # Linux/Mac
Remove-Item -Recurse -Force .wrangler\state  # Windows

# 3. 重新開始測試
./scripts/test-migrations-v2.sh
```

---

## 測試報告解讀

### 報告結構

```markdown
# MakanMakan Migrations v2.0 - 測試報告

**測試日期**: 2025-10-30 22:00:00
**測試資料庫**: makanmakan-test-v2

## 測試結果總覽

| 項目 | 預期 | 實際 | 狀態 |
|------|------|------|------|
| Migrations 執行 | 16 | 16 | ✅ |
| 資料表數量 | 67 | 67 | ✅ |
| 索引數量 | 461 | 461 | ✅ |
| 視圖數量 | 60 | 60 | ✅ |
| 觸發器數量 | 108 | 108 | ✅ |
```

### 狀態圖示說明

- ✅ **通過**: 符合預期，測試成功
- ⚠️ **警告**: 有差異但可接受
- ❌ **失敗**: 未達預期，需要修復

---

## 下一步

測試通過後，可以進行:

1. **Staging 環境部署**
   ```bash
   # 執行到 staging 環境
   ./scripts/deploy-staging.sh
   ```

2. **資料遷移準備**
   ```bash
   # 開發資料遷移腳本
   # 見: docs/migrations_v2/DATA_MIGRATION_PLAN.md
   ```

3. **Production 部署計劃**
   ```bash
   # 準備 production 部署
   # 見: docs/migrations_v2/DEPLOYMENT_PLAN.md
   ```

---

## 相關文檔

- [README.md](../../packages/database/migrations_v2/README.md) - Migrations 總覽
- [PROGRESS_REPORT_FINAL.md](./PROGRESS_REPORT_FINAL.md) - 最終完成報告
- [DATABASE_REFACTORING_PLAN.md](../DATABASE_REFACTORING_PLAN.md) - 重構計劃

---

**文檔版本**: 1.0
**最後更新**: 2025-10-30
**狀態**: ✅ Ready for Testing
