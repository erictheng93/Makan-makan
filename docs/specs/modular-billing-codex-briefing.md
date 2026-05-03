# Codex Briefing：模組計費系統實作

> 給 Codex 第一次開場用的單頁摘要。讀完這頁後直接打開 SPEC 即可開工。

---

## 你的角色

你是**實作者**。SPEC 的決策、架構、schema、契約都已敲定——你的工作是**把 SPEC 翻譯成 PR**，不要重新設計。

| 角色 | 誰 | 做什麼 |
|---|---|---|
| Product Owner | Eric | 商業決策、Open Question 拍板 |
| 框架制定者 | Claude | 寫 SPEC、定 schema/契約、review 你的 PR |
| **實作者** | **你（Codex）** | **照 SPEC 寫 code、寫測試、開 PR** |

當 SPEC 描述與既有程式碼衝突、SPEC 留白、或你發現 SPEC 假設錯誤時——**停下來在 PR description 標 ⚠️ 提問，不要自己擴充 SPEC**。

---

## SPEC 位置

**主文**：`docs/specs/modular-billing-and-usage-metering.md`（1181 行）

讀順序：
1. §0 TL;DR + §1.3 三大架構決策——理解全貌
2. §9 Implementation Conventions——你要遵守的檔案位置／命名／錯誤處理規範
3. §10 Test Strategy & Observability——每個 PR 該寫什麼測試
4. **目前負責的 PR 對應段落**（見下方起手範圍）
5. Appendix A／B——查表用

---

## 進度（2026-05-03 audit）

| Phase | PR | 狀態 | 備註 |
|---|---|---|---|
| **P1 Gating Coverage** | a–e + follow-up | ✅ 已合併 | follow-up 已補 backfill migration、20-prefix coverage、`audit-module-gates.cjs` + pre-commit |
| **P2 Usage Metering** | a–d + follow-up | ✅ 已合併 | follow-up 已補 `usage-events-ttl.ts` cron 與 `quotaExceeded` factory |
| **P3 Billing Lifecycle** | b/c/d | ✅ 已合併（位置與 SPEC 略偏）| `BillingCycleService` / `BillingWebhookService` / `BillingNotificationService` 在 `apps/api/src/features/billing/services/`；cron 由 `apps/api/src/index.ts:86-99` 派發（每日 02:15，非 SPEC 的 hourly）|
| **P3-a payment audit** | a | ✅ 已合併 | `0043_payment-audit-log.sql` + schema + `PaymentAuditService` + `PaymentService.ts/payments/routes/index.ts` 寫入 ATTEMPT/SUCCESS/FAILURE/REFUND |

**本次 follow-up 已補齊**（依 audit gap）：
1. **P3-a 收尾 commit**：payment audit 已提交，migration ID 0043 早於 0044/0045。
2. **P1 follow-up**：backfill migration + 20-prefix coverage test + `audit-module-gates.cjs`。
3. **P2 follow-up**：`usage-events-ttl.ts`（90 天清理）+ `quotaExceeded` factory。
4. **P3 follow-up**：第二家 webhook provider（LINE Pay）+ billing notification kinds dispatch 測試。

詳細 audit 結果見 `modular-billing-and-usage-metering.md` §0.4。

---

## 起手 PR：P1-a（已完成；保留歷史紀錄，現階段請看上方「接下來該做的 PR」）

> **範圍極小**——故意設計成 30 分鐘可完成、零外部依賴的暖身 PR，讓你熟悉 review 流程。

### 任務

新增 3 個 module key + `deploymentMode` 欄位 + 更新 `PLAN_DEFAULT_MODULES`。

### 動到的檔案（只有這幾個，不要動別的）

1. `packages/database/src/schema/subscriptions.ts`
   - `MODULES` 物件加 `POS / INVENTORY / STAFF_MANAGEMENT` 三個 key（依 SPEC Appendix A.4 完整內容）
   - `PLAN_DEFAULT_MODULES` 更新四個 plan tier 對應（依 SPEC §2.1）
   - `shopSubscriptions` table 加 `deploymentMode` 欄位（依 SPEC §2.4）

2. `packages/database/migrations_fresh/<timestamp>_*.sql`
   - 由 `pnpm db:generate` 自動產生，**不要手寫**
   - 確認生成的 SQL：(a) 加 `deployment_mode` 欄位、(b) 對既存 row default `'managed'`

3. （視需要）測試檔
   - `apps/api/src/middleware/__tests__/moduleGate.test.ts` 若有列舉 modules 需更新

### 驗收清單

- [ ] `MODULES` 共 15 key（原 12 + 新 3）
- [ ] `PLAN_DEFAULT_MODULES.basic` 不含 `pos/inventory/staff_management`
- [ ] `PLAN_DEFAULT_MODULES.pro` 含 `pos: true`，不含 inventory/staff_management
- [ ] `PLAN_DEFAULT_MODULES.enterprise` 含三個全部 `: true`
- [ ] `PLAN_DEFAULT_MODULES.trial` 含三個全部 `: true`
- [ ] `pnpm db:migrate:local` 跑得過
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test:unit -- moduleGate` 通過
- [ ] **沒有**動 `apps/` 任何檔案（schema 變更不該擴散）

### 開 PR 前

執行並貼結果到 PR description：
```
rtk pnpm typecheck
rtk pnpm test:unit -- moduleGate subscriptions
```
（**注意**：CLAUDE.md memory 記錄 `rtk` 在 typecheck 時可能隱藏錯誤——若懷疑出錯，再裸跑一次 `pnpm typecheck` 確認）

---

## 硬規則（違反 = 直接退回）

讀過 `CLAUDE.md` 全文，特別注意：

| 規則 | 出處 |
|---|---|
| **DB 查詢只能用 Drizzle Layer 1（query builder）或 Layer 2（`sql` template + schema refs）**，禁止 raw string SQL | CLAUDE.md「Database Query Strategy」 |
| **API error 一律 throw `ApiError`**（用 `notFound()`/`badRequest()`/`forbidden()` factory），route handler 不寫 try/catch 包成 response | CLAUDE.md「Error Response Format」 |
| **測試一律用 `@makanmakan/testing-utils` factory**，禁止 CSS class assertion，每個 mock 都要 `expect.toHaveBeenCalledWith(...)` 驗證 | CLAUDE.md「Testing Standards」 |
| **UI 必符合 Apple-Native Soft Minimalism**（`#F2F2F7` bg、`rounded-2xl`、無硬邊框、ios-* tokens） | CLAUDE.md「UI/UX Design System」 |
| **commit / shell 一律加 `rtk` prefix**（節省 token） | global CLAUDE.md「RTK」 |
| **不寫 emoji**、不寫多段 docstring、不為「未來可能用到」加抽象 | system prompt |
| **不在 wrangler.toml 寫 `inspector_port`**（Windows workerd 會 crash） | CLAUDE.md「Common Issues #5」 |

---

## 何時停下來提問（不要自己決定）

PR description 開頭標 `⚠️ Blocked: ...` 然後等 review，不要繼續寫：

1. SPEC 說「待校準」、「視需求」、「待確認」的數字／時間／配置
2. SPEC 與既有 codebase 衝突（如 schema 已有同名欄位、middleware 簽名不同）
3. 你發現 SPEC 的 acceptance criteria 自相矛盾
4. 商業決策（pricing、quota 數字、provider 選擇、UI 文案）
5. 跨 PR 邊界爭議（這件事該在 P1-c 還是 P1-d 做？）

**不**要因為以下原因停下：
- 「這個檔案命名似乎不對」→ 照 §9.1 慣例做
- 「這段 SPEC 描述模糊」→ 重讀 §9 看有沒有規範，沒有再問
- 「我有更好的設計」→ 不在你的職責內，照 SPEC 做

---

## Hand-off 給 Claude review 的格式

PR description 必含這四段：

```markdown
## Scope
照 SPEC §X.Y 實作 P1-a。動到 N 個檔案。

## Acceptance Criteria
- [x] [從 SPEC 對應段落 paste 的清單]
- [x] ...

## Verification
$ rtk pnpm typecheck
[paste 結果]

$ rtk pnpm test:unit -- <relevant>
[paste 結果]

## ⚠️ Questions / Deviations
- 無 / 或列出與 SPEC 不一致之處及原因
```

Claude 會 review 時對照 SPEC 的 acceptance、§9 conventions、§10 test 要求做檢查，並在不符處留 inline comment 退回。

---

## 給你的記憶體

如果 review 退回時 Claude 給了「**Why**」與「**How to apply**」，那是規則，記住下次套用——不要每個 PR 都被同一條 comment 退。

歡迎開工。
