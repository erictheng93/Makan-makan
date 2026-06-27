import { describe, expect, it } from "vitest";
import { getInitialLoginCredentials } from "./loginDefaults";

describe("getInitialLoginCredentials", () => {
  it("prefills the local development demo account with the seeded password", () => {
    expect(getInitialLoginCredentials()).toEqual({
      username: "admin",
      password: "admin123",
    });
  });
});
