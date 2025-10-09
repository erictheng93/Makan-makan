export var TableStatus;
(function (TableStatus) {
    TableStatus[TableStatus["AVAILABLE"] = 0] = "AVAILABLE";
    TableStatus[TableStatus["OCCUPIED"] = 1] = "OCCUPIED";
    TableStatus[TableStatus["RESERVED"] = 2] = "RESERVED";
    TableStatus[TableStatus["OUT_OF_ORDER"] = 3] = "OUT_OF_ORDER";
})(TableStatus || (TableStatus = {}));
