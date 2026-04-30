/**
 * Tests for validation middleware and schemas
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import {
  handleValidationError,
  validateBody,
  validateQuery,
  validateParams,
  validateFileType,
  securityScan,
  imageSchemas,
} from "../middleware/validation";
import { z } from "zod";
import {
  createMockEnv,
  createJPEGBuffer,
  createPNGBuffer,
  createInvalidBuffer,
} from "./setup";

type ValidationResponse = {
  ok?: boolean;
  success?: boolean;
  error?: string;
  data: Record<string, unknown> & {
    name?: string;
    page?: number;
    id?: string;
  };
};

describe("Validation Middleware", () => {
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    env = createMockEnv();
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  // ── handleValidationError ────────────────────────────────────

  describe("handleValidationError", () => {
    it("should format ZodError into structured error response", () => {
      const schema = z.object({ name: z.string().min(1) });
      let zodError: z.ZodError | null = null;
      try {
        schema.parse({ name: "" });
      } catch (e) {
        zodError = e as z.ZodError;
      }

      const result = handleValidationError(zodError!);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Validation failed");
      expect(result.details).toBeInstanceOf(Array);
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details[0]).toHaveProperty("field");
      expect(result.details[0]).toHaveProperty("message");
      expect(result.details[0]).toHaveProperty("code");
    });
  });

  // ── validateBody ─────────────────────────────────────────────

  describe("validateBody", () => {
    it("should pass valid body through", async () => {
      const schema = z.object({ name: z.string() });
      const app = new Hono();

      app.post("/test", validateBody(schema) as MiddlewareHandler, (c) => {
        return c.json({ ok: true, data: c.get("validatedBody") });
      });

      const res = await app.request("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as ValidationResponse;
      expect(body.data.name).toBe("test");
    });

    it("should reject invalid body with 400", async () => {
      const schema = z.object({ name: z.string().min(3) });
      const app = new Hono();

      app.post("/test", validateBody(schema) as MiddlewareHandler, (c) => {
        return c.json({ ok: true });
      });

      const res = await app.request("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "ab" }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ValidationResponse;
      expect(body.success).toBe(false);
      expect(body.error).toBe("Validation failed");
    });

    it("should reject invalid JSON with 400", async () => {
      const schema = z.object({ name: z.string() });
      const app = new Hono();

      app.post("/test", validateBody(schema) as MiddlewareHandler, (c) => {
        return c.json({ ok: true });
      });

      const res = await app.request("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json{{{",
      });

      expect(res.status).toBe(400);
    });
  });

  // ── validateQuery ────────────────────────────────────────────

  describe("validateQuery", () => {
    it("should pass valid query parameters", async () => {
      const schema = z.object({
        page: z.preprocess((v) => Number(v), z.number()),
      });
      const app = new Hono();

      app.get("/test", validateQuery(schema) as MiddlewareHandler, (c) => {
        return c.json({ data: c.get("validatedQuery") });
      });

      const res = await app.request("/test?page=5");
      const body = (await res.json()) as ValidationResponse;

      expect(res.status).toBe(200);
      expect(body.data.page).toBe(5);
    });

    it("should reject invalid query parameters", async () => {
      const schema = z.object({ page: z.string().min(1) });
      const app = new Hono();

      app.get("/test", validateQuery(schema) as MiddlewareHandler, (c) => {
        return c.json({ ok: true });
      });

      const res = await app.request("/test");

      expect(res.status).toBe(400);
    });
  });

  // ── validateParams ───────────────────────────────────────────

  describe("validateParams", () => {
    it("should validate route parameters", async () => {
      const schema = z.object({ id: z.string().min(1) });
      const app = new Hono();

      app.get("/:id", validateParams(schema) as MiddlewareHandler, (c) => {
        return c.json({ data: c.get("validatedParams") });
      });

      const res = await app.request("/abc123");
      const body = (await res.json()) as ValidationResponse;

      expect(res.status).toBe(200);
      expect(body.data.id).toBe("abc123");
    });
  });

  // ── imageSchemas ─────────────────────────────────────────────

  describe("imageSchemas", () => {
    describe("uploadParams", () => {
      it("should accept valid upload parameters", () => {
        const result = imageSchemas.uploadParams.parse({
          category: "menu",
          altText: "A dish",
        });

        expect(result.category).toBe("menu");
        expect(result.altText).toBe("A dish");
      });

      it("should accept empty object (all optional)", () => {
        const result = imageSchemas.uploadParams.parse({});
        expect(result).toBeDefined();
      });

      it("should reject category exceeding max length", () => {
        expect(() =>
          imageSchemas.uploadParams.parse({ category: "a".repeat(51) }),
        ).toThrow();
      });

      it("should coerce restaurantId to number", () => {
        const result = imageSchemas.uploadParams.parse({
          restaurantId: "42",
        });
        expect(result.restaurantId).toBe(42);
      });
    });

    describe("processParams", () => {
      it("should accept valid transformations", () => {
        const result = imageSchemas.processParams.parse({
          transformations: [
            { type: "resize", width: 800, height: 600, fit: "cover" },
          ],
          format: "webp",
          quality: 85,
        });

        expect(result.transformations).toHaveLength(1);
        expect(result.format).toBe("webp");
      });

      it("should reject invalid transformation type", () => {
        expect(() =>
          imageSchemas.processParams.parse({
            transformations: [{ type: "unknown" }],
          }),
        ).toThrow();
      });

      it("should reject width exceeding max", () => {
        expect(() =>
          imageSchemas.processParams.parse({
            transformations: [{ type: "resize", width: 5000 }],
          }),
        ).toThrow();
      });

      it("should reject quality outside range", () => {
        expect(() =>
          imageSchemas.processParams.parse({ quality: 0 }),
        ).toThrow();
        expect(() =>
          imageSchemas.processParams.parse({ quality: 101 }),
        ).toThrow();
      });
    });

    describe("listQuery", () => {
      it("should set default values", () => {
        const result = imageSchemas.listQuery.parse({});

        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
        expect(result.sortBy).toBe("uploaded_at");
        expect(result.sortOrder).toBe("DESC");
      });

      it("should accept custom pagination", () => {
        const result = imageSchemas.listQuery.parse({
          page: "3",
          limit: "50",
        });

        expect(result.page).toBe(3);
        expect(result.limit).toBe(50);
      });
    });

    describe("updateBody", () => {
      it("should accept valid update fields", () => {
        const result = imageSchemas.updateBody.parse({
          altText: "Updated alt",
          caption: "Updated caption",
          category: "food",
          tags: ["spicy", "popular"],
        });

        expect(result.altText).toBe("Updated alt");
        expect(result.tags).toEqual(["spicy", "popular"]);
      });

      it("should reject altText exceeding max length", () => {
        expect(() =>
          imageSchemas.updateBody.parse({ altText: "x".repeat(201) }),
        ).toThrow();
      });
    });

    describe("bulkOperationBody", () => {
      it("should accept valid bulk operation", () => {
        const result = imageSchemas.bulkOperationBody.parse({
          imageIds: ["img-1", "img-2"],
          operation: "delete",
        });

        expect(result.imageIds).toHaveLength(2);
        expect(result.operation).toBe("delete");
      });

      it("should reject empty imageIds array", () => {
        expect(() =>
          imageSchemas.bulkOperationBody.parse({
            imageIds: [],
            operation: "delete",
          }),
        ).toThrow();
      });

      it("should reject more than 100 imageIds", () => {
        const ids = Array.from({ length: 101 }, (_, i) => `img-${i}`);
        expect(() =>
          imageSchemas.bulkOperationBody.parse({
            imageIds: ids,
            operation: "delete",
          }),
        ).toThrow();
      });

      it("should reject invalid operation", () => {
        expect(() =>
          imageSchemas.bulkOperationBody.parse({
            imageIds: ["img-1"],
            operation: "hack",
          }),
        ).toThrow();
      });
    });

    describe("variantParams", () => {
      it("should set default variant to original", () => {
        const result = imageSchemas.variantParams.parse({});
        expect(result.variant).toBe("original");
      });

      it("should accept all fit options", () => {
        const fits = ["scale-down", "contain", "cover", "crop", "pad"] as const;
        for (const fit of fits) {
          const result = imageSchemas.variantParams.parse({ fit });
          expect(result.fit).toBe(fit);
        }
      });
    });

    describe("analyticsQuery", () => {
      it("should accept date range filters", () => {
        const result = imageSchemas.analyticsQuery.parse({
          dateFrom: "2025-01-01",
          dateTo: "2025-12-31",
        });

        expect(result.dateFrom).toBe("2025-01-01");
        expect(result.dateTo).toBe("2025-12-31");
      });
    });
  });

  // ── validateFileType ─────────────────────────────────────────

  describe("validateFileType", () => {
    it("should accept valid MIME type in multipart upload", async () => {
      const app = new Hono();
      const allowedTypes = ["image/jpeg", "image/png"];

      app.post(
        "/upload",
        validateFileType(allowedTypes) as MiddlewareHandler,
        (c) => c.json({ ok: true }),
      );

      const formData = new FormData();
      const file = new File(["image-data"], "photo.jpg", {
        type: "image/jpeg",
      });
      formData.append("file", file);

      const res = await app.request("/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(200);
    });

    it("should reject invalid MIME type", async () => {
      const app = new Hono();

      app.post(
        "/upload",
        validateFileType(["image/jpeg"]) as MiddlewareHandler,
        (c) => c.json({ ok: true }),
      );

      const formData = new FormData();
      const file = new File(["data"], "doc.pdf", {
        type: "application/pdf",
      });
      formData.append("file", file);

      const res = await app.request("/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ValidationResponse;
      expect(body.error).toBe("Invalid file type");
    });

    it("should pass through non-multipart requests", async () => {
      const app = new Hono();

      app.post(
        "/upload",
        validateFileType(["image/jpeg"]) as MiddlewareHandler,
        (c) => c.json({ ok: true }),
      );

      const res = await app.request("/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
    });
  });

  // ── securityScan ─────────────────────────────────────────────

  describe("securityScan", () => {
    it("should accept valid JPEG file with matching extension", async () => {
      const app = new Hono();

      app.post(
        "/upload",
        async (c, next) => {
          const jpegBuffer = createJPEGBuffer();
          const file = new File([jpegBuffer], "photo.jpg", {
            type: "image/jpeg",
          });
          c.set("file", file);
          await next();
        },
        securityScan as MiddlewareHandler,
        (c) => c.json({ ok: true }),
      );

      const res = await app.request("/upload", { method: "POST" });
      expect(res.status).toBe(200);
    });

    it("should accept valid PNG file", async () => {
      const app = new Hono();

      app.post(
        "/upload",
        async (c, next) => {
          const pngBuffer = createPNGBuffer();
          const file = new File([pngBuffer], "image.png", {
            type: "image/png",
          });
          c.set("file", file);
          await next();
        },
        securityScan as MiddlewareHandler,
        (c) => c.json({ ok: true }),
      );

      const res = await app.request("/upload", { method: "POST" });
      expect(res.status).toBe(200);
    });

    it("should reject file with mismatched extension and MIME type", async () => {
      const app = new Hono();

      app.post(
        "/upload",
        async (c, next) => {
          const jpegBuffer = createJPEGBuffer();
          // Extension says PNG but content and MIME say JPEG
          const file = new File([jpegBuffer], "photo.png", {
            type: "image/jpeg",
          });
          c.set("file", file);
          await next();
        },
        securityScan as MiddlewareHandler,
        (c) => c.json({ ok: true }),
      );

      const res = await app.request("/upload", { method: "POST" });
      expect(res.status).toBe(400);
      const body = (await res.json()) as ValidationResponse;
      expect(body.error).toContain("mismatch");
    });

    it("should reject non-image file with image extension", async () => {
      const app = new Hono();

      app.post(
        "/upload",
        async (c, next) => {
          const invalidBuffer = createInvalidBuffer();
          const file = new File([invalidBuffer], "fake.jpg", {
            type: "image/jpeg",
          });
          c.set("file", file);
          await next();
        },
        securityScan as MiddlewareHandler,
        (c) => c.json({ ok: true }),
      );

      const res = await app.request("/upload", { method: "POST" });
      expect(res.status).toBe(400);
      const body = (await res.json()) as ValidationResponse;
      expect(body.error).toContain("Invalid image file format");
    });

    it("should pass through when no file is set", async () => {
      const app = new Hono();

      app.post("/upload", securityScan as MiddlewareHandler, (c) =>
        c.json({ ok: true }),
      );

      const res = await app.request("/upload", { method: "POST" });
      expect(res.status).toBe(200);
    });
  });
});
