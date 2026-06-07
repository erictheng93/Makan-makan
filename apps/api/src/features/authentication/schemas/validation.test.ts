import { describe, expect, it } from "vitest";
import { authSchemas } from "./validation";

describe("authentication validation schemas", () => {
  it("accepts valid staff registration with either email or phone", () => {
    expect(
      authSchemas.register.parse({
        username: "owner_1",
        fullName: "  Owner One  ",
        email: "owner@example.test",
        password: "Strong1!",
        confirmPassword: "Strong1!",
        role: 1,
        restaurantId: "S-20260607-001",
      }),
    ).toMatchObject({
      username: "owner_1",
      fullName: "Owner One",
      email: "owner@example.test",
      role: 1,
    });
  });

  it("rejects weak or mismatched registration credentials", () => {
    expect(() =>
      authSchemas.register.parse({
        username: "owner_1",
        fullName: "Owner One",
        email: "owner@example.test",
        password: "weakpass",
        confirmPassword: "weakpass",
        role: 1,
      }),
    ).toThrow(/uppercase/i);

    expect(() =>
      authSchemas.register.parse({
        username: "owner_1",
        fullName: "Owner One",
        email: "owner@example.test",
        password: "Strong1!",
        confirmPassword: "Different1!",
        role: 1,
      }),
    ).toThrow(/match/i);
  });

  it("rejects retired customer role values in staff registration", () => {
    expect(() =>
      authSchemas.register.parse({
        username: "customer_1",
        fullName: "Customer One",
        phone: "+886912345678",
        password: "Strong1!",
        confirmPassword: "Strong1!",
        role: 5,
      }),
    ).toThrow(/Role must be 4 or less/);
  });

  it("requires one profile field for updateProfile", () => {
    expect(() => authSchemas.updateProfile.parse({})).toThrow(
      /At least one field/,
    );
    expect(authSchemas.updateProfile.parse({ phone: "+886912345678" })).toEqual(
      {
        phone: "+886912345678",
      },
    );
  });

  it("validates two-factor verify token or backup code alternatives", () => {
    expect(authSchemas.twoFactorVerify.parse({ token: "123456" })).toEqual({
      token: "123456",
    });
    expect(
      authSchemas.twoFactorVerify.parse({ backupCode: "ABCDEFG1" }),
    ).toEqual({
      backupCode: "ABCDEFG1",
    });
    expect(() => authSchemas.twoFactorVerify.parse({})).toThrow(
      /Either 2FA token or backup code/,
    );
  });
});
