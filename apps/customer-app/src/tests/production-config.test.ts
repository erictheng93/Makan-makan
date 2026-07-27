// Importing the real vite config pulls in esbuild, which refuses to run under
// the default jsdom environment.
// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { UserConfig } from "vite";

const appRoot = resolve(__dirname, "../..");

describe("customer-app production config", () => {
  it("serves a restrictive Cloudflare Pages security policy", () => {
    const headers = readFileSync(resolve(appRoot, "public/_headers"), "utf-8");

    expect(headers).toContain("Content-Security-Policy:");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("object-src 'none'");
    expect(headers).toContain("base-uri 'self'");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).not.toContain("'unsafe-eval'");
    expect(headers).not.toContain("http://localhost");
    expect(headers).not.toContain("ws://localhost");
  });

  it("does not ship a looser CSP meta tag in the HTML template", () => {
    const html = readFileSync(resolve(appRoot, "index.html"), "utf-8");

    expect(html).not.toMatch(/http-equiv=["']Content-Security-Policy["']/i);
  });

  // The bundle itself is checked by scripts/check-csp-safe-bundle.cjs, which
  // runs as part of `pnpm build`. This only guards the flag that makes the
  // bundle come out that way, so it is asserted on the evaluated config rather
  // than on the config file's text.
  it("declares the CSP-safe Vue I18n message compiler", async () => {
    const { default: viteConfig } = await import("../../vite.config");
    const define = (viteConfig as UserConfig).define ?? {};

    expect(define.__INTLIFY_JIT_COMPILATION__).toBe(true);
    expect(define.__INTLIFY_DROP_MESSAGE_COMPILER__).toBe(false);
  });
});
