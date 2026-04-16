# Stakeholder Personas & Test Matrix / 利益人與測試矩陣

> 本文件系統性盤點 MakanMakan 所有利益人（stakeholder）的身份、目標、關鍵操作、邊界情境，並將每條情境綁定到對應測試檔，以最大化 edge case 覆蓋與風險控制。
>
> **定位**：這份文件是「測試覆蓋的藍圖」，不是教學文件。每個 Edge Case 後面都必須帶一個測試檔路徑；沒有測試對應的項目進 Backlog。

---

## 0. 如何使用這份文件

### 0.1 使用對象

| 角色        | 使用方式                                                 |
| ----------- | -------------------------------------------------------- |
| 測試工程師  | 寫新測試前，先查對應 Persona 的 Edge Case 是否已覆蓋     |
| 功能開發者  | 開 PR 前，對照 Persona 的「關鍵操作」檢查是否遺漏情境    |
| Code Reviewer | PR Review 時檢查新功能是否影響 Persona 邊界，並要求測試 |
| PM / QA     | 規劃 Release 時識別受影響 Persona，安排對應回歸測試      |

### 0.2 維護規則

- 每新增一個 E2E spec 檔，必須在對應 Persona 的「Edge Cases」表格中建立連結
- 新增功能 PR 若新增使用者流程，必須同步更新相關 Persona
- 每季度 Retro 檢查：哪些 Edge Case 長期沒有測試 → 列入下季度 Test Roadmap
- 發生線上事故（incident）時，對應 Edge Case 加註 `⚠️ incident-YYYY-MM-DD` 標記並優先補測試

### 0.3 風險分級

| 等級 | 定義                                           | 補測試時機             |
| ---- | ---------------------------------------------- | ---------------------- |
| 🔴 P0 | 金流、資料遺失、安全漏洞、RBAC 繞過            | 上線前必測，缺失即 Block |
| 🟠 P1 | 核心業務流程中斷（下單、接單、出餐、結帳）     | 當季補齊                |
| 🟡 P2 | 使用體驗降級但有 workaround                    | 納入下季 Roadmap        |
| ⚪ P3 | 邊緣情境、低機率                               | Backlog，有空再補       |

### 0.4 與程式碼對齊

本文件的 Persona 命名與 `tests/e2e/helpers/personas.ts` 的 `PERSONAS` const、`apps/api/src/shared/constants/index.ts` 的 `USER_ROLES` 保持一致：

```
ADMIN (0) · OWNER (1) · CHEF (2) · SERVICE_CREW (3) · CASHIER (4) · CUSTOMER (5)
```

---

## 1. Persona 總覽

| Code          | 角色         | Role ID | 主要介面              | 最高風險區             |
| ------------- | ------------ | ------- | --------------------- | ---------------------- |
| `ADMIN`       | 系統管理員   | 0       | admin-dashboard       | 跨店資料洩漏、權限繞過 |
| `OWNER`       | 店主         | 1       | admin-dashboard       | 營收資料、員工管理     |
| `CHEF`        | 廚師         | 2       | kitchen-display       | 訂單狀態流轉           |
| `SERVICE_CREW`| 送餐員       | 3       | kitchen-display (POS) | 訂單送達狀態、桌號錯誤 |
| `CASHIER`     | 收銀員       | 4       | admin-dashboard (POS) | **金流**、交班結帳     |
| `CUSTOMER`    | 顧客（註冊） | 5       | customer-app          | 訂單、付款、外送地址   |
| `GUEST`       | 訪客（未註冊）| —      | customer-app (QR)     | Token 過期、匿名下單   |

> 📌 **Guest** 雖不在 `USER_ROLES` 內，但在 QR 掃碼場景是主要使用者，單獨列一節（§ 8）。

---

## 2. CUSTOMER（顧客 / 註冊會員）— Role 5

### 2.1 身份 / 目標

- **身份**：下載 App 或開啟 customer-app 的註冊使用者，擁有會員帳號、收藏、優惠券
- **核心目標**：在餐廳掃 QR 點餐、外帶、外送；追蹤訂單、累積點數
- **心智模型**：像 UberEats / Foodpanda 的使用者，期待流程順暢、付款安全

### 2.2 關鍵操作

| 類別    | 操作                                                       |
| ------- | ---------------------------------------------------------- |
| 瀏覽    | 掃 QR 進店 / 開 App 瀏覽店家列表 / 搜尋 / 分類篩選          |
| 下單    | 加購物車、修改數量、選客製化、輸入備註、送出訂單            |
| 付款    | 信用卡、行動支付、貨到付款、貨到後補付                      |
| 訂單追蹤 | 看即時狀態（pending → preparing → ready → delivered）       |
| 帳號    | 註冊、登入、忘記密碼、修改個資、地址管理                    |
| 社交    | 收藏店家、優惠券領取/使用、評價、回饋                       |

### 2.3 Edge Cases（完整骨架 · 作為其他 Persona 的範例模板）

| # | 情境                                      | 風險 | 預期行為                                    | 對應測試 |
|---|-------------------------------------------|------|---------------------------------------------|----------|
| 1 | QR Token 過期後掃碼                       | 🟠 P1 | 提示重新掃碼，不得進入下單流程              | `tests/e2e/journeys/customer/qr-expiry.spec.ts` |
| 2 | 加入購物車時商品剛被店家下架              | 🔴 P0 | Checkout 時阻擋，顯示「已下架」並移除       | `tests/e2e/journeys/customer/stock-validation.spec.ts` |
| 3 | 送出訂單當下庫存歸零                      | 🔴 P0 | 回傳 409，購物車保留，讓 User 重新選擇      | `tests/e2e/journeys/customer/stock-validation.spec.ts` |
| 4 | 付款過程網路斷線                          | 🔴 P0 | 不得重複扣款；恢復後狀態正確回復             | `tests/e2e/journeys/customer/error-recovery.spec.ts` |
| 5 | 同時在兩台裝置下單                        | 🟠 P1 | 兩筆都成立、各自獨立；購物車不互相覆寫       | `tests/e2e/journeys/cross-role/concurrent-operations.spec.ts` |
| 6 | 外送地址超出配送區                        | 🟠 P1 | 結帳前擋下，提示範圍外                       | `tests/e2e/journeys/customer/delivery-zone.spec.ts` |
| 7 | 下單後想取消                              | 🟠 P1 | pending/preparing 可取消；ready 後不可       | `tests/e2e/journeys/customer/order-cancellation.spec.ts` |
| 8 | JWT 過期（背景 tab 很久）                  | 🟡 P2 | Silent refresh；失敗才導回登入               | `tests/e2e/journeys/customer/auth-guard.spec.ts` |
| 9 | 追加訂單（已下單的桌再點）                | 🟡 P2 | 同桌訂單合併、廚房端看到 append 區塊         | `tests/e2e/journeys/customer/append-order.spec.ts` |
| 10 | 輸入超長商品備註 / SQL / XSS              | 🔴 P0 | 後端 sanitize；前端 escape；不破壞廚房顯示  | ❌ **Backlog** — 需新增 `customer/malicious-input.spec.ts` |
| 11 | 同時多人使用同一桌 QR（拼桌）              | 🟡 P2 | 兩人都能下單，訂單歸屬桌而非人               | ❌ **Backlog** |
| 12 | 切換語系 / 時區後下單                      | ⚪ P3 | 金額、時間顯示正確                           | ❌ **Backlog** |

### 2.4 濫用 / 惡意情境

- **重複提交**：10 秒內連點 20 次送出 → 只能成立 1 筆（idempotency key）
- **偽造 tableId**：掃 A 店 QR，改 URL tableId 指向 B 店 → 後端驗證 restaurantId 綁定
- **客製化塞毒**：options JSON 塞入超大 payload → payload size limit
- **刷優惠券**：同一券在多訂單重複使用 → server-side atomic check

### 2.5 跨角色互動

- → `CHEF`：顧客下單後 ≤ 2s 內廚房 WS 收到（見 § 4 Edge #2）
- → `SERVICE_CREW`：送達狀態顧客端立即更新（見 § 5）
- → `CASHIER`：貨到付款時金額必須對上（見 § 6 Edge #3）

---

## 3. OWNER（店主）— Role 1

### 3.1 身份 / 目標

- **身份**：擁有一間或多間餐廳的業主，是這個系統的付費客戶
- **核心目標**：管理菜單、看營收報表、管理員工、設定營業時間、調整優惠
- **心智模型**：熟悉 POS 但不一定懂技術，容忍度低 — 壞一次可能客訴一整天

### 3.2 關鍵操作

| 類別     | 操作                                                   |
| -------- | ------------------------------------------------------ |
| 菜單     | 新增/編輯/下架品項、分類排序、上傳圖片、批次改價       |
| 桌號     | 生成桌號 QR、批次列印、開關桌、設定容量                |
| 員工     | 建立員工帳號、指派角色、請假審核、排班                 |
| 營收     | 日/週/月報表、單品銷售排行、熱門時段分析               |
| 設定     | 營業時間、休假日、稅率、外送費、最低消費、付款方式開關 |
| 多店切換 | 切換到名下其他餐廳                                     |
| 優惠     | 建立/停用優惠券、會員等級設定                          |

### 3.3 Edge Cases（高風險示範 + 其他項目列大綱）

| # | 情境                                        | 風險 | 預期行為                                      | 對應測試 |
|---|---------------------------------------------|------|-----------------------------------------------|----------|
| 1 | 切換到另一家餐廳後，URL 還是舊店的資源       | 🔴 P0 | 不得讀取；restaurantId 權限檢查               | `tests/e2e/admin/restaurant-switching.spec.ts` |
| 2 | 下架品項時該品項在進行中訂單內                | 🟠 P1 | 已下單的不受影響；新訂單擋下                 | `tests/e2e/admin/menu-management.spec.ts` |
| 3 | 上傳 > 10MB 圖片或非圖片檔                    | 🟠 P1 | R2 上傳前擋下；錯誤訊息明確                   | ❌ **Backlog** |
| 4 | 批次改價時部分失敗                            | 🟠 P1 | Transaction；全部成功或全部 rollback          | ❌ **Backlog** |
| 5 | 刪除員工時該員工進行中未完成訂單               | 🟠 P1 | 訂單轉派或保留；不得連帶刪除                 | ❌ **Backlog** |
| 6 | 報表查詢範圍極大（跨 2 年）                    | 🟡 P2 | 分頁或強制縮小範圍；不得拖垮 D1              | ❌ **Backlog** |
| 7 | 跨店 RBAC：店主 A 嘗試讀取店主 B 的資料        | 🔴 P0 | 403 Forbidden                                | `tests/e2e/admin/rbac-permissions.spec.ts` |
| 8 | 營業中途調整稅率                              | 🟠 P1 | 新訂單用新稅率；舊訂單保留舊稅率             | ❌ **Backlog** |

### 3.4 濫用 / 惡意情境

- **水平越權**：嘗試 `PATCH /restaurants/:otherId` → 後端必須驗證 ownership
- **下載他店報表**：改 URL 參數 → 403

### 3.5 跨角色互動

- 僱用/解僱 → `CHEF / SERVICE_CREW / CASHIER`：帳號立即生效/失效
- 生成 QR → `CUSTOMER / GUEST`：QR 掃碼立即可用

---

## 4. CHEF（廚師）— Role 2

### 4.1 身份 / 目標

- **身份**：後廚作業員，通常用平板或大螢幕看廚房顯示系統（KDS）
- **核心目標**：接單、按順序製作、標記完成、管理忙碌時段
- **心智模型**：動作要快、介面要一眼看懂；最怕單子漏接或狀態錯亂

### 4.2 關鍵操作

- 接收新訂單（WS 推播）
- 標記「準備中」/「完成」
- 看桌號、品項、客製備註
- 過濾優先單（VIP、超時）
- 管理出餐順序

### 4.3 Edge Cases（待展開）

| # | 情境                                    | 風險 | 對應測試 |
|---|-----------------------------------------|------|----------|
| 1 | WS 斷線後新訂單暫存，重連後補推         | 🔴 P0 | `tests/e2e/admin/sse-realtime.spec.ts` |
| 2 | 同一訂單被兩位廚師同時標記完成          | 🟠 P1 | `tests/e2e/journeys/cross-role/concurrent-operations.spec.ts` |
| 3 | 訂單中途被顧客取消時廚師正在製作        | 🔴 P0 | ❌ **Backlog** — `chef/cancel-during-prep.spec.ts` |
| 4 | 列印機離線時如何 fallback               | 🟠 P1 | ❌ **Backlog** |
| 5 | 追加訂單（customer append）即時插入     | 🟡 P2 | `tests/e2e/journeys/customer/append-order.spec.ts` |
| 6 | 交接班：前一班未完成訂單的所有權        | 🟡 P2 | `tests/e2e/journeys/chef/kitchen-shift.spec.ts` |

### 4.4 濫用 / 惡意情境

- 跨店看單：Chef@StoreA 嘗試 WS 訂閱 StoreB 頻道 → token 必須綁店

---

## 5. SERVICE_CREW（送餐員 / 送菜員）— Role 3

### 5.1 身份 / 目標

- **身份**：內場送菜員或外送員（依餐廳設定）
- **核心目標**：取出餐點、送到正確桌號 / 地址、標記送達

### 5.2 關鍵操作

- 看到「可取餐」訂單列表
- 標記「配送中」/「已送達」
- 內場：確認桌號；外送：查看地址、聯絡顧客
- 回報異常（錯單、客訴）

### 5.3 Edge Cases（待展開）

| # | 情境                                | 風險 | 對應測試 |
|---|-------------------------------------|------|----------|
| 1 | 送錯桌號但已標記送達                | 🟠 P1 | ❌ **Backlog** |
| 2 | 外送途中客人改地址                  | 🟠 P1 | ❌ **Backlog** |
| 3 | 配送 WS 狀態回傳失敗                | 🟠 P1 | `tests/e2e/journeys/service-crew/delivery-shift.spec.ts` |
| 4 | 同一訂單重複點「已送達」            | 🟡 P2 | ❌ **Backlog** |

---

## 6. CASHIER（收銀員）— Role 4 · 🔴 **最高風險 Persona**

### 6.1 身份 / 目標

- **身份**：前台收銀 / POS 操作員
- **核心目標**：收款、退款、開發票、交班結帳
- **心智模型**：**金流一錯就是大事**；動作要可被稽核

### 6.2 關鍵操作

- 讀取桌號 / 訂單結帳
- 信用卡、行動支付、現金、禮券 / 優惠券結帳
- 部分付款、分單結帳
- 退款、折讓
- 交班（shift）：對帳、清點現金、關閉 POS

### 6.3 Edge Cases（金流高風險 · 詳列）

| # | 情境                                          | 風險 | 預期行為                                         | 對應測試 |
|---|-----------------------------------------------|------|--------------------------------------------------|----------|
| 1 | 信用卡被拒                                    | 🔴 P0 | 訂單不變、按鈕重啟、可重試                       | `tests/e2e/journeys/cashier/pos-shift-errors.spec.ts` |
| 2 | 重複付款（網路延遲導致 double-submit）        | 🔴 P0 | 第二次回 409，UI 顯示「已付款」                   | `tests/e2e/journeys/cashier/pos-shift-errors.spec.ts` |
| 3 | 金額不符                                      | 🔴 P0 | 擋下、清空輸入要求重輸入                         | `tests/e2e/journeys/cashier/pos-shift-errors.spec.ts` |
| 4 | 付款成功後印表機離線                          | 🟠 P1 | 付款完成、提示重印                               | `tests/e2e/journeys/cashier/pos-shift-errors.spec.ts` |
| 5 | 付款超時（504）                                | 🔴 P0 | 訂單停留未付狀態，禁止偽造成功                   | `tests/e2e/journeys/cashier/pos-shift-errors.spec.ts` |
| 6 | 退款時原筆交易已關帳                          | 🔴 P0 | 走「折讓單」流程，不得影響已關帳                 | ❌ **Backlog** |
| 7 | 部分付款（分攤）計算錯誤                      | 🔴 P0 | 總和必須等於訂單總額                             | ❌ **Backlog** |
| 8 | 交班時抽屜金額與系統紀錄不符                  | 🟠 P1 | 記錄差異、要求主管覆核                           | `tests/e2e/journeys/cashier/pos-shift.spec.ts` |
| 9 | 交班途中有新訂單進來                          | 🟡 P2 | 提示接班人接手或等待                             | ❌ **Backlog** |
| 10 | 優惠券同時被多張單使用                        | 🔴 P0 | Server-side atomic check                         | `tests/e2e/admin/coupon-management.spec.ts` |

### 6.4 濫用 / 惡意情境

- **竄改金額**：前端改 total 後送到後端 → 後端重算
- **偽造退款**：直接 POST `/refund` → RBAC + 原交易驗證

---

## 7. ADMIN（系統管理員）— Role 0

### 7.1 身份 / 目標

- **身份**：平台內部運營 / 客服 / SRE
- **核心目標**：跨店營運、處理客訴、封停違規店家、資料匯出、系統維運

### 7.2 關鍵操作

- 跨店查詢訂單 / 使用者
- 建立 / 停用餐廳帳號
- 全域公告、Feature flag 調整
- 資料匯出（含 PII）
- 系統健康度監控

### 7.3 Edge Cases（待展開）

| # | 情境                                      | 風險 | 對應測試 |
|---|-------------------------------------------|------|----------|
| 1 | Admin 降權後仍持有舊 token                | 🔴 P0 | ❌ **Backlog** — token revoke 驗證 |
| 2 | 刪店時資料匿名化 / 備份                    | 🔴 P0 | ❌ **Backlog** |
| 3 | 匯出大量 PII 資料                         | 🟠 P1 | ❌ **Backlog** — audit log 驗證 |
| 4 | Feature flag 切換影響進行中訂單            | 🟠 P1 | ❌ **Backlog** |

### 7.4 濫用 / 惡意情境

- Admin 帳號被盜 → MFA、IP 白名單、敏感操作二次驗證、完整 audit trail

---

## 8. GUEST（未註冊訪客）— 非 RBAC 角色但關鍵

### 8.1 身份 / 目標

- **身份**：掃 QR 入店但不註冊的訪客，走 guest token 流程
- **核心目標**：快速點餐、不想留資料、可能一次性使用

### 8.2 關鍵操作

- 掃 QR 取得 guest token
- 瀏覽菜單、加購物車、下單
- 以手機號碼查訂單狀態

### 8.3 Edge Cases

| # | 情境                                      | 風險 | 對應測試 |
|---|-------------------------------------------|------|----------|
| 1 | Guest token 過期                          | 🟠 P1 | `tests/e2e/journeys/customer/qr-expiry.spec.ts` |
| 2 | 同一手機號同時多桌 guest order            | 🟡 P2 | ❌ **Backlog** |
| 3 | Guest 升級為註冊會員，訂單歷史合併         | 🟡 P2 | ❌ **Backlog** |
| 4 | Guest WS 訂閱自己訂單狀態                 | 🟠 P1 | 參考 commit `a2d1c2ca` 新增的 guest WS token 流程 |
| 5 | 偽造 guest token 觀看他人訂單             | 🔴 P0 | ❌ **Backlog** — token 綁定驗證 |

---

## 9. 跨 Persona 互動矩陣

> 最容易漏測的不是單 Persona 的操作，而是兩個 Persona **同時** 操作同一份資源時的競態。

| 情境                                   | 涉及 Persona           | 風險 | 對應測試 |
|----------------------------------------|------------------------|------|----------|
| 顧客下單 → 廚師接單（即時性）          | CUSTOMER + CHEF        | 🔴 P0 | `tests/e2e/journeys/cross-role/order-lifecycle.spec.ts` |
| 顧客取消時廚師已開始製作               | CUSTOMER + CHEF        | 🔴 P0 | ❌ **Backlog** |
| 服務員送達與顧客付款同時發生           | SERVICE + CUSTOMER + CASHIER | 🟠 P1 | `tests/e2e/journeys/cross-role/concurrent-operations.spec.ts` |
| 店主下架商品時顧客正在結帳             | OWNER + CUSTOMER       | 🟠 P1 | `tests/e2e/journeys/customer/stock-validation.spec.ts` |
| 預約→入座→點餐                         | CUSTOMER + SERVICE     | 🟡 P2 | `tests/e2e/journeys/cross-role/reservation-to-seated.spec.ts` |
| 兩位員工同時改同一訂單狀態             | CHEF + SERVICE         | 🟠 P1 | `tests/e2e/journeys/cross-role/concurrent-operations.spec.ts` |

---

## 10. Backlog 彙總（無測試的 Edge Case）

> 以下為目前尚未有測試覆蓋的 Edge Case，依風險排序。每季度 Test Roadmap 會議時，從這裡挑選補齊。

### P0（必補）

- [ ] Customer：惡意輸入 / XSS / SQL（§ 2.3 #10）
- [ ] Cashier：退款跨關帳（§ 6.3 #6）
- [ ] Cashier：部分付款金額驗證（§ 6.3 #7）
- [ ] Chef：訂單製作中被取消（§ 4.3 #3）
- [ ] Admin：降權後 token 撤銷（§ 7.3 #1）
- [ ] Admin：刪店資料匿名化（§ 7.3 #2）
- [ ] Guest：token 偽造（§ 8.3 #5）

### P1（當季補齊）

- [ ] Owner：圖片上傳邊界（§ 3.3 #3）
- [ ] Owner：批次操作的 transaction 語意（§ 3.3 #4）
- [ ] Owner：員工有進行中訂單時的停用流程（§ 3.3 #5）
- [ ] Owner：營業中調整稅率（§ 3.3 #8）
- [ ] Chef：列印機 fallback（§ 4.3 #4）
- [ ] Service：送錯桌 / 改地址（§ 5.3 #1, #2）
- [ ] Cashier：交班途中新訂單（§ 6.3 #9）
- [ ] Admin：PII 匯出 audit log（§ 7.3 #3）

### P2 / P3

省略，見各 Persona 內文。

---

## 11. 變更紀錄

| 日期       | 作者 | 異動                        |
| ---------- | ---- | --------------------------- |
| 2026-04-16 | @claude | 初版骨架，6 Persona + Guest |
