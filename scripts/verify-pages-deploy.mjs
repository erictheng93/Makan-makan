/**
 * Smoke-check a deployed Cloudflare Pages frontend in a real browser.
 *
 *   node scripts/verify-pages-deploy.mjs <host> [path]
 *   node scripts/verify-pages-deploy.mjs admin.example.com /dashboard
 *
 * Reports, for one page:
 *   - how many characters #app rendered (0 means the SPA never mounted)
 *   - the document title
 *   - any /assets/ request that 4xx'd or came back as text/html, which is what
 *     a missing hashed bundle looks like once the SPA fallback swallows it
 *   - console errors and uncaught page errors
 *
 * ── Read this before trusting a clean result ────────────────────────────────
 *
 * Edge caching produces false results in BOTH directions on Pages, so a green
 * run here is a smoke signal, not proof that the deployment is correct.
 *
 * 1. A `?cb=` query string does not bust asset caching. The browser requests
 *    assets at their bare paths, which are a different cache entry from any
 *    URL carrying a query. This script sends `Cache-Control: no-cache` on every
 *    request to work around that; without it, a stale-but-valid asset makes a
 *    broken deployment look fine.
 * 2. When a deploy does not change the frontend output, the hashed filenames do
 *    not change either, and the edge keeps serving responses created BEFORE the
 *    deploy for up to 4 hours. That is not a failure and it ages out on its own.
 * 3. The only fully trustworthy target is the deployment URL itself
 *    (`https://<deployment-id>.<project>.pages.dev`), which is not cached at
 *    the project hostname. Check there before concluding a deploy is broken.
 *
 * To confirm which asset filenames should exist, read them from the local build
 * rather than from the live index.html (which may itself be a stale copy):
 *
 *   ls apps/<app>/dist/assets/ | grep -E '^index-.*\.(js|css)$'
 */

import { chromium } from "@playwright/test";

const [host, path] = [process.argv[2], process.argv[3] || "/"];

if (!host) {
  console.error(
    "usage: node scripts/verify-pages-deploy.mjs <host> [path]\n" +
      "example: node scripts/verify-pages-deploy.mjs admin.example.com /dashboard",
  );
  process.exit(2);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  serviceWorkers: "block",
  // Applies to asset requests too, which a `?cb=` on the page URL cannot reach.
  extraHTTPHeaders: { "Cache-Control": "no-cache" },
});
const page = await ctx.newPage();

const errors = [];
const badAssets = [];

page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 110));
});
page.on("pageerror", (e) => errors.push(String(e).slice(0, 110)));
page.on("response", (r) => {
  const url = r.url().split("?")[0];
  if (!/\/assets\//.test(url)) return;
  const servedAsHtml = /text\/html/.test(r.headers()["content-type"] || "");
  if (r.status() >= 400 || servedAsHtml) {
    badAssets.push(`${r.status()} ${url.split("/").pop()}`);
  }
});

await page.goto(`https://${host}${path}?cb=${Date.now()}`, {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(2500);

const appChars = await page.evaluate(
  () => (document.querySelector("#app")?.innerHTML || "").trim().length,
);

console.log(
  `  ${host}${path}: #app=${appChars} chars | title=${JSON.stringify(await page.title())}`,
);
console.log(
  `    壞掉 asset: ${badAssets.length ? [...new Set(badAssets)].join(", ") : "無"}` +
    ` | errors: ${errors.length ? [...new Set(errors)].slice(0, 2).join(" | ") : "無"}`,
);

await browser.close();

// Non-zero exit on a hard failure so this can gate a deploy step.
process.exit(appChars === 0 || badAssets.length > 0 ? 1 : 0);
