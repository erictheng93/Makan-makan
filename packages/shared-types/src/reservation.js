// ==========================================
// Reservation Types - 訂位系統
// ==========================================
/**
 * 訂位狀態
 */
export var ReservationStatus;
(function (ReservationStatus) {
    ReservationStatus["PENDING"] = "pending";
    ReservationStatus["CONFIRMED"] = "confirmed";
    ReservationStatus["ARRIVED"] = "arrived";
    ReservationStatus["SEATED"] = "seated";
    ReservationStatus["COMPLETED"] = "completed";
    ReservationStatus["CANCELLED"] = "cancelled";
    ReservationStatus["NO_SHOW"] = "no_show"; // 未到店
})(ReservationStatus || (ReservationStatus = {}));
// ==========================================
// Waiting List Types - 候位系統
// ==========================================
/**
 * 候位狀態
 */
export var WaitingStatus;
(function (WaitingStatus) {
    WaitingStatus["WAITING"] = "waiting";
    WaitingStatus["CALLED"] = "called";
    WaitingStatus["CONFIRMED"] = "confirmed";
    WaitingStatus["SEATED"] = "seated";
    WaitingStatus["CANCELLED"] = "cancelled";
    WaitingStatus["EXPIRED"] = "expired";
    WaitingStatus["NO_SHOW"] = "no_show"; // 未到
})(WaitingStatus || (WaitingStatus = {}));
// ==========================================
// Notification Types - 通知
// ==========================================
/**
 * 通知類型
 */
export var NotificationType;
(function (NotificationType) {
    NotificationType["RESERVATION_CONFIRMED"] = "reservation_confirmed";
    NotificationType["RESERVATION_REMINDER"] = "reservation_reminder";
    NotificationType["RESERVATION_CANCELLED"] = "reservation_cancelled";
    NotificationType["WAITING_CONFIRMED"] = "waiting_confirmed";
    NotificationType["WAITING_CALLED"] = "waiting_called";
    NotificationType["WAITING_ABOUT_TO_EXPIRE"] = "waiting_about_to_expire";
    NotificationType["WAITING_EXPIRED"] = "waiting_expired";
})(NotificationType || (NotificationType = {}));
