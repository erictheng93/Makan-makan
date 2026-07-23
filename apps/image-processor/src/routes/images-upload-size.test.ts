import { beforeEach, describe, expect, it, vi } from "vitest";
import { sign } from "hono/jwt";
import { Hono } from "hono";
import imagesRouter from "./images";
import type { Env } from "../types/env";

const JWT_SECRET = "test-jwt-secret-with-at-least-32-chars";
const ADMIN_UUID = "01890a5d-ac96-774b-bcce-b302099a8057";

async function adminToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: ADMIN_UUID,
      username: "admin",
      role: 0,
      restaurantId: null,
      iat: now,
      exp: now + 3600,
    },
    JWT_SECRET,
  );
}

function buildEnv(): Env {
  return {
    JWT_SECRET,
    // 1MB limit — the post-parse check must catch a ~1.2MB upload even though
    // the Content-Length header is absent (so checkFileSize middleware skips).
    MAX_IMAGE_SIZE_MB: "1",
    ALLOWED_MIME_TYPES: "image/jpeg,image/png,image/webp,image/gif",
    MAX_UPLOADS_PER_MINUTE: "20",
  } as unknown as Env;
}

// Build a multipart/form-data body delivered as a stream so the runtime does
// NOT attach a Content-Length header — reproducing the omitted-header case the
// header-only middleware check cannot catch.
function streamedMultipartRequest(
  token: string,
  fileBytes: Uint8Array,
): Request {
  const boundary = "----imgprocessortestboundary";
  const enc = new TextEncoder();
  const header = enc.encode(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="big.jpg"\r\n` +
      `Content-Type: image/jpeg\r\n\r\n`,
  );
  const footer = enc.encode(`\r\n--${boundary}--\r\n`);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(header);
      controller.enqueue(fileBytes);
      controller.enqueue(footer);
      controller.close();
    },
  });

  return new Request("https://images.test/images/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      // Intentionally NO Content-Length header.
    },
    body: stream,
    // Required by undici/Workers when the body is a stream.
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("POST /images/upload size enforcement", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("rejects an oversized file even when Content-Length is missing", async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.route("/images", imagesRouter);
    const token = await adminToken();

    // ~1.2MB, valid JPEG magic bytes so securityScan passes.
    const fileBytes = new Uint8Array(1_200_000);
    fileBytes[0] = 0xff;
    fileBytes[1] = 0xd8;
    fileBytes[2] = 0xff;

    const response = await app.fetch(
      streamedMultipartRequest(token, fileBytes),
      buildEnv(),
    );

    expect(response.status).toBe(413);
    const body = (await response.json()) as {
      success: boolean;
      error: string;
      maxSize?: number;
    };
    expect(body.success).toBe(false);
    expect(body.error).toContain("File too large");
    expect(body.maxSize).toBe(1);
  });
});
