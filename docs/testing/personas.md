# Stakeholder Personas & Test Matrix / 利益人與測試矩陣

> 本文件是 MakanMasak 的測試規格藍圖。它的責任不是描述「目前有哪些測試」，而是盡可能完整地描述「系統裡有哪些利益者、這些利益者在各功能模組中會怎麼操作、系統應如何回應、哪些地方最容易出錯、哪些風險必須優先驗證」。
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
- `MANAGER` 尚未獨立於 RBAC（共用 Role 1 權限、標記為 `1*`），是組織層 persona；實務上由 Owner 指派值班主管代管單日營運。藍圖先行建模，RBAC 擴充前由 audit 以 scope 判定

---

## 3. Persona 總覽

| Code | 角色 | Role ID | 主要介面 | 核心目標 | 最高風險區 |
| --- | --- | --- | --- | --- | --- |
| `ADMIN` | 系統管理員 | 0 | admin-dashboard | 跨店維運、平台治理、審計 | PII、跨店存取、敏感操作 |
| `OWNER` | 店主 | 1 | admin-dashboard | 管店、管菜單、管營運、管員工 | 多店隔離、報表可信度 |
| `MANAGER` | 值班主管 | 1* | admin-dashboard / POS | 單日 / 單店營運協調與異常處理 | 權限代理、交接、客訴處置 |
| `CHEF` | 廚師 | 2 | kitchen-display | 接單、製作、完成出餐 | 漏單、錯狀態、競態更新 |
| `SERVICE_CREW` | 送餐員 / 送菜員 | 3 | kitchen-display / POS | 取餐、送餐、標記送達 | 錯送、重複送達、狀態回報 |
| `CASHIER` | 收銀員 | 4 | admin-dashboard / POS | 安全收款、退款、交班 | 金流、對帳、重複扣款 |
| `CUSTOMER` | 顧客（註冊） | 5 | customer-app | 點餐、付款、追蹤、會員操作 | 下單、付款、帳號、優惠 |
| `GUEST` | 訪客（未註冊） | — | customer-app / QR | 低摩擦點餐與追蹤訂單 | guest token、匿名訂單、身份綁定 |

---

## 4. 功能模組總覽

為了讓測試設計更可執行，本文件採用「功能模組 × Persona」視角。MakanMasak 可拆成下列模組：

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
17. 周邊系統與非功能 External Integrations / Hardware / Notifications / Compliance / Accessibility

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
- 可觀察性 Test Oracle：測試如何分辨「失敗 vs 慢」、「漏 vs 延遲」。每個 risk 必須指向可被斷言的 server state / event log / UI 狀態
- 非功能邊界 Non-functional：P99 < 300ms、WS < 50ms、a11y 最小對比度、i18n locale 清單（對齊 `CLAUDE.md` 效能目標）

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

#### H. Offline / Network-degraded Mode

可做的事：
- 離線瀏覽已快取菜單
- 離線加入購物車（本地 queue）
- 連線恢復後補送單

應測的行為：
- 離線時加入購物車不丟資料
- 恢復連線後 server 二次驗證（庫存、價格、稅、配送費）
- 離線 checkout 必須阻擋或顯示「待連線後送出」狀態

高風險：
- 離線 queue 造成重複送單
- 回線後價格不一致但送單成功
- UI 顯示「已送出」但 server 未收

解法方向：
- idempotency key + 離線標記
- 恢復連線後以 server 為真實來源 recompute
- 明確 UI 狀態：送出中 / 成功 / 待重送

#### I. Menu Variants / Combo / Add-on

可做的事：
- 選規格（size / sweetness / ice）
- 選套餐拼盤與必選項
- 選加料（付費 / 免費）
- 指定備註

應測的行為：
- 必選項未選時 checkout 阻擋
- variants 價差正確累加
- combo 拆單規則一致（顧客單 vs 廚房單）
- 超出允許組合數回錯誤

高風險：
- 必選項未選卻送單成功
- combo 金額與加料相衝
- 規格描述顯示與 kitchen ticket 不一致

解法方向：
- 選項關係由 server schema 定義
- checkout 二次驗證 variants 完整性
- kitchen ticket 與顧客單共用單一 render

#### J. Notifications / Receipts

可做的事：
- 訂單確認 email / SMS
- 推播狀態變化
- 重發收據

應測的行為：
- 通知失敗不影響主流程
- 通知可重送
- 內容與 server truth 一致

高風險：
- 通知成功但 UI 看似失敗
- 送達他人（錯誤 email / 電話）
- 通知內含敏感資訊外洩（完整卡號、地址）

解法方向：
- 通知與訂單 commit 解耦
- 通知內容以白名單欄位組裝
- 通知重送記錄 + audit

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
| C13 | 🟠 P1 | 離線加入購物車後回線送單 | idempotency + 二次驗證，無重複單 |
| C14 | 🟠 P1 | 套餐必選 / 加料相依性錯誤 | schema 驗證並阻擋 checkout |
| C15 | 🟡 P2 | 通知 / 收據寄送失敗 | 不影響主流程、可重送、無敏資外洩 |

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

#### E. Kitchen Operations Edge Cases

- 套餐拆單（combo split）進廚房
- 缺料 / 替代（substitution）
- 製作中店家修改菜單
- 高峰期批次出餐

高風險：
- combo 拆單錯位導致漏品
- 替代未通知客戶造成客訴
- 菜單修改影響進行中訂單快照

### 8.3 CHEF 高風險測試清單

| ID | Risk | Scenario | 預期行為 |
| --- | --- | --- | --- |
| H1 | 🔴 P0 | 斷線後漏單 | 重連後補推，不漏單 |
| H2 | 🟠 P1 | 兩位廚師同時完成同單 | 一方成功、一方 conflict |
| H3 | 🔴 P0 | 顧客取消時廚房正在製作 | 明確衝突規則 |
| H4 | 🟠 P1 | 列印機離線 | 主流程不中斷，可補印 |
| H5 | 🟡 P2 | append order 插入廚房流 | 清楚標記 append |
| H6 | 🟡 P2 | 交接班未完成訂單 | 所有權與可見性一致 |
| H7 | 🟠 P1 | 套餐拆單進廚房 | 拆分規則一致，單一出餐點 |
| H8 | 🟠 P1 | 製作中缺料需替代 | 替代流程、客戶通知、金額重算 |
| H9 | 🟠 P1 | 店家在準備中修改菜單 | 舊單以下單當下快照為準 |

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

#### D. Routing / Multi-order Handling

- 一人多單派工優先權
- 取餐 QR / 序號匹配
- 裝置離線 / 換裝置交接
- 高峰時段大批 ready 訂單

高風險：
- 多單排序錯誤導致冷掉
- 拿錯單
- 裝置掛掉後任務消失

### 9.3 SERVICE_CREW 高風險測試清單

| ID | Risk | Scenario | 預期行為 |
| --- | --- | --- | --- |
| S1 | 🟠 P1 | 送錯桌但已標記送達 | 有更正或確認機制 |
| S2 | 🟠 P1 | 外送中改地址 | 版本切換正確 |
| S3 | 🟠 P1 | 狀態更新失敗 | 顯示失敗且可重試 |
| S4 | 🟡 P2 | 重複點 delivered | endpoint idempotent |
| S5 | 🟠 P1 | 一人多單派工衝突 | 優先權 / 排序明確 |
| S6 | 🟡 P2 | 取餐拿錯單 | 掃碼 / 編號確認阻擋 |
| S7 | 🟡 P2 | 裝置斷電或換裝置 | 任務可接手、狀態不遺失 |

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
| K11 | 🟠 P1 | 同 IP 短時間暴力刷卡 | rate limit、風險交易攔截 |

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

#### E. Compliance / Data Lifecycle / SRE

- 資料保留期限與被遺忘權請求
- 備份 / 還原演練
- On-call 事故處理與降級
- 合規稽核（GDPR、個資法、PCI 範圍）

高風險：
- 刪除後備份仍可找回 PII
- 還原演練失敗但告警未觸發
- 事故降級流程缺失
- audit log 本身可被竄改

### 11.3 ADMIN 高風險測試清單

| ID | Risk | Scenario | 預期行為 |
| --- | --- | --- | --- |
| A1 | 🔴 P0 | 降權後舊 token 仍可用 | 立即失效或重新授權 |
| A2 | 🔴 P0 | 刪店未匿名化 / 無備份 | 保持合規與可追溯 |
| A3 | 🟠 P1 | PII 匯出無 audit log | 完整審計 |
| A4 | 🟠 P1 | feature flag 影響 active orders | 舊流程不中斷 |
| A5 | 🟠 P1 | 被遺忘權請求 / 資料保留到期 | 匿名化 / 硬刪 + audit |
| A6 | 🔴 P0 | 備份還原演練失敗 | 可還原、資料完整、告警觸發 |
| A7 | 🟠 P1 | On-call 事故降級 | observability、可降級、可回滾 |

---

## 11.5 MANAGER（值班主管）— Role 1*（Owner 代理，藍圖提案）

### 11.5.1 Persona 定義

- 身份：被 Owner 指派代行單日 / 單店營運的主管，實質是 Owner 的值班代理
- 心智模型：短期、scope-bounded 的 Owner，不是另一個 Owner
- 核心目標：班次交接順暢、異常處理即時、權限範圍清楚、操作軌跡可追溯
- 現況：尚未在 RBAC 獨立角色；藍圖先行建模，實作補齊前以「Owner + scope + actor 欄位」代理

### 11.5.2 MANAGER × 模組

- Restaurant Context：只操作被指派的單店，不能跨店
- Order Lifecycle：force-cancel、人工改單、折讓授權（皆須二次確認）
- Cashier Shift：代開 / 代結班、覆核差異
- Reporting：即時看當日 KPI，但不可匯出 PII
- Audit：所有代理操作都必須以 `on-behalf-of` 形式入庫

高風險：
- 代理權限被濫用（任意改單、折讓、退款）
- 代理授權期結束後權限未自動回收
- 操作軌跡 attribution 錯誤（記成 Owner 而非代理者）
- 同時多位代理在班導致並行操作衝突

解法方向：
- audit log 分離 `actor_user_id`（實際操作者）與 `on_behalf_of_user_id`（Owner）
- 授權時效 / scope 採 JWT claim + server 驗證雙檢查
- 敏感操作（退款 / 折讓 / 刪單）強制二次確認 + 主管簽核

### 11.5.3 MANAGER 高風險測試清單

| ID | Risk | Scenario | 預期行為 |
| --- | --- | --- | --- |
| M1 | 🔴 P0 | 代理身份操作卻記為 Owner | audit log 分離 actor / on-behalf-of |
| M2 | 🟠 P1 | 代理授權期結束後仍能操作 | 時效 / scope 到期即失效 |
| M3 | 🟠 P1 | 跨店操作越權 | 僅限被指派店家，其餘 `403` |
| M4 | 🟠 P1 | 代理覆核現金差異 | 差異、簽核人、時間皆入 audit |
| M5 | 🟡 P2 | 多位代理同時在班 | 權限並行、操作可追溯到個別代理 |

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

## 12.5 External Integrations / Hardware / Notifications（第三方系統與硬體）

### 12.5.1 定位

非 RBAC persona，但是系統的**外部依賴實體**。它們會單點失效、延遲、回應錯誤格式、被 DDoS，必須建模為測試裡的可控失敗點。

涵蓋：
- 金流通道（信用卡、LINE Pay、Apple Pay、街口、超商代收）
- 第三方平台（Foodpanda / Uber Eats / 自建外送）
- 列印硬體（廚房印表機、櫃台出餐機、本地 Node.js print agent）
- 通知通道（SMS、Email、Web Push、Webhook）
- 外部 POS / ERP / 會計同步

### 12.5.2 失敗模式建模

每個依賴都應明確定義：
- **失敗模式**：timeout、4xx、5xx、錯誤格式、部分回應、簽章不符
- **重試策略**：最大次數、exponential backoff、jitter
- **狀態校正**：對端為真 vs 本端為真、reconciliation job
- **斷路器**：circuit breaker 閾值、半開恢復策略
- **降級 UX**：顯示、可重試、可切換通道、manual override

### 12.5.3 External 高風險測試清單

| ID | Risk | Scenario | 預期行為 |
| --- | --- | --- | --- |
| E1 | 🔴 P0 | 金流通道 timeout | 不假成功、保留 unpaid 鎖、可由 status poll 校正 |
| E2 | 🔴 P0 | 金流回呼延遲導致雙觸發 | idempotent webhook handler、only-once effect |
| E3 | 🟠 P1 | 第三方平台菜單同步失敗 | 本系統為源真相、sync 失敗回報並重試 |
| E4 | 🟠 P1 | 列印機 / print agent 離線 | 主流程不卡死、queue 重印、印表機健康可見 |
| E5 | 🟠 P1 | SMS / Email 送不出 | 訂單主流程不受影響、通知狀態可追 |
| E6 | 🟡 P2 | Webhook 簽章驗證失敗 | 拒收並告警、不影響其他通道 |
| E7 | 🟡 P2 | 外部 POS / 會計同步落後 | 以本系統為真、落後可對帳補回 |

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
| X7 | 金流通道斷線時顧客正在付款 | CUSTOMER + External | 🟠 P1 | fallback 通道、重試、狀態同步 |
| X8 | 平台同步菜單時店家剛下架 | OWNER + External | 🟠 P1 | 源真相為本系統、外部通道更新 |
| X9 | Admin 停用 Owner 時該 Owner 正操作 | ADMIN + OWNER | 🔴 P0 | session 即時失效、寫操作被拒 |
| X10 | 營業中升級應用版本 | ADMIN + 全體 | 🟡 P2 | 平滑升級、連線不中斷、舊客戶端降級 |
| X11 | Manager 代理期間跨越班次結帳 | MANAGER + CASHIER | 🟠 P1 | 代理權不隨班次結束、audit 軌跡完整 |

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
| 離線 / 降級模式 | integration + targeted E2E |
| 通知通道 | contract test + integration |
| 可存取性 a11y | static audit（axe / lighthouse）+ targeted E2E |
| i18n / 時區 / locale | snapshot + targeted E2E |
| 合規 / 資料保留 / PII | integration + 人工 drill |
| 硬體 / 列印 agent | local agent test + integration |
| 第三方依賴失效 | contract test + circuit-breaker integration |
| 效能預算 P99 / WS | perf harness（對齊 CLAUDE.md 目標） |

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
- Admin：備份還原演練（A6）
- Guest：token 偽造
- External：金流通道 timeout / webhook 雙觸發（E1、E2）
- Cross：Admin 停用 Owner 即時失效（X9）
- Manager：代理身份 audit 分離（M1）

### P1

- Owner：批次改價 transaction
- Owner：停用員工時有進行中工作
- Owner：營業中改稅率
- Service：送錯桌 / 改地址、多單派工、裝置交接（S1、S2、S5、S7）
- Chef：列印機 fallback、套餐拆單、缺料替代、菜單變更（H4、H7–H9）
- Admin：PII 匯出 audit、被遺忘權、On-call 降級（A3、A5、A7）
- Customer：離線送單、套餐必選驗證（C13、C14）
- Cashier：刷卡暴力攔截（K11）
- External：第三方平台同步、印表機、通知（E3–E5）
- Manager：代理期結束回收、跨店越權、覆核差異（M2–M4）
- Cross：金流斷線、平台同步、Manager 跨班（X7、X8、X11）

---

## 16. 變更紀錄

| 日期 | 作者 | 異動 |
| --- | --- | --- |
| 2026-04-16 | @claude | 初版骨架，6 Persona + Guest |
| 2026-04-16 | Codex | 擴充為「功能模組 × Persona」版本 |
| 2026-04-23 | Claude | 新增 MANAGER persona（Section 11.5）、External Integrations 模組（Section 12.5）、Module 17；CUSTOMER 補 H/I/J 子模組與 C13–C15；CHEF 補 E 子模組與 H7–H9；SERVICE 補 D 子模組與 S5–S7；CASHIER 補 K11；ADMIN 補 E 子模組與 A5–A7；cross-persona 補 X7–X11；非功能測試對照補 7 列；Section 5 加入 Test Oracle 與效能預算對齊 |
