// API 錯誤碼
export var ApiErrorCode;
(function (ApiErrorCode) {
    // 通用錯誤
    ApiErrorCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    ApiErrorCode["INVALID_REQUEST"] = "INVALID_REQUEST";
    ApiErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ApiErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ApiErrorCode["CONFLICT"] = "CONFLICT";
    // 認證錯誤
    ApiErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ApiErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ApiErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ApiErrorCode["TOKEN_INVALID"] = "TOKEN_INVALID";
    // 業務邏輯錯誤
    ApiErrorCode["RESTAURANT_NOT_FOUND"] = "RESTAURANT_NOT_FOUND";
    ApiErrorCode["ORDER_NOT_FOUND"] = "ORDER_NOT_FOUND";
    ApiErrorCode["MENU_ITEM_NOT_AVAILABLE"] = "MENU_ITEM_NOT_AVAILABLE";
    ApiErrorCode["TABLE_OCCUPIED"] = "TABLE_OCCUPIED";
    ApiErrorCode["DUPLICATE_EMAIL"] = "DUPLICATE_EMAIL";
    ApiErrorCode["INSUFFICIENT_INVENTORY"] = "INSUFFICIENT_INVENTORY";
    // 速率限制
    ApiErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    // 網路錯誤
    ApiErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    ApiErrorCode["TIMEOUT"] = "TIMEOUT";
})(ApiErrorCode || (ApiErrorCode = {}));
