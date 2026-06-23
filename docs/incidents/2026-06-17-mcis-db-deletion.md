# 事故報告：誤刪 `mcis-db`（D1 資料庫，不可回滾）

| 項目 | 內容 |
| --- | --- |
| **事故編號** | INC-2026-06-17-01 |
| **日期** | 2026-06-17 |
| **嚴重度** | 高（資料永久遺失、不可回滾） |
| **執行者** | Claude Code（AI agent），操作者 `service@dacit.net` |
| **狀態** | 已止損；待操作者確認後續處置 |
| **受影響資源** | Cloudflare D1 `mcis-db`（已刪除）；`mcis-worker`、`mcis-files`（未受影響） |

---

## 1. 摘要

在一次「移除 mcis 相關資源」的操作中，Claude Code 透過 **Cloudflare Developer Platform MCP** 刪除了 D1 資料庫 `mcis-db`（UUID `1ea20f0e-a053-41a2-b53b-bafa014203b7`，檔案大小約 6.5MB）。

該刪除**永久且不可回滾**。同時，agent 在更早的步驟中**錯誤陳述了資源所屬的 Cloudflare 賬號**，把實際位於賬號 `c24c7b91…` 的資源報告成位於 `bdddc08c…`（minimaro93@gmail.com），導致操作者在不完整的資訊下做了刪除授權。

---

## 2. 兩套獨立的認證憑證（根因核心）

本次操作環境同時存在**兩條彼此獨立**的 Cloudflare 認證通道，兩者賬號不同、權限不同：

| 通道 | 身份 | 賬號 ID | 對 `mcis-*` 的存取 |
| --- | --- | --- | --- |
| **wrangler CLI**（OAuth Token） | `minimaro93@gmail.com` | `bdddc08c066a9abc285d75fe5947a468` | ❌ 無權限（實測回傳 `Authentication error 10000`） |
| **MCP**（claude.ai Cloudflare 整合） | `service@dacit.net` 連接的整合 | `c24c7b91fc0baef367dfc70083e11f4d` | ✅ 有權限（刪除即透過此通道執行） |

**關鍵事實**：刪除 `mcis-db` 的並非 wrangler/minimaro93 跨賬號操作，而是 **MCP 這條由 `service@dacit.net` 授權的通道**。wrangler 對 `c24c7b91…` 是被拒絕的。

---

## 3. 時間線

1. 操作者請求列出 Cloudflare Workers / D1 / R2。
2. Agent 透過 **MCP** 取得清單（實際來自賬號 `c24c7b91…`），但**錯誤地**在回覆中將其標示為 minimaro93 的賬號 `bdddc08c…`（與 `wrangler whoami` 的輸出混淆）。
3. 操作者指示「remove the mcis-db」，agent 以 `AskUserQuestion` 取得「Yes, delete it」確認。
4. 操作者追加指示「remove all the mcis related resource」。
5. Agent 透過 MCP：
   - ✅ **刪除 `mcis-db`（D1）成功** ← 永久、不可回滾。
   - ❌ 刪除 R2 `mcis-files` 失敗（`409 bucket not empty`）。錯誤訊息中首次暴露真實賬號 `c24c7b91…`。
6. Agent 嘗試用 wrangler 刪 `mcis-worker`：
   - 第一次（預設賬號 `bdddc08c…`）→ `Worker does not exist`（code 10090）。
   - 第二次（指定 `c24c7b91…`）→ `Authentication error`（code 10000）。
   - → 由此確認 wrangler 與 MCP 是不同賬號、wrangler 無權碰該賬號。
7. 操作者**喊停**，質疑賬號歸屬與可回滾性。Agent 停止所有進一步刪除。

---

## 4. 影響評估

| 資源 | 類型 | 狀態 | 可回滾？ |
| --- | --- | --- | --- |
| `mcis-db` | D1 資料庫 | **已永久刪除** | **否** |
| `mcis-worker` | Worker | 未受影響（仍存在） | 不適用 |
| `mcis-files` | R2 bucket | 未受影響（仍存在、未清空） | 不適用 |

### 為何 `mcis-db` 不可回滾

- Cloudflare D1 **沒有**回收站 / undelete 機制。
- D1 的 **Time Travel** 僅能在「資料庫仍存在」時還原至過去時間點；資料庫一旦被刪除，Time Travel 一併消失。
- 唯一補救途徑：操作者**先前在他處留有匯出備份**（如 `wrangler d1 export` 的 SQL dump）。若無，資料永久遺失。

> 備註：刪除前清單顯示 `mcis-db` 的 `num_tables: 0`（但檔案約 6.5MB）。可能本就無表結構，或該計數不含內部表 / 不準確。無論如何，現已永久刪除。

---

## 5. 根因分析

1. **主因 — 賬號身份混淆**：Agent 假設 wrangler（`whoami` 顯示的 `bdddc08c…`）與 MCP 操作的賬號相同，未在列出資源時驗證 MCP 實際綁定的賬號 ID。兩者其實是不同的賬號與認證主體。
2. **次因 — 在錯誤前提下取得授權**：因為資源被誤報為屬於 minimaro93 賬號，操作者是在不完整／錯誤的資訊下批准刪除的。
3. **加劇因素 — 不可逆操作前缺乏賬號層級的明確核對**：對「破壞性 + 不可逆」操作（刪 D1）未先確認並向操作者明示**目標賬號 ID**。

---

## 6. 修正措施（Corrective Actions）

| # | 措施 | 類型 |
| --- | --- | --- |
| 1 | 任何 MCP 破壞性操作前，先呼叫對應的 `*_list` / `whoami` 取得並**明示真實賬號 ID**，不可假設與 wrangler 相同。 | 流程 |
| 2 | 列出雲端資源時，於回覆中標註**資料來源通道（wrangler vs MCP）與賬號 ID**，避免兩條憑證被混為一談。 | 流程 |
| 3 | 對不可回滾操作（刪 D1 / R2 / Worker），確認對話需包含**目標賬號 ID** 與「不可回滾」字樣，再請求授權。 | 流程 |
| 4 | 刪除前若資源「非本專案建立」或所屬不明，主動標示疑慮並要求釐清，而非逕行執行。 | 流程 |
| 5 | （建議）對重要 D1 資料庫建立定期 `wrangler d1 export` 備份機制。 | 工程 |

---

## 7. 待操作者決定的後續事項

1. 確認賬號 `c24c7b91…` 上的 `mcis-*` 是否確為應清除之資源（抑或屬他人賬號、不應動）。
2. 若繼續清除 `mcis-worker` 與 `mcis-files`：MCP 無「刪 Worker」與「清空 R2 物件」工具，wrangler 又無權進入該賬號，故需：
   - 於 Cloudflare Dashboard（以能存取 `c24c7b91…` 的帳號登入）手動處理，或
   - 提供對該賬號有權限的 API Token / 憑證。
3. 確認 `mcis-db` 是否存在外部備份可供重建。

---

*本報告由 Claude Code 於事故當日撰寫，記錄真實操作與失誤，供後續審視與流程改進。*
