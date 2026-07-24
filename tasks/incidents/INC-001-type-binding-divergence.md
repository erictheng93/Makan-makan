# INC-001: Type 宣告與 wrangler.toml binding 對齊缺失

|              |                                                           |
| ------------ | --------------------------------------------------------- |
| **發現日期** | 2026-05-01                                                |
| **發現於**   | P1 候位系統 G1 spike (`tasks/plan.md` §4)                 |
| **嚴重度**   | High（已導致生產 bug）                                    |
| **狀態**     | Open（P1 T1c 會修補單一個案；類別問題待開更上層工程議題） |

## 摘要

`apps/api/src/types/env.ts:91` 宣告 `REALTIME_SESSION: DurableObjectNamespace`，但 `apps/api/wrangler.toml` 從未加上對應的 `[[durable_objects]]` binding。型別在說謊——`env.REALTIME_SESSION` 在 production / development 全部都是 `undefined`。

## 影響

`apps/api/src/services/RealtimeBroadcastService.ts:46-53` 寫了防禦性 fallback：

```ts
if (!this.env.REALTIME_SESSION) {
  this.logger.warn("REALTIME_SESSION not configured, skipping broadcast");
  return { success: true, eventId: event.eventId, recipientCount: 0 };
}
```

導致：

- **OrdersService 的 realtime 廣播在 production 全部靜默失敗**
- **KitchenService 的 realtime 廣播在 production 全部靜默失敗**
- 對應 admin-dashboard、kitchen-display 的即時通知**全部是壞的**
- 6+ 個月沒人發現（從 git log `apps/api/wrangler.toml` 看）

## 根本原因

1. **TypeScript binding 宣告與 wrangler binding 配置不同步**——TS 改了，wrangler 沒改，CI 不檢查
2. **`success: true` 的防禦性 fallback 把錯誤掩蓋了**——應改為 `success: false, error: 'BINDING_NOT_CONFIGURED'`，至少讓監控與 log 看得到
3. **沒有 production realtime 健康監控**——若有，這個 6 個月的廣播失敗應該幾天內就被發現

## 立即動作（P1 範圍內）

P1 的 T1c 會處理**單一個案**：在 `apps/api/wrangler.toml` 加 `REALTIME_SESSION` binding。詳見 `tasks/plan.md` §3 T1c。

## 工程議題（P1 範圍外，待討論）

需要團隊討論並決定：

1. **CI 檢查 type 宣告對齊 wrangler bindings**：寫一個 lint script，掃 `apps/*/src/types/env.ts` 的 `Env` interface，比對 `apps/*/wrangler.toml` 的 bindings，不對齊就 fail CI。是否做？工量？
2. **修 `RealtimeBroadcastService` 的 fallback 行為**：把 `success: true` 改成 `success: false, error: 'BINDING_NOT_CONFIGURED'`，讓未來類似情況不會靜默
3. **加 production realtime 健康指標**：定期 ping、廣播 + 訂閱來回驗證、Cloudflare Analytics dashboard
4. **稽核全部 worker 的 type-vs-binding 對齊狀態**：apps/api、apps/realtime、apps/management-api、apps/image-processor、apps/backup-scheduler 各檢查一次

## 連結

- T0 spike 完整論述：`tasks/plan.md` §4
- 相關 incident：INC-002（room name mismatch，會在 binding 修好後浮現）
