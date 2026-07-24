import { describe, expect, it } from "vitest";
import { safeExternalHref } from "./safeExternalHref";

describe("safeExternalHref", () => {
  it("allows only HTTPS URLs on allowed payment hosts", () => {
    const allowedHosts = ["payments.example.test"];

    expect(
      safeExternalHref("https://payments.example.test/checkout", {
        allowedHosts,
      }),
    ).toBe("https://payments.example.test/checkout");
    expect(
      safeExternalHref("https://sub.payments.example.test/checkout", {
        allowedHosts,
      }),
    ).toBe("https://sub.payments.example.test/checkout");
    expect(
      safeExternalHref("http://payments.example.test/checkout", {
        allowedHosts,
      }),
    ).toBeNull();
    expect(
      safeExternalHref("https://evil.example.test/checkout", {
        allowedHosts,
      }),
    ).toBeNull();
    expect(
      safeExternalHref("javascript:alert(1)", {
        allowedHosts,
      }),
    ).toBeNull();
    expect(
      safeExternalHref("data:text/html,<script>alert(1)</script>", {
        allowedHosts,
      }),
    ).toBeNull();
    expect(
      safeExternalHref("/relative-path", {
        allowedHosts,
      }),
    ).toBeNull();
  });

  it("allows configured payment provider hosts by default", () => {
    expect(safeExternalHref("https://checkout.stripe.com/pay/test")).toBe(
      "https://checkout.stripe.com/pay/test",
    );
    expect(safeExternalHref("https://payment.ecpay.com.tw/Cashier")).toBe(
      "https://payment.ecpay.com.tw/Cashier",
    );
  });

  it("can allow arbitrary http attachment hosts while rejecting executable schemes", () => {
    const options = { allowAnyHttpHost: true };

    expect(safeExternalHref("https://cdn.example.test/a.png", options)).toBe(
      "https://cdn.example.test/a.png",
    );
    expect(safeExternalHref("http://cdn.example.test/a.txt", options)).toBe(
      "http://cdn.example.test/a.txt",
    );
    expect(safeExternalHref("javascript:alert(1)", options)).toBeNull();
    expect(
      safeExternalHref("data:text/html,<script>alert(1)</script>", options),
    ).toBeNull();
    expect(
      safeExternalHref("ftp://cdn.example.test/a.txt", options),
    ).toBeNull();
  });
});
