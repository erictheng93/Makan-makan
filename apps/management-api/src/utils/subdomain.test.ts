import { describe, expect, it } from "vitest";
import { createSubdomainBase } from "./subdomain";

describe("createSubdomainBase", () => {
  it("romanizes CJK names before slugifying them", () => {
    expect(createSubdomainBase("日式料理")).toBe("ri-shi-liao-li");
  });

  it("keeps existing latin slug behavior", () => {
    expect(createSubdomainBase("Café Makan 2026!")).toBe("cafe-makan-2026");
  });

  it("falls back to an empty base when no slug-safe text remains", () => {
    expect(createSubdomainBase("!!!")).toBe("");
  });
});
