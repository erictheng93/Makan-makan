import { describe, expect, it } from "vitest";
import { safeExternalHref } from "./safeExternalHref";

describe("safeExternalHref", () => {
  it("allows only http and https URLs", () => {
    expect(safeExternalHref("https://payments.example.test/checkout")).toBe(
      "https://payments.example.test/checkout",
    );
    expect(safeExternalHref("http://payments.example.test/checkout")).toBe(
      "http://payments.example.test/checkout",
    );
    expect(safeExternalHref("javascript:alert(1)")).toBeNull();
    expect(
      safeExternalHref("data:text/html,<script>alert(1)</script>"),
    ).toBeNull();
    expect(safeExternalHref("/relative-path")).toBeNull();
  });
});
