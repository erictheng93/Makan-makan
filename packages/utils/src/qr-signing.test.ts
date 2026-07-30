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

  it("rejects legacy URLs that omit the format marker", () => {
    // Pre-v2 codes carried no `f`/`d` and did not bind the table id. Phase 3
    // stops accepting them; a missing marker must be rejected outright rather
    // than downgraded to v1, or the cutoff would not actually close anything.
    const legacyUrl = new URL("https://example.test/order");
    legacyUrl.searchParams.set("t", "table");
    legacyUrl.searchParams.set("r", "restaurant-1");
    legacyUrl.searchParams.set("n", "A1");
    legacyUrl.searchParams.set("v", "1");
    legacyUrl.searchParams.set("sig", "a".repeat(16));

    expect(parseSignedQRUrl(legacyUrl.toString())).toBeNull();
  });

  it("rejects a v2 URL whose table id is missing", () => {
    const url = new URL("https://example.test/order");
    url.searchParams.set("t", "table");
    url.searchParams.set("r", "restaurant-1");
    url.searchParams.set("f", "2");
    url.searchParams.set("n", "A1");
    url.searchParams.set("v", "1");
    url.searchParams.set("sig", "a".repeat(16));

    expect(parseSignedQRUrl(url.toString())).toBeNull();
  });

  it("refuses to sign without a table id", async () => {
    await expect(
      signQRPayload(
        {
          type: "table",
          restaurantId: "restaurant-1",
          identifier: "A1",
          version: 1,
        } as never,
        signingKey,
      ),
    ).rejects.toThrow(/tableId/);
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
