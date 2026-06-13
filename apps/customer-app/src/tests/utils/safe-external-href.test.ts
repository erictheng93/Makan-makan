import { describe, expect, it } from "vitest";
import { safeExternalHref } from "@/utils/safeExternalHref";

describe("safeExternalHref", () => {
  it("allows http(s) URLs and rejects scriptable schemes", () => {
    expect(safeExternalHref("https://booking.example.test/path")).toBe(
      "https://booking.example.test/path",
    );
    expect(safeExternalHref("http://booking.example.test/path")).toBe(
      "http://booking.example.test/path",
    );
    expect(safeExternalHref("javascript:alert(1)")).toBeNull();
    expect(
      safeExternalHref("data:text/html,<script>alert(1)</script>"),
    ).toBeNull();
  });
});
