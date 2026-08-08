import { describe, expect, it } from "vitest";
import { getOrderSubmitErrorI18nKey } from "@/utils/order-submit-error";

describe("getOrderSubmitErrorI18nKey", () => {
  it("localizes active guest order conflicts from API error codes", () => {
    expect(
      getOrderSubmitErrorI18nKey({
        code: "ACTIVE_GUEST_ORDER_EXISTS",
        message:
          "You already have an active order at this restaurant. Please wait for it to complete.",
        status: 429,
      }),
    ).toBe("toast.orderSubmitActiveGuestOrder");
  });

  it("reads nested API response error codes", () => {
    expect(
      getOrderSubmitErrorI18nKey({
        response: {
          status: 409,
          data: {
            error: {
              code: "CLIENT_MUTATION_DUPLICATE",
              message: "Client mutation has already been processed",
            },
          },
        },
      }),
    ).toBe("toast.orderSubmitDuplicate");
  });

  it("maps table QR error families without exposing server text", () => {
    expect(
      getOrderSubmitErrorI18nKey({
        code: "TABLE_QR_SIGNATURE_INVALID",
        message: "Signature verification failed",
      }),
    ).toBe("toast.orderSubmitQrInvalid");
  });

  it("maps menu unavailable codes from shared API and order services", () => {
    expect(
      getOrderSubmitErrorI18nKey({
        response: {
          status: 409,
          data: {
            success: false,
            error: {
              code: "MENU_ITEM_NOT_AVAILABLE",
              message: "Menu item is not available",
            },
          },
        },
      }),
    ).toBe("toast.orderSubmitMenuItemUnavailable");

    expect(
      getOrderSubmitErrorI18nKey({
        response: {
          status: 409,
          data: {
            error: {
              code: "MENU_ITEM_UNAVAILABLE",
              message: "Menu item 101 is not available",
            },
          },
        },
      }),
    ).toBe("toast.orderSubmitMenuItemUnavailable");
  });

  it("maps menu availability and inventory message patterns", () => {
    expect(
      getOrderSubmitErrorI18nKey(new Error("Menu item 101 is not available")),
    ).toBe("toast.orderSubmitMenuItemUnavailable");

    expect(
      getOrderSubmitErrorI18nKey(
        new Error("Insufficient inventory for Nasi Lemak"),
      ),
    ).toBe("toast.orderSubmitInsufficientInventory");
  });

  it("maps restaurant availability message patterns", () => {
    expect(
      getOrderSubmitErrorI18nKey(
        new Error("Restaurant is currently unavailable"),
      ),
    ).toBe("toast.orderSubmitRestaurantUnavailable");

    expect(
      getOrderSubmitErrorI18nKey(new Error("Restaurant is not available")),
    ).toBe("toast.orderSubmitRestaurantUnavailable");
  });

  it("maps order service availability codes", () => {
    expect(
      getOrderSubmitErrorI18nKey({
        response: {
          status: 400,
          data: {
            error: {
              code: "RESTAURANT_CLOSED",
              message: "Restaurant is not accepting orders",
            },
          },
        },
      }),
    ).toBe("toast.orderSubmitRestaurantUnavailable");

    expect(
      getOrderSubmitErrorI18nKey({
        response: {
          status: 400,
          data: {
            error: {
              code: "TABLE_NOT_AVAILABLE",
              message: "Table is not available",
            },
          },
        },
      }),
    ).toBe("toast.orderSubmitTableUnavailable");
  });

  it("falls back to the generic submit failure instead of server messages", () => {
    expect(
      getOrderSubmitErrorI18nKey(
        new Error("Unexpected backend implementation detail"),
      ),
    ).toBe("toast.orderSubmitFailed");
  });
});
