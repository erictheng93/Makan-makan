import { describe, expect, it } from "vitest";

import {
  buildDeployPageUrl,
  recordBadAsset,
} from "../../../scripts/verify-pages-deploy-utils.mjs";

describe("verify Pages deploy helpers", () => {
  it("preserves existing query parameters when adding the cache buster", () => {
    expect(
      buildDeployPageUrl(
        "customer.example.com",
        "/verify-email?token=abc",
        123,
      ),
    ).toBe("https://customer.example.com/verify-email?token=abc&cb=123");
  });

  it("records failed asset requests that have no response", () => {
    const badAssets: string[] = [];

    expect(
      recordBadAsset(badAssets, "https://site.example/assets/app.js?x=1"),
    ).toBe(true);
    expect(badAssets).toEqual(["failed app.js"]);
  });
});
