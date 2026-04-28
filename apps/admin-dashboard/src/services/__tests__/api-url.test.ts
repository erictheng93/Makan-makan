import { describe, expect, it } from "vitest";
import { apiPath, apiUrl } from "../api-url";

describe("api-url helpers", () => {
  it("prefixes feature-relative paths with the API base path", () => {
    expect(apiPath("/orders/1")).toBe("/api/v1/orders/1");
    expect(apiPath("orders/1")).toBe("/api/v1/orders/1");
  });

  it("does not double-prefix paths that already include the API base path", () => {
    expect(apiPath("/api/v1/orders/1")).toBe("/api/v1/orders/1");
    expect(apiPath("/api/v1?health=true")).toBe("/api/v1?health=true");
  });

  it("builds absolute URLs from host-only base URLs", () => {
    expect(apiUrl("/orders/1", "https://api.example.com")).toBe(
      "https://api.example.com/api/v1/orders/1",
    );
  });

  it("builds absolute URLs from base URLs that already include the API path", () => {
    expect(apiUrl("/orders/1", "https://api.example.com/api/v1")).toBe(
      "https://api.example.com/api/v1/orders/1",
    );
  });
});
