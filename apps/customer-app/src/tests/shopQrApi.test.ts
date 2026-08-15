import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api";
import { shopQrApi } from "@/services/shopQrApi";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const QR_CODE = "SHOP-restaurant-1-1785563580";

describe("shopQrApi.verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports the restaurant the live sticker belongs to", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      valid: true,
      restaurantId: "restaurant-1",
    });

    await expect(shopQrApi.verify(QR_CODE)).resolves.toEqual({
      valid: true,
      restaurantId: "restaurant-1",
    });
    expect(apiClient.get).toHaveBeenCalledWith(
      `/qr/verify/shop/${encodeURIComponent(QR_CODE)}`,
    );
  });

  it("returns a verdict, not a throw, for a retired or disabled code", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(
      Object.assign(new Error("Invalid or expired QR code"), {
        code: "QR_CODE_INVALID",
        status: 404,
      }),
    );

    await expect(shopQrApi.verify(QR_CODE)).resolves.toEqual({ valid: false });
  });

  it("treats a `?qr=` that is not a shop code at all as invalid", async () => {
    // The route validates the `SHOP-...` shape, so junk fails at 400 rather
    // than reaching the lookup — same outcome for the customer.
    vi.mocked(apiClient.get).mockRejectedValue(
      Object.assign(new Error("Invalid shop QR code format"), {
        code: "VALIDATION_ERROR",
        status: 400,
      }),
    );

    await expect(shopQrApi.verify("not-a-shop-code")).resolves.toEqual({
      valid: false,
    });
  });

  it("rethrows failures that are not a verdict on the code", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(
      Object.assign(new Error("網路連線失敗"), { code: "NETWORK_ERROR" }),
    );

    await expect(shopQrApi.verify(QR_CODE)).rejects.toThrow("網路連線失敗");
  });

  it("rethrows a server error instead of blaming the code", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(
      Object.assign(new Error("Internal server error"), {
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
      }),
    );

    await expect(shopQrApi.verify(QR_CODE)).rejects.toThrow(
      "Internal server error",
    );
  });
});
