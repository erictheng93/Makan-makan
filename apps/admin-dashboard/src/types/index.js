export var UserRole;
(function (UserRole) {
    UserRole[UserRole["ADMIN"] = 0] = "ADMIN";
    UserRole[UserRole["OWNER"] = 1] = "OWNER";
    UserRole[UserRole["CHEF"] = 2] = "CHEF";
    UserRole[UserRole["SERVICE"] = 3] = "SERVICE";
    UserRole[UserRole["CASHIER"] = 4] = "CASHIER";
})(UserRole || (UserRole = {}));
export var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "pending";
    OrderStatus["CONFIRMED"] = "confirmed";
    OrderStatus["PREPARING"] = "preparing";
    OrderStatus["READY"] = "ready";
    OrderStatus["COMPLETED"] = "completed";
    OrderStatus["CANCELLED"] = "cancelled";
})(OrderStatus || (OrderStatus = {}));
