/**
 * Resolves the customer-facing app origin that server-generated links point at
 * (verification emails, table/seat QR codes).
 *
 * There is deliberately no hardcoded production fallback. A wrong origin here is
 * silent and expensive: table/seat QR codes get printed and stuck to furniture,
 * so a bad default ships thousands of physical stickers pointing at someone
 * else's domain before anyone notices. Failing the request is recoverable;
 * a mis-signed sticker is not.
 */

import type { CloudflareEnv } from "./base";

const LOCAL_APP_BASE_URL = "http://localhost:5173";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function firstConfiguredOrigin(value?: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .find((origin) => origin && origin !== "*");
}

function stripApiPath(url: string): string {
  return normalizeBaseUrl(url).replace(/\/api(?:\/v\d+)?$/i, "");
}

function isProductionEnv(env: CloudflareEnv): boolean {
  const envName = String(
    env.NODE_ENV || env["ENVIRONMENT"] || "",
  ).toLowerCase();
  return envName === "production";
}

/**
 * `CLIENT_BASE_URL` wins; otherwise the first non-wildcard `CORS_ORIGIN` entry,
 * which is the customer app by convention. In production a missing config
 * throws rather than guessing.
 */
export function resolveAppBaseUrl(
  env: CloudflareEnv,
  purpose = "links",
): string {
  const appOrigin =
    firstConfiguredOrigin(env.CLIENT_BASE_URL) ||
    firstConfiguredOrigin(env.CORS_ORIGIN);

  if (appOrigin) {
    return normalizeBaseUrl(appOrigin);
  }

  if (isProductionEnv(env)) {
    throw new Error(
      `CLIENT_BASE_URL or CORS_ORIGIN must be configured for production ${purpose}`,
    );
  }

  if (env.API_BASE_URL) {
    return stripApiPath(env.API_BASE_URL);
  }

  return LOCAL_APP_BASE_URL;
}
