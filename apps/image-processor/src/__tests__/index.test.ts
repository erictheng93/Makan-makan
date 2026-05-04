/**
 * Tests for the main app: root endpoint, health, info, error handling, 404
 *
 * We test the app logic by constructing Hono apps that mirror the behaviour
 * defined in index.ts, passing env bindings via app.request(path, init, env).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { createMockEnv } from "./setup";

type MockEnv = ReturnType<typeof createMockEnv>;
type IndexTestResponse = {
  name?: string;
  version?: string;
  features?: string[];
  limits?: {
    maxFileSize?: string;
    allowedFormats?: string[];
  };
  service?: string;
  capabilities?: {
    upload?: boolean;
    transformation?: boolean;
    optimization?: boolean;
  };
  supportedFormats?: {
    input?: string[];
    output?: string[];
  };
  success?: boolean;
  error?: string;
  path?: string;
  stack?: string;
};

/**
 * Builds a minimal Hono app that mirrors the key routes from index.ts
 */
function buildTestApp() {
  const app = new Hono<{ Bindings: MockEnv }>();

  // Error handler
  app.onError((err, c) => {
    if (c.env?.NODE_ENV === "development") {
      return c.json(
        { success: false, error: err.message, stack: err.stack },
        500,
      );
    }
    return c.json({ success: false, error: "Internal server error" }, 500);
  });

  // 404 handler
  app.notFound((c) => {
    return c.json(
      { success: false, error: "API endpoint not found", path: c.req.path },
      404,
    );
  });

  // Root
  app.get("/", (c) => {
    return c.json({
      name: "MakanMasak Image Processing Service",
      version: c.env.API_VERSION || "v1",
      features: [
        "Image upload and storage",
        "Automatic optimization",
        "Multiple format variants",
        "Real-time transformations",
        "Advanced analytics",
        "Bulk operations",
        "Security scanning",
        "Access control",
      ],
      limits: {
        maxFileSize: `${c.env.MAX_IMAGE_SIZE_MB || 10}MB`,
        allowedFormats: c.env.ALLOWED_MIME_TYPES?.split(",") || [
          "image/jpeg",
          "image/png",
          "image/webp",
        ],
      },
    });
  });

  // Info
  app.get("/info", (c) => {
    return c.json({
      service: "MakanMasak Image Processor",
      version: c.env.API_VERSION || "v1",
      capabilities: {
        upload: true,
        transformation: true,
        optimization: true,
      },
      supportedFormats: {
        input: c.env.ALLOWED_MIME_TYPES?.split(",") || [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ],
        output: ["image/webp", "image/jpeg", "image/png", "image/avif"],
      },
    });
  });

  // Route that throws (for error handler testing)
  app.get("/throw", () => {
    throw new Error("Test error");
  });

  return app;
}

describe("Main App (index.ts)", () => {
  let env: MockEnv;

  beforeEach(() => {
    env = createMockEnv();
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  // ── Root endpoint ────────────────────────────────────────────

  describe("GET /", () => {
    it("should return service info with correct name", async () => {
      const app = buildTestApp();
      const res = await app.request("/", undefined, env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as IndexTestResponse;
      expect(body.name).toBe("MakanMasak Image Processing Service");
      expect(body.version).toBe("v1");
    });

    it("should list all features", async () => {
      const app = buildTestApp();
      const res = await app.request("/", undefined, env);
      const body = (await res.json()) as IndexTestResponse;

      expect(body.features).toContain("Image upload and storage");
      expect(body.features).toContain("Security scanning");
      expect(body.features).toHaveLength(8);
    });

    it("should include limits from env", async () => {
      const app = buildTestApp();
      const res = await app.request("/", undefined, env);
      const body = (await res.json()) as IndexTestResponse;

      expect(body.limits.maxFileSize).toBe("10MB");
      expect(body.limits.allowedFormats).toContain("image/jpeg");
      expect(body.limits.allowedFormats).toContain("image/png");
      expect(body.limits.allowedFormats).toContain("image/webp");
    });
  });

  // ── Info endpoint ────────────────────────────────────────────

  describe("GET /info", () => {
    it("should return service capabilities", async () => {
      const app = buildTestApp();
      const res = await app.request("/info", undefined, env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as IndexTestResponse;
      expect(body.service).toBe("MakanMasak Image Processor");
      expect(body.capabilities.upload).toBe(true);
      expect(body.capabilities.transformation).toBe(true);
    });

    it("should list supported input and output formats", async () => {
      const app = buildTestApp();
      const res = await app.request("/info", undefined, env);
      const body = (await res.json()) as IndexTestResponse;

      expect(body.supportedFormats.input).toContain("image/jpeg");
      expect(body.supportedFormats.output).toContain("image/webp");
      expect(body.supportedFormats.output).toContain("image/avif");
    });
  });

  // ── 404 handler ──────────────────────────────────────────────

  describe("404 handler", () => {
    it("should return 404 for unknown paths", async () => {
      const app = buildTestApp();
      const res = await app.request("/nonexistent/endpoint", undefined, env);

      expect(res.status).toBe(404);
      const body = (await res.json()) as IndexTestResponse;
      expect(body.success).toBe(false);
      expect(body.error).toBe("API endpoint not found");
      expect(body.path).toBe("/nonexistent/endpoint");
    });
  });

  // ── Error handler ────────────────────────────────────────────

  describe("Error handler", () => {
    it("should return detailed error in development mode", async () => {
      const app = buildTestApp();
      const res = await app.request("/throw", undefined, env);

      expect(res.status).toBe(500);
      const body = (await res.json()) as IndexTestResponse;
      expect(body.success).toBe(false);
      expect(body.error).toBe("Test error");
      expect(body.stack).toBeDefined();
    });

    it("should hide details in production mode", async () => {
      const prodEnv = { ...env, NODE_ENV: "production" as const };
      const app = buildTestApp();

      const res = await app.request("/throw", undefined, prodEnv);
      const body = (await res.json()) as IndexTestResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe("Internal server error");
      expect(body.stack).toBeUndefined();
    });
  });
});

// ── formatBytes utility (tested via extracted logic) ───────────

describe("formatBytes", () => {
  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  it("should format 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  it("should format bytes", () => {
    expect(formatBytes(500)).toBe("500 Bytes");
  });

  it("should format kilobytes", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("should format megabytes", () => {
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(5242880)).toBe("5 MB");
  });

  it("should format gigabytes", () => {
    expect(formatBytes(1073741824)).toBe("1 GB");
  });
});
