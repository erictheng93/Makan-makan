/**
 * 即時通訊事件型別定義
 *
 * 此檔案定義了所有 WebSocket 即時通訊的事件型別，
 * 確保前端、後端和即時服務之間的型別安全。
 */
// ============================================================================
// 基礎訊息結構
// ============================================================================
/**
 * 事件類型列舉
 */
export var RealtimeEventType;
(function (RealtimeEventType) {
    // 訂單事件
    RealtimeEventType["NEW_ORDER"] = "new_order";
    RealtimeEventType["ORDER_STATUS_UPDATE"] = "order_status_update";
    RealtimeEventType["ORDER_ITEM_STATUS_UPDATE"] = "order_item_status_update";
    RealtimeEventType["ORDER_CANCELLED"] = "order_cancelled";
    // 廚房事件
    RealtimeEventType["KITCHEN_ITEM_STATUS"] = "kitchen_item_status";
    RealtimeEventType["KITCHEN_QUEUE_UPDATE"] = "kitchen_queue_update";
    // 桌台事件
    RealtimeEventType["TABLE_STATUS_UPDATE"] = "table_status_update";
    RealtimeEventType["TABLE_CALL_SERVICE"] = "table_call_service";
    // 菜單事件
    RealtimeEventType["MENU_AVAILABILITY_UPDATE"] = "menu_availability_update";
    RealtimeEventType["MENU_ITEM_UPDATE"] = "menu_item_update";
    // 系統事件
    RealtimeEventType["SYSTEM_NOTIFICATION"] = "system_notification";
    RealtimeEventType["CONNECTION_ACK"] = "connection_ack";
    RealtimeEventType["HEARTBEAT"] = "heartbeat";
    RealtimeEventType["ERROR"] = "error";
    // 餐廳事件
    RealtimeEventType["RESTAURANT_STATUS_UPDATE"] = "restaurant_status_update";
})(RealtimeEventType || (RealtimeEventType = {}));
// ============================================================================
// 型別守衛函式
// ============================================================================
/**
 * 檢查是否為新訂單事件
 */
export function isNewOrderEvent(event) {
    return event.type === RealtimeEventType.NEW_ORDER;
}
/**
 * 檢查是否為訂單狀態更新事件
 */
export function isOrderStatusUpdateEvent(event) {
    return event.type === RealtimeEventType.ORDER_STATUS_UPDATE;
}
/**
 * 檢查是否為訂單項目狀態更新事件
 */
export function isOrderItemStatusUpdateEvent(event) {
    return event.type === RealtimeEventType.ORDER_ITEM_STATUS_UPDATE;
}
/**
 * 檢查是否為訂單取消事件
 */
export function isOrderCancelledEvent(event) {
    return event.type === RealtimeEventType.ORDER_CANCELLED;
}
/**
 * 檢查是否為廚房項目狀態事件
 */
export function isKitchenItemStatusEvent(event) {
    return event.type === RealtimeEventType.KITCHEN_ITEM_STATUS;
}
/**
 * 檢查是否為廚房佇列更新事件
 */
export function isKitchenQueueUpdateEvent(event) {
    return event.type === RealtimeEventType.KITCHEN_QUEUE_UPDATE;
}
/**
 * 檢查是否為桌台狀態更新事件
 */
export function isTableStatusUpdateEvent(event) {
    return event.type === RealtimeEventType.TABLE_STATUS_UPDATE;
}
/**
 * 檢查是否為桌台呼叫服務事件
 */
export function isTableCallServiceEvent(event) {
    return event.type === RealtimeEventType.TABLE_CALL_SERVICE;
}
/**
 * 檢查是否為菜單可用性更新事件
 */
export function isMenuAvailabilityUpdateEvent(event) {
    return event.type === RealtimeEventType.MENU_AVAILABILITY_UPDATE;
}
/**
 * 檢查是否為菜單項目更新事件
 */
export function isMenuItemUpdateEvent(event) {
    return event.type === RealtimeEventType.MENU_ITEM_UPDATE;
}
/**
 * 檢查是否為系統通知事件
 */
export function isSystemNotificationEvent(event) {
    return event.type === RealtimeEventType.SYSTEM_NOTIFICATION;
}
/**
 * 檢查是否為連線確認事件
 */
export function isConnectionAckEvent(event) {
    return event.type === RealtimeEventType.CONNECTION_ACK;
}
/**
 * 檢查是否為心跳事件
 */
export function isHeartbeatEvent(event) {
    return event.type === RealtimeEventType.HEARTBEAT;
}
/**
 * 檢查是否為錯誤事件
 */
export function isErrorEvent(event) {
    return event.type === RealtimeEventType.ERROR;
}
/**
 * 檢查是否為餐廳狀態更新事件
 */
export function isRestaurantStatusUpdateEvent(event) {
    return event.type === RealtimeEventType.RESTAURANT_STATUS_UPDATE;
}
