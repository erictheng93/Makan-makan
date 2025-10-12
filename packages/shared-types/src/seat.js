/**
 * 座位管理系統類型定義
 * 支持一桌一碼和一位一碼兩種模式
 */
// ============================================
// 錯誤類型
// ============================================
/**
 * 座位管理錯誤代碼
 */
export var SeatErrorCode;
(function (SeatErrorCode) {
    SeatErrorCode["SEAT_NOT_FOUND"] = "SEAT_NOT_FOUND";
    SeatErrorCode["SEAT_OCCUPIED"] = "SEAT_OCCUPIED";
    SeatErrorCode["SEAT_INACTIVE"] = "SEAT_INACTIVE";
    SeatErrorCode["DUPLICATE_SEAT_NUMBER"] = "DUPLICATE_SEAT_NUMBER";
    SeatErrorCode["INVALID_SEAT_COUNT"] = "INVALID_SEAT_COUNT";
    SeatErrorCode["MODE_SWITCH_BLOCKED"] = "MODE_SWITCH_BLOCKED";
    SeatErrorCode["TABLE_NOT_FOUND"] = "TABLE_NOT_FOUND";
    SeatErrorCode["PERMISSION_DENIED"] = "PERMISSION_DENIED";
})(SeatErrorCode || (SeatErrorCode = {}));
