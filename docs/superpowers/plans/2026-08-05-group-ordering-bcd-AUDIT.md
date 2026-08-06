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

**決議：採 (a)，已於 2026-08-05 寫回 Plan C Task 2 與 Plan D Task 1-2。**

`splitBill` 新增 `sharedServiceChargeCents` / `sharedTaxCents` / `orderTotalCents`（皆為選用，`/split` 路由的費率呼叫不受影響），由 `finalizeGroupOrder` 從 `createOrder` 回傳的訂單填入。絕對金額存在時**優先於**費率，避免重複計費。

**稽核方先前的一項說法在此更正**：原本寫「(a) 會順帶讓 proportional 第一次與 individual 不同」，這是錯的。稅與服務費本身即依小計比例計算，按小計佔比分配它們，等同於對各自小計套用同一組費率 — 也就是 individual 現行的做法。**(a) 買到的是「分帳總額等於訂單總額」，不是讓 proportional 產生差異。** 若照原說法寫進驗收標準，等於逼實作者發明一個假的差異，正是 Plan D Global Constraints 明文禁止的事。F-3 已依此重寫。

範圍比原本 Task 1 想像的大：**每個分支都要定義如何吸收這筆共同費用**，不只是 proportional。以 `splitType: "equal"` 完成的團購單一樣會少收，而 equal 才是多數群組實際會用的。

### X-2（P1）D Task 2 的對帳基準未定義

D Task 2 的目標敘述是「`sum(member totals in cents) === toRequiredCents(finalAmount)`」，但實作片段比對的是：

```typescript
const trueTotalCents  = toRequiredCents(splitBillsData.reduce((s, b) => s + b.totalAmount, 0));
const roundedTotalCents = splitBillsData.reduce((s, b) => s + toRequiredCents(b.totalAmount), 0);
```

兩邊都源自 `splitBillsData` 自己，只對齊了「逐筆進位」與「先加總再進位」的差異，**沒有對齊真實訂單的 `finalAmountCents`**。在 X-1 未解決的前提下，這個對帳即使完全通過，分帳總額仍然與餐廳實收金額不符。

**已隨 X-1 (a) 解決**：對帳基準改為 `splitData.orderTotalCents ?? （內部加總）` — finalize 供給真實訂單總額，`/split` 路由（此時尚無真實訂單）沿用內部加總。已寫回 Plan D Task 2。同時補上 F-11 的界限檢查，因為改用外部基準之後，這段程式碼會把**任何**差異都算到主辦人頭上。

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

> **稽核方前置調查（2026-08-05）** — 以下事實已查證，實作時不必重查：
>
> - `GroupOrderStatus` 全 repo 只有 5 個引用點，全在 group-orders 內：`types/index.ts:21`（`GroupOrder.status`）、`types/index.ts:63`（定義）、`GroupOrdersService.ts:112`（import）、`GroupOrdersService.ts:2042`（唯一實際套用處）、`index.ts:33`（re-export）。
> - `"locked"` / `"finalized"` / `"expired"` 在 group-orders 內**只出現在型別定義本身**。repo 其他地方的同名字串屬於 idempotency middleware、scheduling、coupons、partnerships、verification 等無關領域，移除不影響它們。
> - `groupOrders.status` 的**寫入**只有四個值：`"active"`（:309、:807）、`"checkout"`（:1281）、`"completed"`（:1479）、`"cancelled"`（:1687）。（:1607 的 `"removed"` 屬 `group_cart_items.status`，不同表。）
> - **`"ordering"` 從未被寫入任何地方**，只有兩處讀取：`:1554` 的 `status !== "active" && status !== "ordering"`，與 `:1674` 的 `inArray(status, ["active","ordering","checkout"])`。兩處都是無效條件。

- [ ] **E-1** `GroupOrderStatus` 改為 `"active" | "checkout" | "completed" | "cancelled"`，與服務實際讀寫的值一致。
- [ ] **E-2** `"locked"` / `"finalized"` / `"expired"` 自 union 移除。依上述調查，除型別定義外無其他引用點，故本項應為單純刪除；若實作時發現任何額外引用點，需逐一說明。
- [ ] **E-2b（陷阱，最容易漏）** `GroupOrdersService.ts:2042` 的 `status: data.status as GroupOrderStatus` 是型別**唯一**實際套用之處，而它是斷言。Drizzle 欄位是純 `text`，所以縮小 union **不會**在此產生任何編譯錯誤 — typecheck 全綠不代表這裡安全。必須改為具備驗證的收斂（未知值落到安全預設並記錄），或明確說明為何斷言可接受。單純留著斷言不予處理即為不通過。
- [ ] **E-3** `"ordering"` 依調查為死值：從 `:1554` 與 `:1674` 兩處讀取中移除，**不納入** union。同時更新 `packages/database/src/schema/group-orders.ts:44` 的欄位註解（現為 `// active, ordering, checkout, completed, cancelled`），否則註解會繼續誤導下一個人。
- [ ] **E-3b（正式資料確認）** legacy migration 的 CHECK 約束曾允許 `'ordering'`，本機 D1 目前 `group_orders` 無資料列，無法據此排除正式環境。合併前需確認正式資料庫沒有 `status = 'ordering'` 的列：
  `wrangler d1 execute makanmasak-prod --remote --env production --config=./apps/api/wrangler.toml --command "SELECT status, count(*) FROM group_orders GROUP BY status;"`
  若確實存在該狀態的列，E-3 的刪除方案需改為先行資料遷移，不可直接縮小型別 — 否則 E-2b 的斷言會對一個實際存在的執行期值說謊。
- [ ] **E-4** `pnpm --filter @makanmakan/api typecheck` 通過，且既有 group-orders 測試全綠。注意 E-2b：本項通過**不足以**證明 E-2b 通過。

### Gate E 稽核結果（2026-08-05）：**通過**

實作 commit `9729c4c3`。**注意：本階段由稽核方自行實作，故 Gate E 為自我稽核，強度低於 Phase A 那種實作／稽核分離的關卡。**

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| E-1 | 通過 | union 為 `active / checkout / completed / cancelled`，以 `GROUP_ORDER_STATUSES` 常數推導 |
| E-2 | 通過 | `locked` / `finalized` / `expired` 僅存在於說明註解，無程式碼引用 |
| E-2b | 通過 | `as GroupOrderStatus` 已自 service/routes 消失；改為 `parseGroupOrderStatus()` + `narrowStatus()`，未知值落回 `"active"` 並記錄 `UNKNOWN_GROUP_ORDER_STATUS`；兩條測試涵蓋（含以 `"ordering"` 為輸入） |
| E-3 | 通過 | 兩處讀取已移除，schema 註解已更新；`"ordering"` 僅殘留於測試 fixture |
| E-3b | 通過 | 正式 D1：`SELECT count(*) FROM group_orders` → `0`，`GROUP BY status` → 空集合。無資料遷移需求 |
| E-4 | 通過 | typecheck、lint 通過；group-orders 50 tests passed |

額外查核（原標準未列，稽核方主動檢查）：`schemas/validation.ts` 無 status enum、路由層無硬編碼狀態值、前端未依賴被移除的值 — 皆無命中，確認 E-2 的「單純刪除」判斷成立。

**新發現（不阻斷本關，列為後續）**：有兩條回應路徑繞過 `formatGroupOrder`，直接輸出原始 `status`：

- `GroupOrdersService.ts:240`（`listGroupOrders`）→ 目標型別 `types/index.ts:159` 的 `status: string`
- `GroupOrdersService.ts:444`（`previewGroupByShareCode`）→ `GroupOrderJoinPreview.status: string`

兩者的目標型別都宣告為 `string`，因此不構成型別謊言，E-2b 成立。但這代表 union 在這兩個端點上不是實際契約，`narrowStatus` 不會執行，資料庫裡任何非預期值可直達客戶端。若要讓型別真正成為契約，這兩處應改用 `GroupOrderStatus` 並經 `narrowStatus`。範圍小，可併入 Stage 2 或獨立處理。

---

## Stage 2：分帳數學（D Task 1-2）

**前置**：X-1 已決定並寫回 plan。以下標準假設選 (a)；若選 (b)，F-3／F-6 依該決議改寫。

- [ ] **F-1** `splitType: "proportional"` 不再回傳 `Unsupported split type`。
- [ ] **F-2** proportional 的每位成員金額符合明確的預期數值（測試寫死期望值，不是只比對「與 individual 相同」）。
- [ ] **F-3** **四個分支各有一條「共同費用不為零」的測試**，成員小計不均，且期望值寫死：
  - `individual` / `proportional` → 依小計佔比分攤
  - `equal` → 均分（人頭）
  - `custom` → 依 custom 金額佔比
  這取代了原本「證明 proportional 與 individual 不同」的要求 — 該差異在目前只有比例型共同費用的前提下並不存在，硬要求它只會逼出一個發明出來的假差異。真正要驗證的是**每個分支都把共同費用分光**，四條加總都回到訂單總額。
- [ ] **F-3b** `totalCartAmount === 0`（以及 custom 金額加總為 0）時不產生 `NaN`，退回人頭均分。`NaN` 會直接寫進資料庫。
- [ ] **F-4（tripwire）** 保留一條在定額費用為零時斷言 proportional === individual 的特徵測試，並在測試中註明「此等價關係只在無定額共同費用時成立」。目的是讓未來有人加入定額費用（例如外送費）卻忘記擴充 proportional 公式時，這條測試**會失敗**。它不是文件，是絆線。
- [ ] **F-5** 餘數對帳後，`sum(所有成員 totalAmountCents)` 與對帳基準**完全相等**，至少涵蓋：3 人均分 $100、2 人均分 $0.01、成員數 > 金額分數的退化情境。
- [ ] **F-6** 對帳基準是**真實訂單總額**（X-1 (a)）而非 `splitBillsData` 自身加總。測試必須以一個與 `splitBillsData` 不同來源的總額作為期望值，否則 X-2 的問題原封不動。
- [ ] **F-7** 餘數確實落在 `role: "creator"` 的成員身上，測試以實際 seed 的 creator id 斷言，**不得出現 `find(() => true)`**（X-3）。
- [ ] **F-8** 餘數為負（逐筆進位後總和超過真實總額）的情境有測試涵蓋 — plan 的實作允許負餘數，但草稿測試只涵蓋短少的方向。
- [ ] **F-9** D Task 3 若失敗，依 plan Step 2 的指示改為「修 `processPayment`」而非改測試遷就；驗收時需說明實際結果是哪一種。
- [ ] **F-10** 金額全程遵循既有慣例：`splitBill` 內以浮點計算、僅在 DB 寫入邊界經 `toRequiredCents` 轉換，不新增第二條 cents-native 路徑。新增的 `*Cents` 輸入在函式入口**一次**轉為元，其後不再出現分/元混用。
- [ ] **F-11（安全閥）** 差額超出「每位成員 1 分」的界限時，`splitBill` 回傳失敗並記錄 `SPLIT_TOTAL_MISMATCH`，**不得**把差額塞給主辦人。若 Step 3a 沒把共同費用分配出去，未設界限的對帳會讓主辦人默默吃下整筆稅費 — 這是本階段最容易造成真實金錢損失的單一路徑。需有測試證明超界時失敗、界內時正常吸收。
- [ ] **F-12** 絕對金額與費率同時傳入時，以絕對金額為準、費率被忽略，有測試證明不會重複計費。既有 `/split` 路由（純費率）的行為完全不變 — 以現有測試全綠為證。
- [ ] **F-13（自 Gate E 併入）** 兩條繞過 `formatGroupOrder` 的原始 status 出口收斂：`GroupOrdersService.ts:240`（`listGroupOrders`）與 `:444`（`previewGroupByShareCode`）改走 `narrowStatus`，其目標欄位型別（`types/index.ts:159` 的 `status: string`、`GroupOrderJoinPreview.status`）改為 `GroupOrderStatus`。收斂後 union 才真正是這兩個端點的契約。需有測試證明非預期的資料庫值不會原樣送達客戶端。

### Gate F 稽核結果（2026-08-05）：**通過**

實作 commit `d2a1f86b`（使用者實作，稽核方獨立驗證）。稽核方重跑：group-orders 66 tests passed、typecheck、lint 皆通過。

F-1 ~ F-13 全數達標。四個分支的定額費用分攤都有非零測試（individual 見「absolute shared cents」、proportional 見「external order total」、custom 見「custom amount ratio」、equal 見餘數測試中的三人 10000 cents 人頭均分）；F-11 兩側齊備且斷言了 `SPLIT_TOTAL_MISMATCH` 代碼；F-7 用實際 creator id，無 `find(() => true)`。

實作有兩處優於 plan：餘數吸收以 `fromCents(toRequiredCents(x) + remainder)` 在分的領域完成，避免 plan 原稿 `+= remainder/100` 的浮點再入；`finalAmountCents` 改為逐筆進位後加總，與 `split_bills` 實際寫入值一致。

**三項發現（皆不阻斷）**

1. **F-4 的 tripwire 已失效。** `proportional` 被併入 `by_item || individual || proportional` 同一個條件，而非 Plan D Step 3b 所寫的獨立 `else if`。結構上這樣更好（兩者不會漂移），但 F-4 的測試現在比較的是**同一段程式碼的兩個名字**，恆真、永遠不會失敗。它原本的用途是在有人加入非比例型共同費用時觸發警報；分支合併後，定額費用會被同樣套用到兩者，測試依舊通過，沒有人會被提醒 proportional 此時應該要不同。建議把警告移到分支條件本身，讓下一個編輯該處的人被告知「加入非比例型費用時必須拆開這個分支」。
2. **`allocateSharedAmount` 的零值退路除以 `members.length`，但 `custom` 分支是對 `customAmounts` 逐筆發放。** 當 custom 名單少於成員數且金額加總為 0 時，共同費用會分配不足。它會撞上 `SPLIT_TOTAL_MISMATCH` 而失敗，屬 fail-safe 而非靜默少收；現有測試兩者數量相同，未涵蓋此情境。退路的除數應與該分支實際發放的對象數一致。
3. **餘數吸收後 `group_orders` 自身的金額欄位不再自洽。** `finalAmountCents` 是調整後的目標值，但 `totalAmountCents` / `taxAmountCents` / `serviceChargeCents` 來自未調整的逐筆加總，因此 subtotal + tax + service 與 final 會相差數分。目前沒有程式同時讀這四個欄位，但對帳報表或會計流程會抓到。

**三項發現已於 `122ddd27` 全部關閉**：警告移至分支條件本身（測試端同步改寫為「這是文件不是絆線」）；`allocateSharedAmount` 改收 `recipientCount`，custom 分支傳入 `customAmounts.length`；餘數同時調整 creator 的 `subtotal` 與 `totalAmount`，並新增測試斷言每筆帳單 `subtotal + serviceCharge + taxAmount === totalAmount`。67 tests passed。

`group_orders.totalAmountCents` 與 final 之間的差額**維持現狀未動**：該欄位有兩處讀取點都當作群組顯示總額，把它從「購物車總額」改為「已開帳單小計加總」會改變 custom 分帳時使用者看到的數字 — 那是語意決策，不該混在缺陷修正裡。若日後要做對帳報表再一併處理。

**帶往 Stage 3 的注意事項**：`SPLIT_TOTAL_MISMATCH` 觸發時，Phase C 的 finalize **已經建立了真實訂單**。若 `totalCartAmount` 與 `OrderService` 算出的金額出現非進位級的落差（例如加入購物車到 finalize 之間菜單價格變動），splitBill 會失敗而訂單已成立。Gate G 需涵蓋此路徑的處置，見 G-9。

---

## Stage 3：Finalize（C Task 2 + D Task 3）

- [ ] **G-1** `finalizeGroupOrder` 委派 `OrderService.createOrder`，**不自行產生訂單編號、稅費計算、優惠券或庫存扣減**。
- [ ] **G-2** 冪等性：以群組單 id 衍生的 `clientMutationId` 送出；重複呼叫時捕捉 `CLIENT_MUTATION_DUPLICATE` 並回傳既有訂單，而非產生第二張訂單或向上拋錯。測試需涵蓋「同一群組單連續 finalize 兩次」。
- [ ] **G-3** 併發保護：兩個同時進行的 finalize（host 按下鎖定的同時 cron 也掃到）只會產生一張訂單。plan 提到 mutex，驗收要看到它實際擋住併發的測試，而非僅有 `clientMutationId` 這層事後補救。
- [ ] **G-4** `"pickup"` → `deliveryInfo.type: "takeaway"` 的映射有測試；`"dine_in"` 與 `"delivery"` 直通。
- [ ] **G-5** `customizations` 刻意不翻譯這件事有測試固定住現況（finalize 後的訂單品項不帶 customizations，`specialInstructions` 轉為 `notes`），避免日後有人誤以為是遺漏而隨手加上錯誤的轉換。
- [ ] **G-6** `this.db.session.client` 依 plan Step 3 的指示查證過；若不可用，改以建構子既有的 `D1Database` 建立 `OrderService`，**不得靠 Drizzle 內部結構取得**。驗收時說明實際採用哪一種。
- [ ] **G-7** 空購物車、已 `completed`、已 `cancelled` 的群組單呼叫 finalize 的行為有定義且有測試。
- [ ] **G-8** finalize 成功後 `masterOrderId` 已寫入，且 `status` 的最終值與 `processPayment` 既有的收斂邏輯不衝突（plan Task 1 Step 3 有註記，驗收要看到證明兩者收斂到相同狀態的測試）。
- [ ] **G-9（自 Gate F 帶入）** `splitBill` 回傳 `SPLIT_TOTAL_MISMATCH` 時，真實訂單**已經建立**。finalize 必須對此有明確處置並有測試：不得回報成功、不得靜默吞掉、且需留下足以人工介入的紀錄（至少 `masterOrderId` 與兩邊金額）。同時要決定 `group_orders.status` 停在哪個狀態 — 訂單已成立但分帳未產生，這個中間狀態目前的 union 沒有對應值，若需要新增則回到 Gate E 的型別收斂一併處理。

### Gate G 稽核結果（2026-08-06）：**通過**

實作 commit `b013a80b`（使用者實作，稽核方獨立驗證）。稽核方重跑：74 tests passed、typecheck、lint 皆通過。

G-1 ~ G-9 全數達標。特別確認：

- **G-3 是真正的互斥**，不只是事後補救。`active -> finalizing` 用 conditional update + `.returning()` 做原子 CAS，`claimedRows.length === 0` 判定搶輸；搶輸方若發現 `masterOrderId` 已存在則收斂為成功並回傳既有訂單。這比 plan 要求的更紮實。
- **失敗時會釋放 claim**，且釋放條件為 `status = 'finalizing' AND masterOrderId IS NULL` — 訂單已建立時不會誤放回 `active`。
- **G-5 有明確斷言** `not.toHaveProperty("customizations")`，而非僅靠註解。
- **G-6 結論**：不使用 `this.db.session.client`，改以建構子收到的 raw `D1Database` 建立 `OrderService`。符合 plan 的指示。
- **G-9**：新增 `finalizing_failed`，保留 `masterOrderId`，人工介入資料寫入 `settings.finalizeFailure`，並排除於到期掃描之外。

**兩項發現（皆不阻斷）**

1. **`finalizeFailure` 不存在於 `GroupOrderSettings` 型別中**，因此寫入時用了 `as unknown as GroupOrderSettings`。這與 Gate E 的 E-2b 是同一類問題：G-9 要求的人工介入資料，存在一個型別系統看不見的欄位裡 — 無法被發現、無法被安全讀取、重構時不會有任何保護。應加入 `packages/shared-types/src/schema-json-types.ts` 的 `GroupOrderSettings`，斷言即可移除。
2. **`finalizing` 有殭屍風險。** claim 之後若 isolate 被逾時或驅逐而未進到 catch，狀態會永久停在 `finalizing`：到期掃描只查 `["active","checkout"]` 不會處理它，而 `finalizeGroupOrder` 對 `finalizing` 一律回「已在處理中」。沒有任何回收路徑，且觸發條件只是逾時而非資料錯誤。建議在 Stage 4 的 cron 加入陳舊 claim 回收（例如 `finalizing` 且 `lockedAt` 早於 N 分鐘且 `masterOrderId IS NULL` → 放回 `active`），這比留給人工處理更合適。

**帶往 Stage 5 的注意事項**：Plan B 的 `mapBackendStatus` 目前只映射 `active/checkout/completed/cancelled`，其餘落到預設值 `"open"`。新增的兩個狀態會被顯示成可編輯的購物車 — finalize 進行中或已失敗時，使用者會看到還能改單。Stage 5 實作 Plan B Task 1 時必須一併處理。

---

## Stage 4：對外介面（C Task 3-4）→ API 部署

- [ ] **H-1** `POST /orders/group/:groupOrderId/lock` 只有**主辦人**可呼叫。guest 主辦以 `memberToken` 驗證，不是靠 JWT — Phase A 之後主辦人可能根本沒有帳號。這條若做錯，任何成員都能替全桌送出訂單。
- [ ] **H-2** `/lock` 有速率限制，且對非主辦人的拒絕不洩漏群組單是否存在。
- [ ] **H-3** cron 依 `autoSubmitOnExpiry` 分流：`true` → finalize，`false` → cancel。兩條路徑各有測試。
- [ ] **H-4** cron 對單一群組單的失敗不會中斷整批掃描，且失敗計入回傳的 `errors`。
- [ ] **H-5** **cron 重疊執行不會重複送單** — 這是全套最高風險處，會產生真實金額的訂單。需要證明兩次重疊的 sweep 只產生一張訂單的測試（`clientMutationId` 若以群組單 id 衍生即具備，但要有測試證明它確實生效）。
- [ ] **H-6** 5 分鐘警告不會重複發送；cron 每次執行都重發等同對顧客洗版。
- [ ] **H-7** cron 運算式已登記於 `apps/api/wrangler.toml` 的 `[triggers] crons`，且 `scheduled` handler 的 `cronMatches` 分派**逐字比對**運算式字串（Phase A 的 Rust refactor 稽核已踩過這個坑）。
- [ ] **H-10（自 Gate G 帶入）** cron 回收陳舊的 `finalizing` claim：`status = 'finalizing'` 且 `masterOrderId IS NULL` 且 `lockedAt` 早於一個明確的門檻時，放回 `active`。Stage 3 的 claim 只在正常錯誤路徑釋放，isolate 逾時或被驅逐時狀態會永久卡在 `finalizing`，而到期掃描的 `["active","checkout"]` 查詢碰不到它，`finalizeGroupOrder` 也會一律拒絕 — 沒有回收路徑。門檻需大於 finalize 的最壞執行時間，並需有測試證明「仍在進行中的 claim 不會被誤回收」。`finalizing_failed` **不**在回收範圍內，那是刻意保留給人工處理的終態。
- [ ] **H-8** `pnpm --filter @makanmakan/api test` 全綠、typecheck、lint 通過。
- [ ] **H-9** 部署後確認 cron 已在 Cloudflare 註冊，且首次執行沒有錯誤 — 此時尚無群組單可掃，屬預期的空轉。

### Gate H 稽核結果（2026-08-06）：**不通過** — 一項阻斷，行為面全數達標

實作 commit `3413c8f0`。稽核方獨立重跑：group-orders + expiry 共 80 tests passed、typecheck 通過。

**H-1 ~ H-10 的行為要求全部達成**，且有三處值得記錄：

- **H-1 做得紮實且 fail-closed**。`isHostSession` 以 Drizzle 查 `sessionId` + `role='creator'` + `isActive` + `leftAt IS NULL` 四條件，查詢異常時回 `false` 而非放行。不存在的群組單同樣回 `false`，因此拒絕訊息一致，順帶滿足 H-2 的不洩漏要求。
- **H-7 正確**：`*/5 * * * *` 已存在於 `wrangler.toml`，未新增重複 trigger，handler 逐字比對相符。
- **順手修好了 `apps/api` 的 test script**（原本是 `vitest` watch 模式，`pnpm --filter @makanmakan/api test` 並沒有真的跑 root api project）。這有回溯含意：先前任何以該指令為證據的驗證都比我們以為的弱。稽核方歷次 Gate 皆直接使用 `pnpm exec vitest run --project api`，故各 Gate 結論不受影響。

**阻斷項：`apps/api/src/workers/group-order-expiry.ts` 全檔使用 raw SQL**

219 行新程式碼、**5 條手寫 SQL 語句**（2 SELECT + 3 UPDATE，經 `db.prepare()` 執行）、零 Drizzle schema 引用，並自行宣告了一份 snake_case 的列型別。CLAUDE.md 的「Database Query Strategy（Two Layers — Enforced）」明訂 **Layer 3 raw string SQL 在新程式碼中禁止**。

> 更正（2026-08-06）：本節初稿寫「7 處 `env.DB.prepare()`」，是稽核方以 `grep -c "DB.prepare\|\.bind("` 同時計入兩種樣式所得的錯誤數字。正確為 5 條 SQL 語句。此更正不影響本項判定 — 依據是「有無使用 Drizzle」與硬編欄位／狀態字面值的風險，不是語句數量。

這不是形式問題，此處的風險正是該規則存在的理由：

- 檔案硬編了 `expires_at_ms`（7 次）、`locked_at_ms`（3）、`updated_at_ms`（3）、`master_order_id`、`status`、`settings` 等欄位名，以及 `'active'` / `'finalizing'` 等狀態字面值 — 與 `GROUP_ORDER_STATUSES` 完全沒有連結。本 feature 在過去三個階段**已經改過兩次狀態值**。
- 它在 cron 上無人看管地執行，且會產生真實金額的訂單。欄位漂移在此不是編譯錯誤，是沒有人會立刻發現的靜默失效。
- 它也是 `expiryWarningSentAt` 得以繞過 `$type<GroupOrderSettings>()` 寫入的原因 — 與稽核方前一個 commit 才修掉的 `finalizeFailure` 完全同型的問題。**改用 Drizzle 後這個型別缺口會被強制修正**，兩者是同一項工作。

稽核方需說明：**H-1～H-10 並未包含查詢層要求，這是我列標準時的疏漏**。此處依據的是 CLAUDE.md 的專案層級強制規範。既有 workers 確有 raw SQL 前例（`usage-events-ttl` 1 處、`usage-aggregator` 2 處），但無一達到本檔的規模；而 `credit-expiry`、`market-checkout-reconciliation` 是零直接 DB 存取、全部委派 service，那是更好的樣板。

**修正範圍**：7 處查詢改寫為 Drizzle（Layer 1 為主，必要處用 Layer 2 `sql` + schema refs），移除自訂列型別，`expiryWarningSentAt` 加入 `GroupOrderSettings`。既有 80 條測試即為改寫的保護網。

**兩項非阻斷發現**

1. `wrangler.toml` 的 `*/5 * * * *` 註解仍只寫「Market checkout payment reconciliation」，但現在有兩個不相關的作業共用它。該註解正上方的區塊恰好記載著團隊當初為了能各自調整而把排程拆開 — 下一個要調整 reconciliation 頻率的人會連帶改動群組單到期掃描（包含與 `GROUP_ORDER_EXPIRY_WARNING_MS` 語意綁定的 5 分鐘警告窗）。註解應更新為兩者共用。
2. `index.ts` 在分派處硬編 `"*/5 * * * *"` 字面值，但 worker 已匯出 `GROUP_ORDER_EXPIRY_CRON` 常數。改為引用該常數可消除 H-7 所擔心的那種字串漂移。

**兩項非阻斷發現已於 `b1592db6` 關閉。** 註解改為列出兩個共用作業，並把上方區塊改寫為「此 `*/5` tick 刻意由多個頻繁作業共用；要單獨調整某一個的頻率前請先拆開」— 保留了原本的設計意圖而非只是補一個名字。`index.ts` 改為引用 `GROUP_ORDER_EXPIRY_CRON`，並新增測試同時驗證「該常數存在於 wrangler.toml 的宣告中」與「handler 確實以該常數比對」，這比原本的逐字字串比對更難漂移。

---

### Gate H 複驗（2026-08-06）：**通過**

阻斷項已於 `f3df96ba` 關閉（改寫由稽核方實作，故查詢層部分為自我稽核）。

| 項目 | 結果 |
| --- | --- |
| 查詢層 | `prepare(` 殘留 0；6 條 SQL 全數改為 Drizzle |
| 自訂 snake_case 列型別 | 已移除（唯一剩下的 `share_code:` 是 KV 快取鍵前綴，符合既有慣例） |
| 狀態字面值 | `ACTIVE` / `CANCELLED` / `FINALIZING` 以 `GroupOrderStatus` 標註，寫錯即編譯錯誤 |
| `expiryWarningSentAt` / `expiredAt` / `finalizeFailure` | 皆已在 shared-types 介面中，無 `as unknown as` 殘留 |
| 測試覆蓋 | 4 → 4，未減少；另在陳舊 claim 測試中新增「已有 masterOrderId 不得回收」案例 |
| 驗證 | 86 tests（group-orders 76 + expiry 4 + cron wiring 6）、typecheck、lint 通過；全量 API 213 files / 1928 tests 通過 |

**改寫過程中浮現的一件事值得記錄**：測試改用真 SQLite 後，race 測試立刻失敗 —— 舊 fake 的 mock 以「先讀狀態、再寫狀態」模擬 claim，兩個 `await` 之間存在縫隙，但舊 fake 是同步操作因而掩蓋了它。也就是說**舊測試一直在模擬一個生產程式碼並不存在的 bug**（真實 `finalizeGroupOrder` 是單一 conditional update + `returning`）。mock 已改為同形。這是「以 fake 重寫查詢語意」這種測試策略的典型代價。

H-1 ~ H-10 行為面於初審已通過，本次複驗未重跑其結論，僅確認相關測試檔未受改寫影響（`routes/index.test.ts`、`GroupOrdersService.test.ts`、`cron-schedule-wiring.test.ts` 皆未更動）。

**Stage 4 完成，API 端可獨立部署。** H-9（部署後確認 cron 已註冊且首次執行無誤）留待實際部署時執行。

---

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

### I-10 端對端驗證結果（2026-08-06）：**通過**

以本地 API（`pnpm dev:api`）直接驅動 REST 鏈路完成。前置：本地 `menu_items` / `categories` 皆為 0 筆（`scripts/seed-local.sql` 只涵蓋 restaurants / shop_subscriptions / users），需自行種入分類與兩個品項；demo 餐廳的試用期已過，需延長並**清除 KV 的 `subscription:` 快取**（只改 D1 不生效）。

| 步驟 | 結果 |
| --- | --- |
| guest 建立（無 JWT） | 200，`created_by` 為 NULL，`expiresAt` 為 45 分鐘後 |
| 預覽 | 200，`memberCount = 1`，無副作用 |
| guest 成員加入 | 200 |
| 雙方各自加購 | 200 |
| 再次預覽 | `memberCount = 2` — 證明加入有副作用、預覽沒有 |
| 主辦人 `/lock` | 200，`masterOrderId` 產生，`status = completed` |

**X-1 實測（本項的核心）**，稅 5%、服務費 10%：

| | 小計 | 稅 | 服務費 | 總計 |
| --- | --- | --- | --- | --- |
| 真實訂單 | 30500 | 1525 | 3050 | **35075** |
| 主辦人 | 24000 | 1200 | 2400 | 27600 |
| 成員 | 6500 | 325 | 650 | 7475 |
| 分帳加總 | | | | **35075** |

訂單總額與分帳加總完全相等；分攤依小計佔比（24000/30500 = 78.69%，稅 1200/1525 = 78.69%）；每筆帳單自身亦自洽（小計＋稅＋服務費 = 總計），確認 Gate F 第 3 項修正在真實資料上生效。

**本次未涵蓋**：WebSocket 即時同步，以及整個 UI 層 —— 驗證是直接打 REST，未經瀏覽器。UI 接線由 65 條單元測試覆蓋，但沒有實機跑過。若要補，需同時啟動 `apps/realtime`（8788）與 `apps/customer-app`（3000），並開兩個瀏覽器情境。

**過程中的一個觀察（非缺陷）**：`packages/database/src/services/base.ts` 的 `calculateOrderTotal` 以 `subtotalCents * taxRate` 計算，即 `settings.taxRate` 是**小數**（0.05）；而 `splitBillSchema` 的 `taxRate` 驗證為 `.max(100)`、`splitBill` 內以 `(subtotal * rate) / 100` 計算，即**百分比**。兩者同名不同單位。目前不會互相污染（finalize 走絕對金額，`/split` 路由的費率來自請求而非餐廳設定），但對後續維護是個陷阱。

---

## 範圍界線

**在範圍內**：B/C/D 三份 plan 明列的 12 個 task，加上 X-1 決議所需的 `splitBill` 介面調整。

**不在範圍內**：外送費本身的建模與餐廳端設定 UI（C 已明列 out of scope）、`customizations` 的自動轉換（型別結構不相容）、逐連線推送到期警告、成員在線狀態（presence）。

**已知會被推遲的決策**：`/recover` 的 36 字元 UUID 搭配 15 分鐘 5 次的限制，其根本解屬 Phase A 的 schema／設定決策，Plan B 已列為 open question，本輪不處理。
