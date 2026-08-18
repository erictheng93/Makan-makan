import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api";
import { signedQrApi } from "@/services/signedQrApi";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

vi.mock("@/utils/i18n", () => ({
  translate: (key: string) => {
    const messages: Record<string, string> = {
      "toast.qrSignatureInvalid":
        "此 QR Code 已過期或簽章無效，請重新掃描桌上的 QR Code。",
      "toast.qrProcessError": "QR Code 處理失敗，請稍後再試。",
      "messages.networkError": "網路連線失敗，請檢查您的網路連線",
    };

    return messages[key] ?? key;
  },
}));

describe("signedQrApi", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("verifies a complete signed seat URL without requiring a seatId", async () => {
    const qrCode =
      "https://customer.example.test/order?t=seat&r=restaurant-1&d=10&n=VIP-1&v=4&f=2&sig=0123456789abcdef";
    vi.mocked(apiClient.get).mockResolvedValue({
      valid: true,
      type: "seat",
      restaurantId: "restaurant-1",
      tableId: 10,
      tableNumber: "A1",
      seatId: 21,
      seatNumber: "VIP-1",
      formatVersion: 2,
    });

    await expect(signedQrApi.verify("seat", qrCode)).resolves.toMatchObject({
      valid: true,
      tableId: 10,
      seatId: 21,
    });
    expect(apiClient.get).toHaveBeenCalledWith("/qr/verify/seat", {
      qrCode,
    });
  });

  it.each([
    "TABLE_QR_SIGNATURE_INVALID",
    "TABLE_QR_STALE",
    "SEAT_QR_SIGNATURE_INVALID",
    "SEAT_QR_STALE",
  ])("localizes recoverable signed QR failures for %s", async (code) => {
    const qrCode =
      "https://customer.example.test/order?t=table&r=restaurant-1&d=10&v=4&f=2&sig=tampered";
    const error = Object.assign(
      new Error("Table QR code signature is invalid"),
      {
        code,
      },
    );
    vi.mocked(apiClient.get).mockRejectedValue(error);

    await expect(signedQrApi.verify("table", qrCode)).rejects.toThrow(
      "此 QR Code 已過期或簽章無效，請重新掃描桌上的 QR Code。",
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Signed QR verification failed:",
      error,
    );
  });

  it("uses the generic QR fallback for other signed QR failure codes", async () => {
    const qrCode =
      "https://customer.example.test/order?t=table&r=restaurant-1&d=10&v=4&f=2&sig=valid";
    vi.mocked(apiClient.get).mockRejectedValue(
      Object.assign(new Error("Table QR code is inactive or deleted"), {
        code: "TABLE_QR_INACTIVE",
      }),
    );

    await expect(signedQrApi.verify("table", qrCode)).rejects.toThrow(
      "QR Code 處理失敗，請稍後再試。",
    );
  });

  it("uses the QR fallback instead of a non-QR API message", async () => {
    const qrCode =
      "https://customer.example.test/order?t=table&r=restaurant-1&d=10&v=4&f=2&sig=valid";
    vi.mocked(apiClient.get).mockRejectedValue(
      Object.assign(new Error("網路連線失敗，請檢查您的網路連線"), {
        code: "NETWORK_ERROR",
      }),
    );

    await expect(signedQrApi.verify("table", qrCode)).rejects.toThrow(
      "QR Code 處理失敗，請稍後再試。",
    );
  });

  it("uses the generic QR fallback for non-error rejections", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(null);

    await expect(signedQrApi.verify("table", "not-json")).rejects.toThrow(
      "QR Code 處理失敗，請稍後再試。",
    );
  });
});
