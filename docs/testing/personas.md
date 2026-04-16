# Stakeholder Personas & Test Matrix / 利益人與測試矩陣

> 本文件是 MakanMakan 的測試規格藍圖。它的責任不是描述「目前有哪些測試」，而是盡可能完整地描述「系統裡有哪些利益者、這些利益者在各功能模組中會怎麼操作、系統應如何回應、哪些地方最容易出錯、哪些風險必須優先驗證」。
>
> 這份文件應該比目前實作更完整、比現有測試更超前。測試、稽核與 coverage 應反過來依照這份文件補齊，而不是拿現況去限制它。

---

## 0. 文件定位

### 0.1 這份文件回答的問題

- 系統裡有哪些利益者 / 使用者類型
- 每一個角色的核心目標、心智模型與主要壓力來源是什麼
- 每一個角色在每一個功能模組中能做什麼、不能做什麼、最常做什麼
- 正常流程、例外流程、失敗流程、競態流程、惡意流程各自是什麼
- 什麼情境屬於 P0 / P1 / P2 / P3
- 什麼類型的測試最適合驗證該風險

### 0.2 這份文件不負責的事情

- 不負責宣告實際測試覆蓋率
- 不負責取代 CI 狀態、coverage 報表、test progress report
- 不負責判斷 repo 內現有 spec 是否已完全符合本文件

實際覆蓋與缺口應由獨立文件追蹤，例如：
- `docs/testing/PERSONA_TEST_CHECKLIST_AUDIT.md`
- `docs/testing/TEST_PROGRESS.md`

### 0.3 使用方式

| 對象 | 使用方式 |
| --- | --- |
| 測試工程師 | 依 Persona × Module 切分測試案例與回歸範圍 |
| 功能開發者 | 開發前檢查新增流程影響哪些角色與模組 |
| Reviewer | 驗證 PR 是否漏掉角色邊界、權限邊界、例外與競態 |
| PM / QA | 以利益者風險評估 release scope |
| Incident Owner | 線上事故回填到 Persona / Module / Risk Point |

### 0.4 維護原則

- 新功能新增時，先擴 Persona / Module，再補測試
- 發生 incident 時，優先回填本文件，再補測試
- 文件可以超前於現況
- 若功能已存在但尚未建模，視為文件欠帳

---

## 1. 風險分級

| 等級 | 定義 | 測試要求 |
| --- | --- | --- |
| 🔴 P0 | 金流錯誤、資料遺失、權限繞過、安全漏洞、訂單狀態錯亂、不可逆業務損害 | 上線前必須有可重複驗證 |
| 🟠 P1 | 核心業務流程中斷，但通常可恢復 | 當季應補齊自動化驗證 |
| 🟡 P2 | 明顯體驗退化，但仍有 workaround | 近期 Roadmap 應處理 |
| ⚪ P3 | 邊緣場景、低頻、低商業衝擊 | 長期 Backlog |

---

## 2. 與程式碼對齊

RBAC 角色常數應與下列檔案對齊：

- `tests/e2e/helpers/personas.ts`
- `apps/api/src/shared/constants/index.ts`

角色定義：

```text
ADMIN (0) · OWNER (1) · CHEF (2) · SERVICE_CREW (3) · CASHIER (4) · CUSTOMER (5)
```

補充：
- `GUEST` 不在 RBAC 角色內，但在掃碼 / guest token / 匿名下單中是第一級利益者

---

## 3. Persona 總覽

| Code | 角色 | Role ID | 主要介面 | 核心目標 | 最高風險區 |
| --- | --- | --- | --- | --- | --- |
| `ADMIN` | 系統管理員 | 0 | admin-dashboard | 跨店維運、平台治理、審計 | PII、跨店存取、敏感操作 |
| `OWNER` | 店主 | 1 | admin-dashboard | 管店、管菜單、管營運、管員工 | 多店隔離、報表可信度 |
| `CHEF` | 廚師 | 2 | kitchen-display | 接單、製作、完成出餐 | 漏單、錯狀態、競態更新 |
| `SERVICE_CREW` | 送餐員 / 送菜員 | 3 | kitchen-display / POS | 取餐、送餐、標記送達 | 錯送、重複送達、狀態回報 |
| `CASHIER` | 收銀員 | 4 | admin-dashboard / POS | 安全收款、退款、交班 | 金流、對帳、重複扣款 |
| `CUSTOMER` | 顧客（註冊） | 5 | customer-app | 點餐、付款、追蹤、會員操作 | 下單、付款、帳號、優惠 |
| `GUEST` | 訪客（未註冊） | — | customer-app / QR | 低摩擦點餐與追蹤訂單 | guest token、匿名訂單、身份綁定 |

---

## 4. 功能模組總覽

為了讓測試設計更可執行，本文件採用「功能模組 × Persona」視角。MakanMakan 可拆成下列模組：

1. 身份與認證 Authentication
2. 角色與權限 RBAC / Access Control
3. 店家與多店切換 Restaurant Context
4. 菜單與可用性 Menu / Availability
5. 掃碼與入店 QR / Table Entry
6. 購物車與客製化 Cart / Customization
7. 下單與訂單建立 Order Creation
8. 訂單狀態與生命周期 Order Lifecycle
9. 付款、退款與結帳 Payment / POS / Shift
10. 優惠券、會員與促銷 Coupon / Loyalty
11. 即時更新 Realtime / SSE / WS
12. 廚房與出餐 Kitchen / Fulfillment
13. 配送與送達 Delivery / Service
14. 報表、匯出與稽核 Reporting / Audit
15. 系統設定與 Feature Flags Settings / Config
16. 異常、恢復與安全 Error Recovery / Abuse / Security

---

## 5. 測試建模模板

每個 Persona × Module 至少從以下面向建模：

- 可見性：看得到什麼
- 可執行性：做得到什麼
- 不可執行性：不應做得到什麼
- 邊界條件：空值、極值、異常順序、過期、重送
- 失敗條件：API 500、409、401、403、504、離線、重連
- 競態條件：雙人 / 雙裝置 / 雙角色同時操作
- 審計條件：狀態是否可回溯、是否有 audit trail

---

## 6. CUSTOMER（顧客 / 註冊會員）— Role 5

### 6.1 Persona 定義

- 身份：已註冊、可登入 customer-app 的會員
- 心智模型：像 Foodpanda / UberEats / 店內掃碼點餐混合體驗
- 核心目標：
  - 快速找到商品
  - 正確建立訂單
  - 安全完成付款
  - 隨時掌握訂單狀態
  - 不因技術問題失去購物車、訂單或金流

### 6.2 CUSTOMER × 模組

#### A. Authentication

可做的事：
- 註冊
- 登入
- 登出
- 刷新 token
- 忘記密碼
- 更新個資

應測的行為：
- 未登入時被正確導向登入頁
- 已登入時保留 redirect intent
- access token 過期時 silent refresh
- refresh token 過期時被導回登入
- 同帳號多裝置登入後狀態一致

高風險：
- JWT 過期仍被當成有效
- refresh 流程失敗時出現假登入狀態
- 使用者 A 看得到使用者 B 的訂單

解法方向：
- access / refresh token 分離
- 所有 `/customers/*` 路由強制 user scope
- mid-session token refresh

#### B. QR / Table Entry

可做的事：
- 掃 QR 進店
- 根據桌號進入該店菜單
- 用 table context 直接開始點餐

應測的行為：
- 正常 QR 可進店
- 過期 QR 顯示友善錯誤
- 錯店 QR 顯示錯誤
- table 不存在時顯示錯誤
- 重試 / 回首頁 CTA 正常

高風險：
- 偽造 tableId / restaurantId
- 過期 token 仍可進店
- 錯店資料被誤綁定

解法方向：
- QR token 綁定 `restaurantId + tableId + expiry`
- 掃碼後一律 server verify
- 失敗時給 deterministic error code

#### C. Menu / Discovery

可做的事：
- 瀏覽店家 / 商品
- 搜尋商品
- 依分類篩選
- 看圖片、價格、說明、可用性、客製化選項

應測的行為：
- 菜單成功載入
- 菜單 API 失敗時有 fallback
- unavailable item 標記清楚
- discovery API 失敗不致全頁白屏

高風險：
- 顯示可買但實際不能買
- 斷線時 UI 卡死
- 使用者看到錯誤價格

解法方向：
- 可用性欄位與 checkout revalidation 雙重防護
- discovery / menu 錯誤隔離
- 前端顯示與 server truth 分離

#### D. Cart / Customization

可做的事：
- 加入購物車
- 修改數量
- 刪除品項
- 選客製化
- 寫備註
- 套用優惠券

應測的行為：
- 購物車可持續存在
- 客製化價格正確
- 備註安全且不破版
- coupon 套用後總價正確

高風險：
- 商品剛下架仍可 checkout
- 客製化 payload 過大
- 惡意字串造成 XSS / SQL injection 路徑

解法方向：
- checkout 時二次驗證
- payload size limit
- server sanitize + frontend escape

#### E. Order Creation

可做的事：
- 提交內用訂單
- 提交外帶訂單
- 提交外送訂單
- 追加同桌訂單

應測的行為：
- 成功送單後跳 tracking
- 庫存不足時回 `409`
- append order 不覆蓋舊單
- 多裝置操作不互相污染

高風險：
- 送單時庫存歸零
- 同時雙裝置送單
- 同桌多人拼桌導致歸屬錯亂

解法方向：
- server-side stock check
- idempotency key
- table-scoped append order model

#### F. Payment / Checkout

可做的事：
- 信用卡付款
- 行動支付付款
- 貨到付款
- 補付款

應測的行為：
- 不可重複扣款
- timeout 時不應假成功
- 金額、折扣、稅、外送費一致
- 付款後狀態同步正確

高風險：
- double submit
- network drop during payment
- coupon / tax / fee mismatch

解法方向：
- idempotency key
- server recompute total
- authoritative payment status polling

#### G. Order Tracking / Post-Order

可做的事：
- 看 pending / preparing / ready / delivered
- 取消訂單
- 重新下單
- 看歷史訂單
- 看追加訂單結果

應測的行為：
- 狀態按順序流轉
- pending / preparing 可取消；ready 後不可
- admin force-cancel 會同步反映
- completed / cancelled 顯示正確

高風險：
- 取消規則不一致
- tracking 與真實狀態不同步
- append order 造成歷史顯示錯亂

解法方向：
- order state machine
- realtime update + refresh fallback
- timeline UI 使用單一 status source

### 6.3 CUSTOMER 高風險測試清單

| ID | Risk | Scenario | 預期行為 |
| --- | --- | --- | --- |
| C1 | 🟠 P1 | QR token 過期 | 友善錯誤、可重試 |
| C2 | 🔴 P0 | 商品下架仍在 cart | checkout 阻擋並提示移除 |
| C3 | 🔴 P0 | 送單時庫存歸零 | `409`、購物車保留 |
| C4 | 🔴 P0 | 付款時斷線 | 不可重複扣款 |
| C5 | 🟠 P1 | 雙裝置同時送單 | 狀態一致，不互相覆寫 |
| C6 | 🟠 P1 | 外送地址超區 | 結帳前阻擋 |
| C7 | 🟠 P1 | 下單後取消 | 依 state machine 控制 |
| C8 | 🟡 P2 | token 過期 | silent refresh 或導回登入 |
| C9 | 🟡 P2 | 追加訂單 | 與原單關係清楚 |
| C10 | 🔴 P0 | 惡意輸入 / XSS / SQL | sanitize + escape + limit |
| C11 | 🟡 P2 | 多人共用同桌 QR | 歸屬正確 |
| C12 | ⚪ P3 | 語系 / 時區切換 | 顯示與計算正確 |

---

## 7. OWNER（店主）— Role 1

### 7.1 Persona 定義

- 身份：營運一間或多間餐廳的業主
- 核心目標：
  - 菜單正確
  - 員工權限正確
  - 報表可信
  - 多店資料不混淆

### 7.2 OWNER × 模組

#### A. Authentication / Access

可做的事：
- 登入後進入自己店家的管理介面
- 多店切換

應測的行為：
- 店主登入後只看到授權店家
- 切店後 API context 全部更新
- 不能透過 URL 回到舊店敏感資源

#### B. Restaurant Context / Multi-Store

可做的事：
- 切換名下店鋪
- 查看不同店的 dashboard / menu / reports

應測的行為：
- store selector 正確列出可用店家
- store selection 可持續於導覽
- API 請求中的 `restaurantId` 跟著切換

高風險：
- UI 切換了，但資料來源沒切換
- 快取殘留舊店資料
- 直接修改 URL 還能取舊店資料

解法方向：
- single source of restaurant context
- route-level authorization
- query cache invalidation on switch

#### C. Menu Management

可做的事：
- 新增菜品
- 編輯菜品
- 刪除菜品
- 上傳圖片
- 建立 / 編輯分類
- 搜尋菜品
- 切換可用性
- 批次改價

應測的行為：
- CRUD 正常
- 圖片上傳錯誤處理明確
- 分類、可用性、搜尋狀態彼此一致
- 下架不影響舊訂單快照

高風險：
- 部分寫入成功
- 非圖片上傳
- 大檔案拖垮流程
- 在營業中下架商品造成 checkout 行為不一致

#### D. Staff / Employee Management

可做的事：
- 建立員工
- 指派角色
- 停用員工
- 變更班表

應測的行為：
- 角色變更即時生效
- 停用後不可再用舊權限
- 進行中工作不可 orphan

高風險：
- 已停用員工仍有有效 session
- 角色修改後前端看似成功但後端仍舊權限

#### E. Reporting / Analytics

可做的事：
- 看日 / 週 / 月報表
- 看銷售排行
- 看熱門時段
- 匯出資料

應測的行為：
- 指標正確
- 大區間查詢有防護
- 匯出結果只含授權店家資料

#### F. Settings / Config

可做的事：
- 設定營業時間
- 稅率
- 付款方式
- 最低消費
- 外送費

應測的行為：
- 變更後新訂單生效
- 舊訂單保持原快照
- 營業中修改不破壞進行中流程

### 7.3 OWNER 高風險測試清單

| ID | Risk | Scenario | 預期行為 |
| --- | --- | --- | --- |
| O1 | 🔴 P0 | 切店後仍讀到舊店資源 | 強制隔離 / `403` |
| O2 | 🟠 P1 | 下架品項時有進行中訂單 | 舊單不受影響，新單阻擋 |
| O3 | 🟠 P1 | 非圖片 / 大圖上傳 | 上傳前阻擋 |
| O4 | 🟠 P1 | 批次改價部分失敗 | transaction / rollback |
| O5 | 🟠 P1 | 停用員工時有進行中工作 | 轉派或保留 |
| O6 | 🟡 P2 | 報表範圍過大 | 分頁 / 限流 / async export |
| O7 | 🔴 P0 | 跨店 RBAC 讀寫 | `403` |
| O8 | 🟠 P1 | 營業中調整稅率 | 舊單舊稅率、新單新稅率 |

---

## 8. CHEF（廚師）— Role 2

### 8.1 Persona 定義

- 核心目標：接單、開始製作、完成出餐，不漏單、不重複、不錯狀態

### 8.2 CHEF × 模組

#### A. Kitchen Authentication

- 以廚房身分登入
- 被正確導入 kitchen dashboard
- 失效 token 時能 refresh 或登出

#### B. Realtime Intake

- 接收新訂單
- 接收狀態更新
- 重連後恢復

高風險：
- 心跳正常但漏事件
- 斷線後沒有補推
- 舊 token 仍可看跨店頻道

#### C. Kitchen Work Queue

- 看 Kanban / Grid
- 看桌號、品項、備註
- 開始製作
- 標記 ready
- 批次處理

高風險：
- 兩人同時修改同一單
- append order 插入錯位置
- 準備中被取消

#### D. Print / Ticket

- 列印小票
- 離線 fallback
- 重印

### 8.3 CHEF 高風險測試清單

| ID | Risk | Scenario | 預期行為 |
| --- | --- | --- | --- |
| H1 | 🔴 P0 | 斷線後漏單 | 重連後補推，不漏單 |
| H2 | 🟠 P1 | 兩位廚師同時完成同單 | 一方成功、一方 conflict |
| H3 | 🔴 P0 | 顧客取消時廚房正在製作 | 明確衝突規則 |
| H4 | 🟠 P1 | 列印機離線 | 主流程不中斷，可補印 |
| H5 | 🟡 P2 | append order 插入廚房流 | 清楚標記 append |
| H6 | 🟡 P2 | 交接班未完成訂單 | 所有權與可見性一致 |

---

## 9. SERVICE_CREW（送餐員 / 送菜員）— Role 3

### 9.1 Persona 定義

- 核心目標：把對的餐送到對的桌 / 地址，並準確回報狀態

### 9.2 SERVICE_CREW × 模組

#### A. Shift / Assignment

- 登入
- 看 ready orders
- 接手任務

#### B. Delivery Execution

- 標記 delivering
- 標記 delivered
- 看桌號
- 看地址

#### C. Failure / Exception

- 網路錯誤
- 別人先領走
- 送錯桌
- 客戶改地址
- 重複送達

### 9.3 SERVICE_CREW 高風險測試清單

| ID | Risk | Scenario | 預期行為 |
| --- | --- | --- | --- |
| S1 | 🟠 P1 | 送錯桌但已標記送達 | 有更正或確認機制 |
| S2 | 🟠 P1 | 外送中改地址 | 版本切換正確 |
| S3 | 🟠 P1 | 狀態更新失敗 | 顯示失敗且可重試 |
| S4 | 🟡 P2 | 重複點 delivered | endpoint idempotent |

---

## 10. CASHIER（收銀員）— Role 4

### 10.1 Persona 定義

- 核心目標：收款正確、退款正確、對帳正確、交班正確

### 10.2 CASHIER × 模組

#### A. Shift Start / End

- 開班
- 設起始現金
- 看 shift badge
- 結班
- 看 reconciliation summary

#### B. Order Selection / POS

- 看待付款單
- 選單
- 看應收金額
- 看優惠與稅

#### C. Payment

- 信用卡付款
- 現金付款
- 行動支付付款
- 計算找零
- 成功付款
- 重印收據

#### D. Coupon / Discount

- 套用優惠券
- 看折扣
- 驗證折扣對金額的影響

#### E. Refund / Post-Payment

- 退款
- 關帳後折讓
- 查看差異

### 10.3 CASHIER 高風險測試清單

| ID | Risk | Scenario | 預期行為 |
| --- | --- | --- | --- |
| K1 | 🔴 P0 | 卡拒 | 狀態回復，可重試 |
| K2 | 🔴 P0 | 重複付款 | 不可重複扣款 |
| K3 | 🔴 P0 | 金額不符 | 強制阻擋 |
| K4 | 🟠 P1 | 成功付款但印表機離線 | 支付成功、可重印 |
| K5 | 🔴 P0 | `504` timeout | 保持未確認狀態 |
| K6 | 🔴 P0 | 關帳後退款 | 走折讓流程 |
| K7 | 🔴 P0 | 部分付款總和不正確 | 嚴格驗證總額 |
| K8 | 🟠 P1 | 現金抽屜與系統不符 | 記錄差異並要求覆核 |
| K9 | 🟡 P2 | 交班中有新訂單 | handoff 規則清楚 |
| K10 | 🔴 P0 | 優惠券同時被多張單使用 | atomic redemption |

---

## 11. ADMIN（系統管理員）— Role 0

### 11.1 Persona 定義

- 核心目標：跨店治理、敏感資料管理、系統維運與事故處理

### 11.2 ADMIN × 模組

#### A. Cross-Store Access

- 查詢所有店家
- 查詢所有訂單
- 查詢所有使用者

#### B. Account / Platform Governance

- 建立 / 停用店家
- 封停違規店家
- 調整 feature flags

#### C. Export / PII

- 匯出資料
- 匯出 PII
- 審閱 audit records

#### D. Security / Revocation

- 降權
- 停權
- 撤銷 token
- 驗證敏感操作二次確認

### 11.3 ADMIN 高風險測試清單

| ID | Risk | Scenario | 預期行為 |
| --- | --- | --- | --- |
| A1 | 🔴 P0 | 降權後舊 token 仍可用 | 立即失效或重新授權 |
| A2 | 🔴 P0 | 刪店未匿名化 / 無備份 | 保持合規與可追溯 |
| A3 | 🟠 P1 | PII 匯出無 audit log | 完整審計 |
| A4 | 🟠 P1 | feature flag 影響 active orders | 舊流程不中斷 |

---

## 12. GUEST（未註冊訪客）— 非 RBAC 角色但關鍵

### 12.1 Persona 定義

- 核心目標：最少身份摩擦下完成點餐與查單

### 12.2 GUEST × 模組

#### A. Guest Entry

- 掃 QR
- 取得 guest token
- 進入菜單

#### B. Guest Ordering

- 加購物車
- 下單
- 追加品項
- 取消訂單

#### C. Guest Tracking

- 用手機 / token 查單
- 看狀態
- 在 token 有效期內存取自己的訂單

#### D. Guest Security

- token 過期
- token 偽造
- 同手機多桌
- guest 升級為 customer

### 12.3 GUEST 高風險測試清單

| ID | Risk | Scenario | 預期行為 |
| --- | --- | --- | --- |
| G1 | 🟠 P1 | token 過期 | 有清楚恢復流程 |
| G2 | 🟡 P2 | 同手機多桌 guest order | 查詢隔離正確 |
| G3 | 🟡 P2 | guest 升級為註冊會員 | 歷史整併規則明確 |
| G4 | 🟠 P1 | 訂閱自己的訂單狀態 | 僅能看自己事件 |
| G5 | 🔴 P0 | 偽造 guest token | 嚴格拒絕 |

---

## 13. 跨 Persona 互動矩陣

| ID | 情境 | 涉及角色 | 風險 | 預期行為 |
| --- | --- | --- | --- | --- |
| X1 | 顧客下單，廚房即時收到 | CUSTOMER + CHEF | 🔴 P0 | 不漏單、延遲可控 |
| X2 | 顧客取消時廚房已開始製作 | CUSTOMER + CHEF | 🔴 P0 | 明確衝突規則 |
| X3 | 送達與付款同時發生 | SERVICE_CREW + CUSTOMER + CASHIER | 🟠 P1 | 狀態最終一致 |
| X4 | 店主下架商品時顧客正在 checkout | OWNER + CUSTOMER | 🟠 P1 | checkout 重新驗證 |
| X5 | 預約 → 入座 → 點餐 | CUSTOMER + SERVICE / OWNER | 🟡 P2 | reservation / table / order 一致 |
| X6 | 兩位員工同時更新同一訂單 | CHEF + SERVICE / CHEF + CHEF | 🟠 P1 | 一方成功，一方 conflict |

---

## 14. 建議測試類型對照

| 風險類型 | 建議測試方式 |
| --- | --- |
| 角色旅程 | E2E |
| 權限邊界 | API + E2E |
| 金流與 idempotency | API + integration + targeted E2E |
| realtime / SSE / WS | integration + targeted E2E |
| 惡意輸入 / token 偽造 | API + security |
| transaction / rollback / race | integration |
| 報表 / 大資料量 / 查詢負載 | integration + perf |

---

## 15. Backlog 使用方式

Backlog 應描述為「待補風險」，而不是「目前沒有風險」。

建議優先補齊：

### P0

- Customer：惡意輸入 / XSS / SQL
- Customer：付款中斷時的 idempotency 與真實支付狀態回復
- Chef：製作中取消
- Cashier：關帳後退款
- Cashier：部分付款總額驗證
- Admin：降權後 token 撤銷
- Guest：token 偽造

### P1

- Owner：批次改價 transaction
- Owner：停用員工時有進行中工作
- Owner：營業中改稅率
- Service：送錯桌 / 改地址
- Chef：列印機 fallback
- Admin：PII 匯出 audit

---

## 16. 變更紀錄

| 日期 | 作者 | 異動 |
| --- | --- | --- |
| 2026-04-16 | @claude | 初版骨架，6 Persona + Guest |
| 2026-04-16 | Codex | 擴充為「功能模組 × Persona」版本 |
