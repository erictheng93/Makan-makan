import { describe, expect, it } from "vitest";
import {
  buildSignedQRUrl,
  parseSignedQRUrl,
  signQRPayload,
  verifyQRSignature,
} from "./qr-signing";

const signingKey = "test-qr-signing-key-at-least-32-characters";

describe("QR signing v2", () => {
  it("binds seat signatures to the table id", async () => {
    const seatOnTableOne = await signQRPayload(
      {
        formatVersion: 2,
        type: "seat",
        restaurantId: "restaurant-1",
        tableId: 1,
        identifier: "01",
        version: 1,
      },
      signingKey,
    );
    const seatOnTableTwo = await signQRPayload(
      {
        formatVersion: 2,
        type: "seat",
        restaurantId: "restaurant-1",
        tableId: 2,
        identifier: "01",
        version: 1,
      },
      signingKey,
    );

    expect(seatOnTableOne).not.toBe(seatOnTableTwo);
  });

  it("round-trips the signed format and table identity in v2 URLs", async () => {
    const url = await buildSignedQRUrl(
      "https://example.test",
      {
        formatVersion: 2,
        type: "table",
        restaurantId: "restaurant-1",
        tableId: 42,
        identifier: "A1",
        version: 3,
      },
      signingKey,
    );

    const parsed = parseSignedQRUrl(url);

    expect(parsed).toMatchObject({
      formatVersion: 2,
      type: "table",
      restaurantId: "restaurant-1",
      tableId: 42,
      identifier: "A1",
      version: 3,
    });
    await expect(
      verifyQRSignature(parsed!, parsed!.signature, signingKey),
    ).resolves.toBe(true);
  });

  it("continues accepting legacy signatures during phase 1", async () => {
    const legacyPayload = {
      type: "table" as const,
      restaurantId: "restaurant-1",
      identifier: "A1",
      version: 1,
    };
    const signature = await signQRPayload(legacyPayload, signingKey);
    const legacyUrl = new URL("https://example.test/order");
    legacyUrl.searchParams.set("t", legacyPayload.type);
    legacyUrl.searchParams.set("r", legacyPayload.restaurantId);
    legacyUrl.searchParams.set("n", legacyPayload.identifier);
    legacyUrl.searchParams.set("v", String(legacyPayload.version));
    legacyUrl.searchParams.set("sig", signature);

    const parsed = parseSignedQRUrl(legacyUrl.toString());

    expect(parsed).toMatchObject({
      formatVersion: 1,
      tableId: undefined,
      ...legacyPayload,
    });
    await expect(
      verifyQRSignature(parsed!, parsed!.signature, signingKey),
    ).resolves.toBe(true);
  });

  it("rejects malformed v2 identity and numeric fields", () => {
    expect(
      parseSignedQRUrl(
        "https://example.test/order?t=seat&r=r1&n=01&v=1&f=2&sig=abc",
      ),
    ).toBeNull();
    expect(
      parseSignedQRUrl(
        "https://example.test/order?t=seat&r=r1&n=01&v=NaN&f=2&d=1&sig=abc",
      ),
    ).toBeNull();
    expect(
      parseSignedQRUrl(
        "https://example.test/order?t=seat&r=r1&n=01&v=1&f=3&d=1&sig=abc",
      ),
    ).toBeNull();
  });
});
