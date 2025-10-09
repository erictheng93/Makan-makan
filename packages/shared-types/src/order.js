export var OrderStatus;
(function (OrderStatus) {
    OrderStatus[OrderStatus["PENDING"] = 0] = "PENDING";
    OrderStatus[OrderStatus["CONFIRMED"] = 1] = "CONFIRMED";
    OrderStatus[OrderStatus["PREPARING"] = 2] = "PREPARING";
    OrderStatus[OrderStatus["READY"] = 3] = "READY";
    OrderStatus[OrderStatus["DELIVERED"] = 4] = "DELIVERED";
    OrderStatus[OrderStatus["PAID"] = 5] = "PAID";
    OrderStatus[OrderStatus["CANCELLED"] = 6] = "CANCELLED";
})(OrderStatus || (OrderStatus = {}));
export var OrderPaymentStatus;
(function (OrderPaymentStatus) {
    OrderPaymentStatus[OrderPaymentStatus["PENDING"] = 0] = "PENDING";
    OrderPaymentStatus[OrderPaymentStatus["PAID"] = 1] = "PAID";
    OrderPaymentStatus[OrderPaymentStatus["FAILED"] = 2] = "FAILED";
})(OrderPaymentStatus || (OrderPaymentStatus = {}));
export var OrderItemStatus;
(function (OrderItemStatus) {
    OrderItemStatus[OrderItemStatus["PENDING"] = 0] = "PENDING";
    OrderItemStatus[OrderItemStatus["PREPARING"] = 1] = "PREPARING";
    OrderItemStatus[OrderItemStatus["READY"] = 2] = "READY";
    OrderItemStatus[OrderItemStatus["DELIVERED"] = 3] = "DELIVERED";
})(OrderItemStatus || (OrderItemStatus = {}));
