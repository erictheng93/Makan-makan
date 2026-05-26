import { Hono } from "hono";
import type { Env } from "../../../shared/types";
import { MarketsService } from "../services/MarketsService";

const routes = new Hono<{ Bindings: Env }>();

function publicOrigin(requestUrl: string) {
  const url = new URL(requestUrl);
  return `${url.protocol}//${url.host}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

routes.get("/sitemap.xml", async (c) => {
  const origin = publicOrigin(c.req.url);
  const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
  const markets = await service.listSitemapEntries();

  const marketUrls = markets
    .map((market) => {
      const loc = escapeXml(`${origin}/markets/${market.slug}`);
      const lastmod =
        market.updatedAt instanceof Date
          ? market.updatedAt.toISOString().slice(0, 10)
          : undefined;
      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
        "    <changefreq>daily</changefreq>",
        "    <priority>0.8</priority>",
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <url>",
    `    <loc>${escapeXml(origin)}/markets</loc>`,
    "    <changefreq>daily</changefreq>",
    "    <priority>0.9</priority>",
    "  </url>",
    marketUrls,
    "</urlset>",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  return c.body(xml, 200, {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=900",
  });
});

routes.get("/robots.txt", (c) => {
  const origin = publicOrigin(c.req.url);
  return c.text(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /admin/",
      "",
      `Sitemap: ${origin}/sitemap.xml`,
      "",
    ].join("\n"),
    200,
    {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  );
});

export default routes;
