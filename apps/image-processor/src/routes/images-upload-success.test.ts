import { beforeEach, describe, expect, it, vi } from "vitest";
import { sign } from "hono/jwt";
import { Hono } from "hono";
import imagesRouter from "./images";
import type { Env } from "../types/env";

const mocks = vi.hoisted(() => ({
  createImage: vi.fn(),
  recordImageView: vi.fn(),
}));

vi.mock("@makanmakan/database", () => ({
  ImageService: vi.fn().mockImplementation(function ImageService() {
    return {
      createImage: mocks.createImage,
      recordImageView: mocks.recordImageView,
    };
  }),
}));

const JWT_SECRET = "test-jwt-secret-with-at-least-32-chars";
const ADMIN_UUID = "01890a5d-ac96-774b-bcce-b302099a8057";
const RESTAURANT_UUID = "01890a5d-ac96-774b-bcce-b302099a8058";
const IMAGE_UUID = "01890a5d-ac96-774b-bcce-b302099a8059";

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

function buildApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route("/images", imagesRouter);
  return app;
}

function buildEnv() {
  return {
    JWT_SECRET,
    IMAGE_API_BASE_URL: "https://images.test",
    MAX_IMAGE_SIZE_MB: "1",
    ALLOWED_MIME_TYPES: "image/jpeg,image/png,image/webp,image/gif",
    MAX_UPLOADS_PER_MINUTE: "20",
    IMAGE_CACHE: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    IMAGES_BUCKET: {
      put: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    DB: {},
  } as unknown as Env;
}

describe("POST /images/upload success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(crypto, "randomUUID").mockImplementation(function randomUUID() {
      return IMAGE_UUID;
    });
    mocks.createImage.mockResolvedValue({ id: IMAGE_UUID });
    mocks.recordImageView.mockResolvedValue(undefined);
  });

  it("stores uploaded variants and saves metadata with the generated image id", async () => {
    const token = await adminToken();
    const env = buildEnv();
    const formData = new FormData();
    formData.set(
      "file",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], "plate.jpg", {
        type: "image/jpeg",
      }),
    );
    formData.set(
      "thumbnail",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0x01])], "plate-thumb.jpg", {
        type: "image/jpeg",
      }),
    );

    const response = await buildApp().fetch(
      new Request(
        `https://images.test/images/upload?restaurantId=${RESTAURANT_UUID}&category=menu&tags=main,photo`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      ),
      env,
      {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
      } as unknown as ExecutionContext,
    );

    const body = await response.json();

    expect(body).toMatchObject({
      success: true,
      data: {
        id: IMAGE_UUID,
        originalFilename: "plate.jpg",
        variants: {
          original: `https://images.test/images/${IMAGE_UUID}/original`,
          thumbnail: `https://images.test/images/${IMAGE_UUID}/thumbnail`,
        },
      },
    });
    expect(response.status).toBe(201);

    expect(env.IMAGES_BUCKET.put).toHaveBeenCalledTimes(2);
    expect(env.IMAGES_BUCKET.put).toHaveBeenCalledWith(
      `${IMAGE_UUID}/original`,
      expect.any(ArrayBuffer),
      expect.objectContaining({
        customMetadata: expect.objectContaining({
          imageId: IMAGE_UUID,
          variant: "original",
          originalFilename: "plate.jpg",
        }),
      }),
    );
    expect(mocks.createImage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: IMAGE_UUID,
        originalFilename: "plate.jpg",
        restaurantId: RESTAURANT_UUID,
        variants: {
          original: `https://images.test/images/${IMAGE_UUID}/original`,
          thumbnail: `https://images.test/images/${IMAGE_UUID}/thumbnail`,
        },
        metadata: expect.objectContaining({
          tags: ["main", "photo"],
        }),
      }),
    );
    expect(env.IMAGE_CACHE.put).toHaveBeenCalledWith(
      `image:${IMAGE_UUID}`,
      expect.stringContaining(`"id":"${IMAGE_UUID}"`),
      { expirationTtl: 3600 },
    );
  });
});
