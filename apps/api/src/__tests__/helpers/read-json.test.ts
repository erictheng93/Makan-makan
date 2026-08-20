import { describe, expect, it } from "vitest";
import { readData, readEnvelope, readError } from "./read-json";

describe("response JSON helpers", () => {
  it("returns a typed API envelope", async () => {
    const response = new Response(
      JSON.stringify({ success: true, data: { id: "item-1" } }),
    );

    await expect(readEnvelope<{ id: string }>(response)).resolves.toEqual({
      success: true,
      data: { id: "item-1" },
    });
  });

  it("returns success data and explains an error envelope", async () => {
    await expect(
      readData<{ id: string }>(
        new Response(JSON.stringify({ success: true, data: { id: "item-1" } })),
      ),
    ).resolves.toEqual({ id: "item-1" });

    await expect(
      readData(
        new Response(
          JSON.stringify({ success: false, error: { message: "nope" } }),
        ),
      ),
    ).rejects.toThrow("expected success envelope");
  });

  it("returns the error half and explains a success envelope", async () => {
    await expect(
      readError(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "VALIDATION_ERROR", message: "nope", details: [1] },
          }),
        ),
      ),
    ).resolves.toEqual({
      code: "VALIDATION_ERROR",
      message: "nope",
      details: [1],
    });

    await expect(
      readError(new Response(JSON.stringify({ success: true, data: {} }))),
    ).rejects.toThrow("expected error envelope");
  });
});
