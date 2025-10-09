// 通用型別定義
export var Status;
(function (Status) {
    Status[Status["INACTIVE"] = 0] = "INACTIVE";
    Status[Status["ACTIVE"] = 1] = "ACTIVE";
})(Status || (Status = {}));
export var UserRole;
(function (UserRole) {
    UserRole[UserRole["ADMIN"] = 0] = "ADMIN";
    UserRole[UserRole["OWNER"] = 1] = "OWNER";
    UserRole[UserRole["CHEF"] = 2] = "CHEF";
    UserRole[UserRole["SERVICE"] = 3] = "SERVICE";
    UserRole[UserRole["CASHIER"] = 4] = "CASHIER";
})(UserRole || (UserRole = {}));
export var SpiceLevel;
(function (SpiceLevel) {
    SpiceLevel[SpiceLevel["NONE"] = 0] = "NONE";
    SpiceLevel[SpiceLevel["MILD"] = 1] = "MILD";
    SpiceLevel[SpiceLevel["MEDIUM"] = 2] = "MEDIUM";
    SpiceLevel[SpiceLevel["HOT"] = 3] = "HOT";
    SpiceLevel[SpiceLevel["EXTREME"] = 4] = "EXTREME";
})(SpiceLevel || (SpiceLevel = {}));
