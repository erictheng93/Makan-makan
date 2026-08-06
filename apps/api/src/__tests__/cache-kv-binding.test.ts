import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const apiWranglerConfig = readFileSync(
  resolve(apiRoot, "wrangler.toml"),
  "utf8",
);
const managementApiWranglerConfig = readFileSync(
  resolve(apiRoot, "../management-api/wrangler.toml"),
  "utf8",
);

function cacheKvBinding(
  config: string,
  environment?: "production",
): { id: string; previewId?: string } {
  const environmentPrefix = environment ? `env.${environment}.` : "";
  const escapedPrefix = environmentPrefix.replace(".", "\\.");
  // \r?\n rather than \n: this file is read verbatim off disk, so on a Windows
  // checkout (core.autocrlf=true) every line break is CRLF and a bare \n would
  // never match. The binding is the same either way, so the assertion must not
  // depend on line endings.
  const bindingPattern = new RegExp(
    `\\[\\[${escapedPrefix}kv_namespaces\\]\\]\\r?\\n` +
      'binding = "CACHE_KV"\\r?\\n' +
      'id = "([^"]+)"(?:\\r?\\npreview_id = "([^"]+)")?',
  );
  const match = config.match(bindingPattern);

  expect(
    match,
    `missing ${environment ?? "default"} CACHE_KV binding`,
  ).not.toBeNull();

  return { id: match![1], previewId: match![2] };
}

describe("worker cache KV bindings", () => {
  it("shares CACHE_KV between the API and management API in every deployment environment", () => {
    expect(cacheKvBinding(managementApiWranglerConfig)).toEqual(
      cacheKvBinding(apiWranglerConfig),
    );
    expect(cacheKvBinding(managementApiWranglerConfig, "production")).toEqual(
      cacheKvBinding(apiWranglerConfig, "production"),
    );
  });
});
