import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import imagesRouter from "./images";
import type { Env } from "../types/env";

function buildApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/images", imagesRouter);
  return app;
}

function buildEnv(object: unknown | null): Env {
  return {
    IMAGE_API_BASE_URL: "https://images.test",
    IMAGES_BUCKET: {
      get: vi.fn().mockResolvedValue(object),
    },
  } as unknown as Env;
}

describe("GET /images/:imageId/:variant", () => {
  it("streams an R2 object with immutable cache headers and ETag", async () => {
    const object = {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("image-bytes"));
          controller.close();
        },
      }),
      httpEtag: '"r2-etag"',
      writeHttpMetadata(headers: Headers) {
        headers.set("Content-Type", "image/webp");
      },
    };

    const response = await buildApp().fetch(
      new Request("https://images.test/images/image-1/medium"),
      buildEnv(object),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(response.headers.get("ETag")).toBe('"r2-etag"');
    expect(await response.text()).toBe("image-bytes");
  });

  it("returns 404 when the R2 object is missing", async () => {
    const response = await buildApp().fetch(
      new Request("https://images.test/images/image-1/missing"),
      buildEnv(null),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Image not found",
    });
  });
});
