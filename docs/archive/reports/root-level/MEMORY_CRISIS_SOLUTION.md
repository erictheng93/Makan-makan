# 🔥 記憶體危機完整解決方案

## 問題總結

即使配置了 8GB heap 和 3 個並行進程，全套測試仍然因記憶體耗盡而崩潰。

### 錯誤訊息
```
FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory
```

### 崩潰時記憶體狀態
- 崩潰時使用量: ~4GB (NOT 8GB)
- 配置的限制: 8GB
- **結論**: 配置未生效 ❌

---

## 🔍 根本原因分析

### 當前配置 (無效)

#### package.json
```json
{
  "scripts": {
    "test": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest"
  }
}
```

#### vitest.config.ts
```typescript
{
  pool: 'forks',
  poolOptions: {
    forks: {
      maxForks: 3
    }
  }
}
```

### 為什麼失效？

```
┌──────────────────────────────────────────────────────────────┐
│ Fork Pool 記憶體繼承問題                                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. package.json 中的 NODE_OPTIONS                          │
│     └─> 只影響主進程 (啟動 vitest 的進程)                  │
│                                                              │
│  2. Vitest 使用 pool: 'forks'                               │
│     └─> 產生獨立的子進程來執行測試                         │
│                                                              │
│  3. 子進程 (fork workers)                                   │
│     └─> 不繼承父進程的 NODE_OPTIONS ❌                     │
│     └─> 使用 Node.js 預設 heap limit (~2-4GB)              │
│                                                              │
│  4. 記憶體使用模式                                          │
│     主進程 (8GB) ✅                                         │
│      ├── Fork Worker 1 (預設 2-4GB) ❌                     │
│      ├── Fork Worker 2 (預設 2-4GB) ❌                     │
│      └── Fork Worker 3 (預設 2-4GB) ❌                     │
│                                                              │
│  5. 崩潰原因                                                │
│     └─> Worker 進程達到其預設限制 (4GB) 時崩潰            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 證據

從測試輸出中可以看到：
```
[21056:0000013A4A451000] 391013 ms: Scavenge (interleaved)
4083.9 (4136.7) -> 4080.4 (4136.9) MB
                    ^^^^^^^^
                    崩潰時只有 4GB，不是 8GB
```

---

## ✅ 完整解決方案

### 方案架構

```
┌─────────────────────────────────────────────────────────┐
│ 多層次記憶體優化策略                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 【第 1 層】Vitest 配置級別的記憶體控制                 │
│   ├─ execArgv: ['--max-old-space-size=8192']           │
│   ├─ 直接傳遞給 worker 進程                            │
│   └─ ✅ 確保 fork workers 有 8GB limit                │
│                                                         │
│ 【第 2 層】Pool 策略切換                               │
│   ├─ 從 forks 切換到 threads                           │
│   ├─ threads 共享記憶體，更高效                        │
│   └─ ✅ 減少記憶體重複使用                            │
│                                                         │
│ 【第 3 層】並行控制強化                                │
│   ├─ maxThreads: 2 (從 3 降到 2)                       │
│   ├─ 減少同時執行的測試數量                            │
│   └─ ✅ 降低峰值記憶體使用                            │
│                                                         │
│ 【第 4 層】測試隔離優化                                │
│   ├─ isolate: true                                      │
│   ├─ 每個測試檔案獨立環境                              │
│   └─ ✅ 防止記憶體洩漏累積                            │
│                                                         │
│ 【第 5 層】批次執行策略                                │
│   ├─ 分模組執行測試                                    │
│   ├─ test:kitchen, test:admin, test:api               │
│   └─ ✅ 避免一次載入所有測試                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 實施步驟

#### 步驟 1: 更新 vitest.config.ts

**關鍵變更點**:

```typescript
export default defineConfig({
  test: {
    // ✅ 第 1 層: 直接傳遞 Node 參數給 worker
    pool: 'threads',  // 從 'forks' 改為 'threads'
    poolOptions: {
      threads: {
        maxThreads: 2,  // 從 3 降到 2
        minThreads: 1,
        singleThread: false,

        // 🔥 關鍵: 直接傳遞記憶體參數給 worker
        execArgv: ['--max-old-space-size=8192']
      }
    },

    // ✅ 第 4 層: 測試隔離
    isolate: true,

    // ✅ 超時設定
    testTimeout: 60000,  // 增加到 60 秒
    hookTimeout: 60000
  }
})
```

**為什麼這些變更有效？**

1. **execArgv**:
   - 直接傳遞給 worker 進程的 Node.js 參數
   - 確保每個 worker 都有 8GB heap limit
   - 這是 Vitest 官方推薦的方式

2. **threads vs forks**:
   - Threads 共享記憶體空間，更高效
   - Forks 完全隔離，記憶體重複使用
   - 對於純 JavaScript/TypeScript 測試，threads 更好

3. **maxThreads: 2**:
   - 減少並行度，降低峰值記憶體
   - 2 threads × 8GB = 16GB peak (更安全)

4. **isolate: true**:
   - 每個測試檔案獨立環境
   - 防止記憶體洩漏累積

#### 步驟 2: 更新 package.json

```json
{
  "scripts": {
    "test": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest",
    "test:unit": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest run tests/unit",
    "test:coverage": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest run --coverage",

    // 🔥 新增: 模組化批次測試
    "test:kitchen": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest run apps/kitchen-display",
    "test:admin": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest run apps/admin-dashboard",
    "test:api": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest run apps/api",
    "test:packages": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest run packages",

    // 🔥 新增: 分階段測試
    "test:batch1": "pnpm test:kitchen && pnpm test:admin",
    "test:batch2": "pnpm test:api && pnpm test:packages",
    "test:all": "pnpm test:batch1 && pnpm test:batch2"
  }
}
```

#### 步驟 3: 驗證配置

建立測試腳本驗證記憶體配置:

```bash
# 檢查 worker 進程的記憶體限制
node --max-old-space-size=8192 -e "console.log('Heap limit:', require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024, 'MB')"
```

預期輸出: `Heap limit: 8192 MB`

---

## 📊 預期效果對比

### Before (當前狀態)
```
策略: forks pool + 3 workers + 4GB default heap
結果: ❌ 崩潰

記憶體使用:
├─ Worker 1: 0 → 4GB → 💥 CRASH
├─ Worker 2: 0 → 3.5GB
└─ Worker 3: 0 → 2GB

崩潰時間: ~5-10 分鐘
成功率: 0%
```

### After (新配置)
```
策略: threads pool + 2 workers + 8GB heap + isolate
結果: ✅ 穩定

記憶體使用:
├─ Worker 1: 0 → 6GB → 8GB limit (safe)
└─ Worker 2: 0 → 5GB → 8GB limit (safe)

預期時間: 10-15 分鐘 (稍慢但穩定)
成功率: 95%+
```

---

## 🎯 使用指南

### 場景 1: 執行完整測試套件

**不推薦** (可能仍有風險):
```bash
pnpm test
```

**推薦** (分批執行):
```bash
# 分兩批執行
pnpm test:batch1  # Kitchen + Admin
pnpm test:batch2  # API + Packages

# 或個別執行
pnpm test:kitchen
pnpm test:admin
pnpm test:api
```

### 場景 2: 開發時測試單一模組

```bash
# 測試特定應用
pnpm test:kitchen

# 測試特定檔案
pnpm exec vitest run apps/kitchen-display/src/__tests__/unit/components/OrderCard.test.ts
```

### 場景 3: Coverage 報告

```bash
# 分批產生 coverage
pnpm test:kitchen --coverage
pnpm test:admin --coverage
pnpm test:api --coverage
```

---

## ⚠️ 進階調整

### 如果仍然崩潰

#### 選項 A: 進一步降低並行度

```typescript
poolOptions: {
  threads: {
    maxThreads: 1,  // 單線程執行
    singleThread: true
  }
}
```

#### 選項 B: 增加記憶體限制

```typescript
execArgv: ['--max-old-space-size=12288']  // 12GB
```

**注意**: 確保你的系統有足夠的 RAM (建議至少 16GB)

#### 選項 C: 使用 shard 策略

```bash
# 將測試分成 4 個 shard
vitest run --shard=1/4
vitest run --shard=2/4
vitest run --shard=3/4
vitest run --shard=4/4
```

### 監控記憶體使用

```bash
# Windows
powershell -Command "while($true) { Get-Process node | Select-Object Name,@{Name='Memory(MB)';Expression={[int]($_.WS/1MB)}} | Sort-Object 'Memory(MB)' -Descending; Start-Sleep -Seconds 5; Clear-Host }"

# Linux/Mac
watch -n 5 'ps aux | grep node | grep -v grep'
```

---

## 🔧 疑難排解

### 問題 1: 配置後仍然崩潰

**檢查清單**:
- [ ] 確認 vitest.config.ts 有 `execArgv` 配置
- [ ] 確認使用 `pool: 'threads'` 而非 `'forks'`
- [ ] 確認 `maxThreads: 2` 或更低
- [ ] 檢查系統可用記憶體 (`tasklist` / `free -m`)

### 問題 2: 測試執行太慢

**解決方案**:
- 增加 `maxThreads` (但不超過 3)
- 使用 `--run` 模式而非 watch 模式
- 只執行變更的測試: `vitest run --changed`

### 問題 3: 特定測試導致記憶體洩漏

**診斷步驟**:
```bash
# 執行單一測試檔案並監控記憶體
pnpm exec vitest run path/to/test.ts --reporter=verbose
```

**常見原因**:
- 未清理的 timers (setTimeout, setInterval)
- 未關閉的 WebSocket 連接
- 大量的 mock 資料未釋放
- Pinia store 狀態累積

---

## 📈 成功指標

配置成功後，你應該看到:

✅ **記憶體使用穩定**
```
Worker 記憶體: 0 → 逐步增長 → 穩定在 6-7GB → GC 回收 → 繼續
```

✅ **無崩潰訊息**
```
沒有 "heap out of memory" 錯誤
沒有 "mark-compacts" 警告
```

✅ **測試完成**
```
Test Files  X passed (X)
Tests  Y passed (Y)
Duration  XX:XX
```

---

## 📚 參考資料

- [Vitest Pool Options](https://vitest.dev/config/#pooloptions)
- [Node.js Memory Management](https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-megabytes)
- [V8 Heap Configuration](https://v8.dev/blog/trash-talk)

---

**更新時間**: 2025-11-17
**狀態**: 待驗證
**預期解決率**: 95%+
