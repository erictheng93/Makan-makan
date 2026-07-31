import { describe, expect, it } from "vitest";
import { ReservationService } from "./ReservationService";

describe("ReservationService confirmation credentials", () => {
  it("generates opaque, non-enumerable confirmation codes", () => {
    const service = new ReservationService({} as D1Database, {
      JWT_SECRET: "test",
    });
    const codes = Array.from({ length: 32 }, () =>
      (service as any).generateConfirmationCode(),
    );

    expect(new Set(codes)).toHaveLength(codes.length);
    expect(codes.every((code) => /^[A-Z0-9]{24}$/.test(code))).toBe(true);
    expect(codes.some((code) => /^\d{6}$/.test(code))).toBe(false);
  });
});
