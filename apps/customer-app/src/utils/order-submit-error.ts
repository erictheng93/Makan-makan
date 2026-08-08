type OrderSubmitErrorLike = {
  code?: unknown;
  status?: unknown;
  message?: unknown;
  details?: unknown;
  response?: {
    status?: unknown;
    data?: {
      code?: unknown;
      message?: unknown;
      error?: unknown;
    };
  };
  request?: unknown;
};

const ORDER_SUBMIT_ERROR_KEYS: Record<string, string> = {
  ACTIVE_GUEST_ORDER_EXISTS: "toast.orderSubmitActiveGuestOrder",
  CLIENT_MUTATION_DUPLICATE: "toast.orderSubmitDuplicate",
  MENU_ITEM_NOT_AVAILABLE: "toast.orderSubmitMenuItemUnavailable",
  MENU_ITEM_UNAVAILABLE: "toast.orderSubmitMenuItemUnavailable",
  INSUFFICIENT_INVENTORY: "toast.orderSubmitInsufficientInventory",
  INVALID_RESTAURANT_ID: "toast.orderSubmitRestaurantUnavailable",
  RESTAURANT_NOT_FOUND: "toast.orderSubmitRestaurantUnavailable",
  RESTAURANT_CLOSED: "toast.orderSubmitRestaurantUnavailable",
  TABLE_OCCUPIED: "toast.orderSubmitTableUnavailable",
  TABLE_NOT_AVAILABLE: "toast.orderSubmitTableUnavailable",
  EMPTY_ORDER_ITEMS: "toast.cartCannotBeEmpty",
  TOO_MANY_ORDER_ITEMS: "toast.orderSubmitFailed",
  INVALID_MENU_ITEM_ID: "toast.orderSubmitMenuItemUnavailable",
  INVALID_ITEM_QUANTITY: "toast.orderSubmitFailed",
  ITEM_QUANTITY_EXCEEDED: "toast.orderSubmitFailed",
  INVALID_PHONE_FORMAT: "toast.invalidPhoneNumber",
  INVALID_EMAIL_FORMAT: "toast.orderSubmitInvalidContact",
  NOTES_TOO_LONG: "toast.orderSubmitNotesTooLong",
  INVALID_COUPON_CODE_FORMAT: "toast.couponFailed",
  WAITING_LIST_PREORDER_EXISTS: "toast.orderSubmitDuplicate",
  WAITING_LIST_TICKET_NOT_FOUND: "toast.orderSubmitFailed",
  WAITING_LIST_TICKET_NOT_ACTIVE: "toast.orderSubmitFailed",
  WAITING_LIST_PHONE_MISMATCH: "toast.invalidPhoneNumber",
  RATE_LIMIT_EXCEEDED: "errors.tooManyRequests",
  QUOTA_EXCEEDED: "errors.tooManyRequests",
};

const QR_ERROR_PREFIXES = ["TABLE_QR_", "SEAT_QR_"];

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

const responseError = (error: OrderSubmitErrorLike) =>
  error.response?.data?.error;

export const getOrderSubmitErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const apiError = error as OrderSubmitErrorLike;
  const nestedError = responseError(apiError);

  if (nestedError && typeof nestedError === "object") {
    const code = stringValue((nestedError as { code?: unknown }).code);
    if (code) return code;
  }

  return (
    stringValue(apiError.code) ??
    stringValue(apiError.response?.data?.code) ??
    (nestedError ? stringValue(nestedError) : undefined)
  );
};

export const getOrderSubmitErrorMessage = (
  error: unknown,
): string | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const apiError = error as OrderSubmitErrorLike;
  const nestedError = responseError(apiError);

  if (nestedError && typeof nestedError === "object") {
    const message = stringValue((nestedError as { message?: unknown }).message);
    if (message) return message;
  }

  return (
    stringValue(apiError.message) ??
    stringValue(apiError.response?.data?.message) ??
    (nestedError ? stringValue(nestedError) : undefined)
  );
};

export const getOrderSubmitErrorI18nKey = (error: unknown): string => {
  if (!error || typeof error !== "object") {
    return "toast.orderSubmitFailed";
  }

  const apiError = error as OrderSubmitErrorLike;
  const code = getOrderSubmitErrorCode(apiError);

  if (
    code === "NETWORK_ERROR" ||
    code === "ERR_NETWORK" ||
    (!apiError.response && apiError.request)
  ) {
    return "toast.orderSubmitFailed";
  }

  if (code) {
    if (QR_ERROR_PREFIXES.some((prefix) => code.startsWith(prefix))) {
      return "toast.orderSubmitQrInvalid";
    }

    const key = ORDER_SUBMIT_ERROR_KEYS[code];
    if (key) return key;
  }

  const message = getOrderSubmitErrorMessage(apiError);
  if (!message) {
    return "toast.orderSubmitFailed";
  }

  if (/^Menu item \d+ is not available$/.test(message)) {
    return "toast.orderSubmitMenuItemUnavailable";
  }

  if (/^Insufficient inventory for\b/.test(message)) {
    return "toast.orderSubmitInsufficientInventory";
  }

  if (/Restaurant is (currently unavailable|not available)/i.test(message)) {
    return "toast.orderSubmitRestaurantUnavailable";
  }

  if (/Table (is not available|not found)/i.test(message)) {
    return "toast.orderSubmitTableUnavailable";
  }

  if (/Seat not found/i.test(message)) {
    return "toast.orderSubmitSeatUnavailable";
  }

  if (message.startsWith("優惠券驗證失敗:")) {
    return "toast.couponFailed";
  }

  return "toast.orderSubmitFailed";
};
