import { beforeEach, describe, expect, it, vi } from "vitest";
import routes from "./seo";

const marketsFns = vi.hoisted(() => ({
  listSitemapEntries: vi.fn(),
}));

vi.mock("../services/MarketsService", () => ({
  MarketsService: class {
    listSitemapEntries = marketsFns.listSitemapEntries;
  },
}));

function request(path: string) {
  return routes.request(path, undefined, {
    DB: {},
    CACHE_KV: {},
  } as never);
}

describe("market seo routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders escaped market sitemap entries with cache headers", async () => {
    marketsFns.listSitemapEntries.mockResolvedValue([
      {
        slug: "fengjia&night",
        updatedAt: new Date("2026-06-08T10:30:00.000Z"),
      },
      {
        slug: "linjiang<food>",
        updatedAt: null,
      },
    ]);

    const response = await request("/sitemap.xml");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    expect(response.headers.get("cache-control")).toBe("public, max-age=900");
    expect(body).toContain(
      "<loc>http://localhost/markets/fengjia&amp;night</loc>",
    );
    expect(body).toContain("<lastmod>2026-06-08</lastmod>");
    expect(body).toContain(
      "<loc>http://localhost/markets/linjiang&lt;food&gt;</loc>",
    );
    expect(marketsFns.listSitemapEntries).toHaveBeenCalledOnce();
  });

  it("renders robots.txt with public origin and cache headers", async () => {
    const response = await request("/robots.txt");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Sitemap: http://localhost/sitemap.xml");
  });
});
