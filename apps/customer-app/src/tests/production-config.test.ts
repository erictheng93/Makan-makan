// Importing the real vite config pulls in esbuild, which refuses to run under
// the default jsdom environment.
// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { UserConfig } from "vite";

const appRoot = resolve(__dirname, "../..");

describe("customer-app production config", () => {
  // Importing vite.config loads esbuild and friends; on a loaded machine that
  // first import alone can eat the 5s test timeout (#211). Pay it here under
  // the hook's own budget.
  beforeAll(async () => {
    await import("../../vite.config");
  }, 30_000);

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

  it("allows the customer QR scanner to request the same-origin camera", () => {
    const headers = readFileSync(resolve(appRoot, "public/_headers"), "utf-8");

    expect(headers).toContain("Permissions-Policy:");
    expect(headers).toContain("camera=(self)");
    expect(headers).not.toContain("camera=()");
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

  it("keeps console.error in production so fatal errors stay visible", async () => {
    const { default: viteConfig } = await import("../../vite.config");
    const drop = (viteConfig as UserConfig).esbuild
      ? ((viteConfig as UserConfig).esbuild as { drop?: string[] }).drop
      : undefined;

    expect(drop ?? []).not.toContain("console");
  });

  it("guards the development OTP echo behind Vite dev mode", () => {
    const loginView = readFileSync(
      resolve(appRoot, "src/views/LoginView.vue"),
      "utf-8",
    );
    const devOtpEcho = readFileSync(
      resolve(appRoot, "src/components/DevOtpEcho.vue"),
      "utf-8",
    );

    expect(devOtpEcho).toContain("Dev OTP:");
    expect(loginView).not.toContain("Dev OTP:");
    expect(loginView).toMatch(
      /const DevOtpEcho = import\.meta\.env\.DEV\s+\? defineAsyncComponent/,
    );
    expect(loginView).toMatch(/if \(import\.meta\.env\.DEV\)/);
  });
});
