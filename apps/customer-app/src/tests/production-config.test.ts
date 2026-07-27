import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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

  it("compiles i18n messages without unsafe-eval", () => {
    const viteConfig = readFileSync(
      resolve(appRoot, "vite.config.ts"),
      "utf-8",
    );

    expect(viteConfig).toContain("__INTLIFY_JIT_COMPILATION__: true");
    expect(viteConfig).toContain("__INTLIFY_DROP_MESSAGE_COMPILER__: false");
    expect(viteConfig).toContain('minify: "esbuild"');
  });
});
