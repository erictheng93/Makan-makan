# Phase B / C / D 執行階段拆解與驗收標準

> 配套文件：
> - `2026-08-04-group-ordering-phase-b-collaborative-cart.md`
> - `2026-08-04-group-ordering-phase-c-finalize-checkout.md`
> - `2026-08-04-group-ordering-phase-d-split-billing.md`
> - Phase A 稽核紀錄：`2026-08-04-group-ordering-phase-a-AUDIT.md`
>
> 角色分工：使用者實作，Claude 稽核。稽核規則沿用 Phase A 文件的四條（證據優先、不接受 mock 掩蓋的通過、一條不過即退回、只看程式碼與標準不看自述）。
>
> 建立日期：2026-08-05。Plan D 經使用者決議納入本輪範圍（稽核方原建議延後，已被否決並接受）。

---

## Stage 0：動工前必須解決的跨 plan 問題

這三項是稽核 B/C/D 三份 plan 時發現的，其中 X-1 會改變 C Task 2 與 D Task 1 的實作內容，**必須在寫任何 finalize 或 split 程式碼之前決定**。

### X-1（P0）分帳金額不含稅與服務費 — 跨 C/D 的金額缺口

Plan C Task 2 的 `finalizeGroupOrder` 先呼叫 `OrderService.createOrder` 建立真實訂單（由餐廳設定計算出正確的稅與服務費），接著呼叫：

```typescript
await this.splitBill(groupOrderId, {
  splitType: groupOrder.splitType as ...,
  serviceChargeRate: 0,
  taxRate: 0,
});
```

Plan C 第 351 行明載這是刻意的，並把「按比例分攤餐廳的稅／服務費」交棒給 Phase D。

**但 Plan D 沒有接到這一棒。** D Task 1 的 proportional 分支吃的是 `serviceChargeRate` / `taxRate` **費率**參數，沿用與 individual 相同的公式；它從未讀取 `createOrder` 回傳訂單上已算好的稅額與服務費**絕對金額**。在 finalize 傳入 0 的情況下，proportional 與其他分支一樣只算出品項小計。

**淨結果**：B/C/D 全部做完之後，所有成員的 `split_bills` 加總 = 品項小計；餐廳實際收取 = 小計 + 稅 + 服務費。差額是整筆稅與服務費，且不會有任何測試失敗來提醒。兩份 plan 的 self-review 都沒抓到，因為各自指向對方。

**必須決定**（擇一，並在動工前寫回對應的 plan）：

- **(a) finalize 把真實金額傳給 splitBill** — `splitBill` 增加吸收絕對金額的輸入（例如 `sharedServiceChargeCents` / `sharedTaxCents`），由 finalize 從 `createOrder` 回傳的訂單填入，proportional 依各成員小計佔比分配。這同時讓 proportional **第一次有了與 individual 不同的行為**，也就順帶解決了 D 原本「無法驗證」的問題。稽核方建議此案。
- **(b) 明確承認分帳只涵蓋小計** — 若採此案，必須是產品決策而非預設值：`split_bills` 必須有欄位或顯示層明示「未含稅與服務費」，且 D Task 2 的對帳基準必須改寫為小計而非訂單總額。使用者端看到的金額與實收金額不一致，這件事不能只存在於 plan 註解裡。

### X-2（P1）D Task 2 的對帳基準未定義

D Task 2 的目標敘述是「`sum(member totals in cents) === toRequiredCents(finalAmount)`」，但實作片段比對的是：

```typescript
const trueTotalCents  = toRequiredCents(splitBillsData.reduce((s, b) => s + b.totalAmount, 0));
const roundedTotalCents = splitBillsData.reduce((s, b) => s + toRequiredCents(b.totalAmount), 0);
```

兩邊都源自 `splitBillsData` 自己，只對齊了「逐筆進位」與「先加總再進位」的差異，**沒有對齊真實訂單的 `finalAmountCents`**。在 X-1 未解決的前提下，這個對帳即使完全通過，分帳總額仍然與餐廳實收金額不符。X-1 選 (a) 時，此處的基準必須改為真實訂單總額。

### X-3（P2）D Task 2 測試草稿的 creator 判定無效

```typescript
const hostBill = result.data!.find((b) => /* the seeded creator's memberId */ true);
```

`find(() => true)` 回傳第一筆，與 creator 無關。Plan 已在下方註記要換掉，驗收時會確認實際測試檔沒有殘留這個寫法 — 餘數落到誰身上是 D Task 2 的全部重點，用第一筆冒充等於沒測。

---

## 階段拆解

B/C/D 三份 plan 共 12 個 task。依照已決議的發布綁定（C Task 1-4 先行、B + C Task 5 同批），再加上 X-1 帶來的順序調整，重排為 5 個階段。

**與 plan 原始順序的差異**：D 被提前到 C Task 2 之前。理由是 `finalizeGroupOrder` 會呼叫 `splitBill`，若分帳數學還沒定案就先寫 finalize，finalize 得寫兩次；而且在 X-1 選 (a) 的情況下，`splitBill` 的輸入介面會改變，finalize 必須照新介面寫。先把錢算對，再把它接到路由與 cron 上。

| Stage | 內容 | 部署 | 稽核關卡 |
| --- | --- | --- | --- |
| **1 型別對齊** | C Task 1（`GroupOrderStatus`） | 隨 Stage 4 | Gate E |
| **2 分帳數學** | D Task 1（proportional）+ D Task 2（餘數對帳） | 隨 Stage 4 | Gate F |
| **3 Finalize** | C Task 2（`finalizeGroupOrder`）+ D Task 3（`processPayment` 驗證） | 隨 Stage 4 | Gate G |
| **4 對外介面** | C Task 3（`/lock` 路由）+ C Task 4（到期 cron） | **API 獨立部署** | Gate H |
| **5 前端** | B Task 1-4 + C Task 5 | **單次 Pages 部署** | Gate I + 總驗收 |

Stage 1-4 全部在 API，可以連續做、一次部署。Stage 5 走獨立整合分支（`feat/group-ordering-cart-checkout`）。

---

## Stage 1：型別對齊（C Task 1）

- [ ] **E-1** `GroupOrderStatus` 改為 `"active" | "checkout" | "completed" | "cancelled"`，與服務實際讀寫的值一致。
- [ ] **E-2** 原型別中的 `"locked"` / `"finalized"` / `"expired"` 移除後，**所有引用點都已處理**，不是用 `as` 斷言掩蓋。
  證據：`grep -rn '"locked"\|"finalized"\|"expired"' apps/api/src/features/group-orders/` 的輸出，每一處都能說明為何合理。
- [ ] **E-3** `"ordering"` 這個只在到期查詢中出現的值有明確歸屬 — 要嘛納入 union，要嘛證明該查詢是死路徑。不可留在型別外繼續被字串比對。
- [ ] **E-4** `pnpm --filter @makanmakan/api typecheck` 通過，且既有 group-orders 測試全綠。

## Stage 2：分帳數學（D Task 1-2）

**前置**：X-1 已決定並寫回 plan。以下標準假設選 (a)；若選 (b)，F-3／F-6 依該決議改寫。

- [ ] **F-1** `splitType: "proportional"` 不再回傳 `Unsupported split type`。
- [ ] **F-2** proportional 的每位成員金額符合明確的預期數值（測試寫死期望值，不是只比對「與 individual 相同」）。
- [ ] **F-3** **存在一組定額共同費用不為零的測試，證明 proportional 與 individual 算出不同結果**，且成員小計不均。這是 proportional 分支唯一真正被驗證的方式 — 沒有這條，該分支等同未測試的死碼。
- [ ] **F-4（tripwire）** 保留一條在定額費用為零時斷言 proportional === individual 的特徵測試，並在測試中註明「此等價關係只在無定額共同費用時成立」。目的是讓未來有人加入定額費用（例如外送費）卻忘記擴充 proportional 公式時，這條測試**會失敗**。它不是文件，是絆線。
- [ ] **F-5** 餘數對帳後，`sum(所有成員 totalAmountCents)` 與對帳基準**完全相等**，至少涵蓋：3 人均分 $100、2 人均分 $0.01、成員數 > 金額分數的退化情境。
- [ ] **F-6** 對帳基準是**真實訂單總額**（X-1 (a)）而非 `splitBillsData` 自身加總。測試必須以一個與 `splitBillsData` 不同來源的總額作為期望值，否則 X-2 的問題原封不動。
- [ ] **F-7** 餘數確實落在 `role: "creator"` 的成員身上，測試以實際 seed 的 creator id 斷言，**不得出現 `find(() => true)`**（X-3）。
- [ ] **F-8** 餘數為負（逐筆進位後總和超過真實總額）的情境有測試涵蓋 — plan 的實作允許負餘數，但草稿測試只涵蓋短少的方向。
- [ ] **F-9** D Task 3 若失敗，依 plan Step 2 的指示改為「修 `processPayment`」而非改測試遷就；驗收時需說明實際結果是哪一種。
- [ ] **F-10** 金額全程遵循既有慣例：`splitBill` 內以浮點計算、僅在 DB 寫入邊界經 `toRequiredCents` 轉換，不新增第二條 cents-native 路徑。

## Stage 3：Finalize（C Task 2 + D Task 3）

- [ ] **G-1** `finalizeGroupOrder` 委派 `OrderService.createOrder`，**不自行產生訂單編號、稅費計算、優惠券或庫存扣減**。
- [ ] **G-2** 冪等性：以群組單 id 衍生的 `clientMutationId` 送出；重複呼叫時捕捉 `CLIENT_MUTATION_DUPLICATE` 並回傳既有訂單，而非產生第二張訂單或向上拋錯。測試需涵蓋「同一群組單連續 finalize 兩次」。
- [ ] **G-3** 併發保護：兩個同時進行的 finalize（host 按下鎖定的同時 cron 也掃到）只會產生一張訂單。plan 提到 mutex，驗收要看到它實際擋住併發的測試，而非僅有 `clientMutationId` 這層事後補救。
- [ ] **G-4** `"pickup"` → `deliveryInfo.type: "takeaway"` 的映射有測試；`"dine_in"` 與 `"delivery"` 直通。
- [ ] **G-5** `customizations` 刻意不翻譯這件事有測試固定住現況（finalize 後的訂單品項不帶 customizations，`specialInstructions` 轉為 `notes`），避免日後有人誤以為是遺漏而隨手加上錯誤的轉換。
- [ ] **G-6** `this.db.session.client` 依 plan Step 3 的指示查證過；若不可用，改以建構子既有的 `D1Database` 建立 `OrderService`，**不得靠 Drizzle 內部結構取得**。驗收時說明實際採用哪一種。
- [ ] **G-7** 空購物車、已 `completed`、已 `cancelled` 的群組單呼叫 finalize 的行為有定義且有測試。
- [ ] **G-8** finalize 成功後 `masterOrderId` 已寫入，且 `status` 的最終值與 `processPayment` 既有的收斂邏輯不衝突（plan Task 1 Step 3 有註記，驗收要看到證明兩者收斂到相同狀態的測試）。

## Stage 4：對外介面（C Task 3-4）→ API 部署

- [ ] **H-1** `POST /orders/group/:groupOrderId/lock` 只有**主辦人**可呼叫。guest 主辦以 `memberToken` 驗證，不是靠 JWT — Phase A 之後主辦人可能根本沒有帳號。這條若做錯，任何成員都能替全桌送出訂單。
- [ ] **H-2** `/lock` 有速率限制，且對非主辦人的拒絕不洩漏群組單是否存在。
- [ ] **H-3** cron 依 `autoSubmitOnExpiry` 分流：`true` → finalize，`false` → cancel。兩條路徑各有測試。
- [ ] **H-4** cron 對單一群組單的失敗不會中斷整批掃描，且失敗計入回傳的 `errors`。
- [ ] **H-5** **cron 重疊執行不會重複送單** — 這是全套最高風險處，會產生真實金額的訂單。需要證明兩次重疊的 sweep 只產生一張訂單的測試（`clientMutationId` 若以群組單 id 衍生即具備，但要有測試證明它確實生效）。
- [ ] **H-6** 5 分鐘警告不會重複發送；cron 每次執行都重發等同對顧客洗版。
- [ ] **H-7** cron 運算式已登記於 `apps/api/wrangler.toml` 的 `[triggers] crons`，且 `scheduled` handler 的 `cronMatches` 分派**逐字比對**運算式字串（Phase A 的 Rust refactor 稽核已踩過這個坑）。
- [ ] **H-8** `pnpm --filter @makanmakan/api test` 全綠、typecheck、lint 通過。
- [ ] **H-9** 部署後確認 cron 已在 Cloudflare 註冊，且首次執行沒有錯誤 — 此時尚無群組單可掃，屬預期的空轉。

## Stage 5：前端（B Task 1-4 + C Task 5）→ 單次 Pages 部署

- [ ] **I-1** 所有 REST 呼叫路徑都存在，`/group-orders/...` 前綴零出現。
  證據：`grep -rn "group-orders" apps/customer-app/src` 應無 API 路徑用途的命中。
- [ ] **I-2** 購物車變更不再由客戶端向其他人廣播；伺服器推送是唯一的 fan-out。
- [ ] **I-3** `GroupCartPanel.vue` 未被修改。證據：`git diff --stat` 中不含該檔。
- [ ] **I-4** Task 4 的四項憑證標準：建立時同時持久化 `memberToken` 與 `recoveryCode`；重新整理**不需要**恢復碼即可保住主辦權；恢復碼預設不顯示，需明確操作才展開；分享連結不含恢復碼且有測試斷言。
- [ ] **I-5** `/recover` 的 400 與 429 分別有可辨識的提示，429 的訊息包含 15 分鐘等待。
- [ ] **I-6** 恢復成功後舊裝置的 `memberToken` 失效，且 App 對此有明確的「工作階段已失效」狀態，**不是靜默失敗**（Plan B Task 4 Step 7 第 5 步）。
- [ ] **I-7** C Task 5 的 `submitOrder()` 已接上 `/lock`，Plan B 的拋錯 stub 已完全移除。
  證據：`grep -rn "not yet available" apps/customer-app/src/composables/useGroupOrder.ts` 應無命中。
- [ ] **I-8** 路由可達：`/group/:shareCode` 與 `/group/order/:groupOrderId` 均已註冊，且 `GroupOrderJoinView` 的 `router.push` 佔位 `undefined` 已替換為真實 id。
- [ ] **I-9** UI 已套用 `docs/UIUX-design-system.md`（Plan B Task 3 Step 3 將骨架標記為「功能非最終」，發布前必須補上這一關）。
- [ ] **I-10** 端對端手動驗證：建立 → 分享 → 第二裝置加入 → 雙方各自加購 → 即時同步 → 主辦鎖定 → 產生真實訂單 → 分帳金額加總等於訂單總額（此步直接驗證 X-1 是否真的被解決）。
- [ ] **I-11** `pnpm typecheck && pnpm lint` 全綠，customer-app 測試全綠。

---

## 範圍界線

**在範圍內**：B/C/D 三份 plan 明列的 12 個 task，加上 X-1 決議所需的 `splitBill` 介面調整。

**不在範圍內**：外送費本身的建模與餐廳端設定 UI（C 已明列 out of scope）、`customizations` 的自動轉換（型別結構不相容）、逐連線推送到期警告、成員在線狀態（presence）。

**已知會被推遲的決策**：`/recover` 的 36 字元 UUID 搭配 15 分鐘 5 次的限制，其根本解屬 Phase A 的 schema／設定決策，Plan B 已列為 open question，本輪不處理。
