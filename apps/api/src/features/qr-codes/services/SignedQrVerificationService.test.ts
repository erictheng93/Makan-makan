import { describe, expect, it } from "vitest";
import { buildSignedQRUrl } from "@makanmakan/utils";
import { SignedQrVerificationService } from "./SignedQrVerificationService";

const signingKey = "test-qr-signing-key-at-least-32-characters";

function createDb(...results: unknown[][]) {
  let index = 0;
  return {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: async () => results[index++] ?? [],
          }),
        }),
        where: () => ({
          limit: async () => results[index++] ?? [],
        }),
      }),
    }),
  };
}

describe("SignedQrVerificationService", () => {
  it("accepts a current v2 table QR and rejects its stale version", async () => {
    const currentQr = await buildSignedQRUrl(
      "https://example.test",
      {
        formatVersion: 2,
        type: "table",
        restaurantId: "restaurant-1",
        tableId: 10,
        identifier: "T1",
        version: 2,
      },
      signingKey,
    );
    const staleQr = await buildSignedQRUrl(
      "https://example.test",
      {
        formatVersion: 2,
        type: "table",
        restaurantId: "restaurant-1",
        tableId: 10,
        identifier: "T1",
        version: 1,
      },
      signingKey,
    );
    const table = {
      id: 10,
      restaurantId: "restaurant-1",
      number: "T1",
      qrCodeVersion: 2,
      isActive: true,
      deletedAt: null,
    };
    const service = new SignedQrVerificationService(
      { DB: {} as D1Database, QR_SIGNING_KEY: signingKey },
      createDb([table], [table]) as never,
    );

    await expect(service.verifyTable(currentQr, 10)).resolves.toEqual({
      valid: true,
      type: "table",
      restaurantId: "restaurant-1",
      tableId: 10,
      tableNumber: "T1",
      formatVersion: 2,
    });
    await expect(service.verifyTable(staleQr, 10)).resolves.toEqual({
      valid: false,
    });
  });

  it("accepts legacy QR only when it matches the current database row", async () => {
    const legacyQr = await buildSignedQRUrl(
      "https://example.test",
      {
        type: "table",
        restaurantId: "restaurant-1",
        identifier: "T1",
        version: 1,
      },
      signingKey,
    );
    const service = new SignedQrVerificationService(
      { DB: {} as D1Database, QR_SIGNING_KEY: signingKey },
      createDb([
        {
          id: 10,
          restaurantId: "restaurant-1",
          number: "T1",
          qrCode: legacyQr,
          qrCodeVersion: 1,
          isActive: true,
          deletedAt: null,
        },
      ]) as never,
    );

    await expect(
      service.verifyTableFromQrCode(legacyQr),
    ).resolves.toMatchObject({
      valid: true,
      formatVersion: 1,
      tableId: 10,
    });
  });

  it("binds seat QR verification to both seat and table identity", async () => {
    const qrCode = await buildSignedQRUrl(
      "https://example.test",
      {
        formatVersion: 2,
        type: "seat",
        restaurantId: "restaurant-1",
        tableId: 10,
        identifier: "01",
        version: 3,
      },
      signingKey,
    );
    const service = new SignedQrVerificationService(
      { DB: {} as D1Database, QR_SIGNING_KEY: signingKey },
      createDb([
        {
          id: 21,
          tableId: 11,
          seatNumber: "01",
          qrCodeVersion: 3,
          isActive: true,
          deletedAt: null,
          restaurantId: "restaurant-1",
          tableNumber: "T2",
          tableIsActive: true,
          tableDeletedAt: null,
        },
      ]) as never,
    );

    await expect(service.verifySeat(qrCode, 21)).resolves.toEqual({
      valid: false,
    });
  });

  it("resolves a v2 seat QR from its signed table and seat number", async () => {
    const qrCode = await buildSignedQRUrl(
      "https://example.test",
      {
        formatVersion: 2,
        type: "seat",
        restaurantId: "restaurant-1",
        tableId: 10,
        identifier: "VIP-1",
        version: 3,
      },
      signingKey,
    );
    const service = new SignedQrVerificationService(
      { DB: {} as D1Database, QR_SIGNING_KEY: signingKey },
      createDb([
        {
          id: 21,
          tableId: 10,
          seatNumber: "VIP-1",
          qrCodeVersion: 3,
          isActive: true,
          deletedAt: null,
          restaurantId: "restaurant-1",
          tableNumber: "T1",
          tableIsActive: true,
          tableDeletedAt: null,
        },
      ]) as never,
    );

    await expect(service.verifySeatFromQrCode(qrCode)).resolves.toMatchObject({
      valid: true,
      type: "seat",
      tableId: 10,
      seatId: 21,
      seatNumber: "VIP-1",
    });
  });
});
