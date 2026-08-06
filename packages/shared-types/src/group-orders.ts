/**
 * Group Ordering Types
 * Shared type definitions for group orders
 */

// ========================================
// Enums & Constants
// ========================================

/**
 * The only status values `group_orders.status` is ever written with.
 *
 * Shared rather than API-local so the customer app can hold the same union
 * instead of translating into a display vocabulary of its own. A translation
 * layer has to guess what to do with a value it has not seen, and its fallback
 * is silent; sharing the union turns a new backend status into a compile error
 * on every consumer that has to render it.
 *
 * `"locked"`, `"finalized"` and `"expired"` were removed in 2026-08: nothing
 * ever wrote them. `"ordering"` was read in two places and written nowhere, and
 * was removed after production `group_orders` was confirmed empty.
 */
export const GROUP_ORDER_STATUSES = [
  "active", // 活躍，可以加入和修改
  "finalizing", // 正在轉成真實訂單，作為 finalize 互斥鎖
  "finalizing_failed", // 真實訂單已成立但分帳/收斂失敗，需人工介入
  "checkout", // 分帳中，已鎖定不能再改購物車
  "completed", // 已完成
  "cancelled", // 已取消
] as const;

export type GroupOrderStatus = (typeof GROUP_ORDER_STATUSES)[number];

/**
 * Narrow a raw `group_orders.status` string from the database.
 *
 * The column is plain `text`, so a bare `as GroupOrderStatus` compiles no
 * matter what the row actually holds — the assertion would simply lie. This
 * checks, and callers decide what to do with an unexpected value.
 */
export function parseGroupOrderStatus(
  value: string,
): GroupOrderStatus | undefined {
  return (GROUP_ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as GroupOrderStatus)
    : undefined;
}
