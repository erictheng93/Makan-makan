import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api";
import { signedQrApi } from "@/services/signedQrApi";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("signedQrApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(apiClient.get).toHaveBeenCalledWith("/qr-codes/verify/seat", {
      qrCode,
    });
  });
});
