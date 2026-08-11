#!/usr/bin/env node
/**
 * generate-visual-audit-html.mjs
 *
 * Generates a self-contained HTML page that displays every Linux visual
 * regression baseline for hand-eye audit. Covers all 90 baselines across
 * 5 apps × ~6 pages × 3 viewports.
 *
 * **Why this exists**: `toHaveScreenshot()` only tells you "this page looks
 * the same as last time" — it can't tell you "this page is wrong". When
 * every authenticated baseline silently captured a login page (because
 * loginAs() was broken), 105/105 tests passed but every baseline was
 * garbage. The only way to catch that class of bug is to visually inspect
 * every baseline periodically — this page makes that easy.
 *
 * **Cache-busting**: file:// PNGs are cached aggressively by Chrome/Safari
 * and don't revalidate on reload. Every <img src> gets a `?t=<mtime>`
 * query string so the browser treats each regen as a new resource.
 *
 * Usage:
 *   node scripts/generate-visual-audit-html.mjs
 *
 * Output:
 *   /tmp/visual-baselines-full/index.html
 *   (open with: `open /tmp/visual-baselines-full/index.html`)
 *
 * Automated by scripts/update-visual-baselines.sh — if the output file
 * already exists, that script will regenerate it after a baseline regen.
 */

import { readdir, stat, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Resolve repo root from script location (scripts/generate-visual-audit-html.mjs → repo root)
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const OUTPUT_DIR = "/tmp/visual-baselines-full";
const OUTPUT_FILE = `${OUTPUT_DIR}/index.html`;

const APPS = [
  {
    key: "customer-app",
    label: "Customer App",
    color: "#007AFF",
    port: 3000,
    desc: "顧客點餐端 — 公開頁面 + 認證頁面",
  },
  {
    key: "admin-dashboard",
    label: "Admin Dashboard",
    color: "#FF9500",
    port: 3001,
    desc: "店主 / 店員管理後台 — login + 認證子頁",
  },
  {
    key: "kitchen-display",
    label: "Kitchen Display",
    color: "#34C759",
    port: 3002,
    desc: "廚房顯示系統 — 廚師登入 + 訂單看板",
  },
  {
    key: "management-portal",
    label: "Management Portal",
    color: "#AF52DE",
    port: 3010,
    desc: "平台管理後台 — dashboard + tenants + health",
  },
  {
    key: "onboarding-app",
    label: "Onboarding App",
    color: "#FF2D55",
    port: 3011,
    desc: "新商家申請流程 — home → apply → connect → success",
  },
];

const VIEWPORT_ORDER = ["desktop", "tablet", "mobile"];

/**
 * Escape a filesystem-derived string for HTML text and double-quoted
 * attribute contexts. Snapshot filenames are attacker-influenced in the sense
 * that anything on disk lands in the page — a name containing `"` or `<` would
 * otherwise break out of the attribute or inject markup. Values consumed by the
 * inline script travel through `data-*` attributes (never through interpolated
 * JS), so escaping here is sufficient.
 */
function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function main() {
  const sections = [];
  let total = 0;

  for (const app of APPS) {
    const dir = `${REPO}/tests/visual/${app.key}.visual.ts-snapshots`;
    let files;
    try {
      files = (await readdir(dir))
        .filter((f) => f.endsWith("-linux.png"))
        .sort();
    } catch {
      console.warn(`[skip] ${dir} not found`);
      continue;
    }
    total += files.length;

    // Group by page name (strip -{viewport}-linux.png)
    const groups = new Map();
    for (const f of files) {
      const m = f.match(/^(.+)-(desktop|tablet|mobile)-linux\.png$/);
      if (!m) continue;
      const [, pageName, viewport] = m;
      if (!groups.has(pageName)) groups.set(pageName, {});
      groups.get(pageName)[viewport] = f;
    }

    const pageBlocks = [];
    for (const [pageName, viewports] of groups) {
      const appPrefix = app.key
        .replace("-app", "")
        .replace("-display", "")
        .replace("-dashboard", "")
        .replace("-portal", "");
      const displayName = pageName
        .replace(new RegExp(`^${appPrefix}-`), "")
        .replace(/-/g, " ");

      const cards = await Promise.all(
        VIEWPORT_ORDER.map(async (vp) => {
          const file = viewports[vp];
          if (!file) return "";
          const path = `${dir}/${file}`;
          // Cache-bust with file mtime — file:// PNGs are cached aggressively.
          const mtime = (await stat(path)).mtimeMs | 0;
          const src = `file://${path}?t=${mtime}`;
          const viewportColor =
            vp === "desktop"
              ? "#007AFF"
              : vp === "tablet"
                ? "#34C759"
                : "#FF9500";
          return `
          <div class="vp-card" data-src="${esc(src)}" data-label="${esc(`${pageName} · ${vp}`)}">
            <div class="vp-tag" style="background: ${viewportColor}1a; color: ${viewportColor}">${vp}</div>
            <div class="imgwrap">
              <img loading="lazy" src="${esc(src)}" alt="${esc(file)}" />
            </div>
          </div>`;
        }),
      ).then((arr) => arr.join(""));

      pageBlocks.push(`
        <div class="page-row">
          <div class="page-label">
            <div class="name">${esc(displayName)}</div>
            <div class="filename">${esc(pageName)}</div>
          </div>
          <div class="vp-grid">${cards}</div>
        </div>`);
    }

    sections.push(`
      <section id="${app.key}">
        <div class="section-header" style="border-left: 6px solid ${app.color};">
          <h2 style="color: ${app.color};">${app.label}</h2>
          <p>${app.desc} · <code>localhost:${app.port}</code> · ${files.length} baselines (${groups.size} pages × 3 viewports)</p>
        </div>
        ${pageBlocks.join("")}
      </section>`);
  }

  const nav = APPS.map(
    (a) =>
      `<a href="#${a.key}" style="color: ${a.color}; border-color: ${a.color};">${a.label}</a>`,
  ).join("");

  const now = new Date().toLocaleString("en-US", { hour12: false });

  const html = `<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MakanMasak Visual Regression — Full Audit (${total} baselines)</title>
  <style>
    :root {
      --bg: #f2f2f7;
      --card: #ffffff;
      --text: #1c1c1e;
      --muted: #8e8e93;
      --border: rgba(0,0,0,0.06);
      --shadow: 0 4px 20px rgba(0,0,0,0.04);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      font-size: 13px; line-height: 1.5;
      scroll-behavior: smooth;
    }
    header {
      position: sticky; top: 0; z-index: 100;
      background: rgba(242,242,247,0.9);
      backdrop-filter: saturate(180%) blur(20px);
      -webkit-backdrop-filter: saturate(180%) blur(20px);
      border-bottom: 1px solid var(--border);
      padding: 14px 24px;
    }
    header .row1 {
      display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap;
    }
    header h1 {
      margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em;
    }
    header .count {
      color: var(--muted); font-size: 12px; font-family: "SF Mono", Menlo, monospace;
    }
    header .ts {
      color: var(--muted); font-size: 11px; font-family: "SF Mono", Menlo, monospace;
      margin-left: auto;
    }
    header nav {
      display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap;
    }
    header nav a {
      padding: 5px 12px; border-radius: 999px;
      text-decoration: none; font-size: 12px; font-weight: 600;
      border: 1.5px solid;
      transition: all 0.15s ease-out;
    }
    header nav a:hover {
      background: currentColor;
      color: white !important;
    }
    main { max-width: 1600px; margin: 0 auto; padding: 24px; }

    section { margin-bottom: 48px; }
    .section-header {
      padding: 12px 20px; margin-bottom: 20px;
      background: white; border-radius: 0 12px 12px 0;
      box-shadow: var(--shadow);
    }
    .section-header h2 {
      margin: 0 0 2px; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;
    }
    .section-header p {
      margin: 0; color: var(--muted); font-size: 12px;
    }
    .section-header code {
      background: rgba(0,0,0,0.06); padding: 1px 6px; border-radius: 4px;
      font-size: 11px;
    }

    .page-row {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 20px;
      margin-bottom: 16px;
      padding: 12px;
      background: white; border-radius: 12px;
      box-shadow: var(--shadow);
    }
    .page-label {
      display: flex; flex-direction: column; justify-content: center;
      padding: 0 4px;
    }
    .page-label .name {
      font-weight: 600; font-size: 14px; margin-bottom: 2px;
      text-transform: capitalize;
    }
    .page-label .filename {
      font-family: "SF Mono", Menlo, monospace;
      font-size: 10px; color: var(--muted);
      word-break: break-all;
    }
    .vp-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .vp-card {
      background: #fafafa; border-radius: 8px;
      overflow: hidden; cursor: zoom-in;
      border: 1px solid var(--border);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .vp-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    }
    .vp-tag {
      padding: 3px 8px;
      font-size: 10px; font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: center;
    }
    .imgwrap {
      background: repeating-conic-gradient(#f5f5f7 0% 25%, #fff 0% 50%) 50% / 12px 12px;
      display: flex; align-items: center; justify-content: center;
      min-height: 100px;
      aspect-ratio: 16/10;
    }
    .vp-card img {
      display: block;
      width: 100%; height: 100%;
      object-fit: contain;
    }

    /* lightbox */
    .lb {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.92); z-index: 1000;
      padding: 40px;
      cursor: zoom-out;
    }
    .lb.active { display: flex; align-items: center; justify-content: center; }
    .lb img {
      max-width: 100%; max-height: 100%;
      object-fit: contain;
      box-shadow: 0 20px 80px rgba(0,0,0,0.5);
    }
    .lb-label {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(255,255,255,0.95);
      padding: 8px 20px; border-radius: 999px;
      font-size: 13px; font-weight: 600;
      color: #1c1c1e;
    }
    .lb-hint {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,0.6);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <header>
    <div class="row1">
      <h1>🎭 Visual Regression Baselines — Full Audit</h1>
      <span class="count">${total} linux baselines · 5 apps</span>
      <span class="ts">generated ${now}</span>
    </div>
    <nav>${nav}</nav>
  </header>

  <main>
    ${sections.join("")}
  </main>

  <div class="lb" id="lb" onclick="this.classList.remove('active')">
    <div class="lb-label" id="lblabel"></div>
    <img id="lbimg" src="" alt="" />
    <div class="lb-hint">click anywhere or press Esc to close</div>
  </div>

  <script>
    // Card values arrive via data-* attributes, never interpolated into this
    // script — keeps snapshot filenames out of the JS parser entirely.
    document.addEventListener('click', e => {
      const card = e.target.closest('.vp-card');
      if (!card) return;
      document.getElementById('lbimg').src = card.dataset.src;
      document.getElementById('lblabel').textContent = card.dataset.label;
      document.getElementById('lb').classList.add('active');
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.getElementById('lb').classList.remove('active');
      }
    });
  </script>
</body>
</html>`;

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, html);
  console.log(`[audit] generated ${total} baselines → ${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error("[audit] failed:", e);
  process.exit(1);
});
