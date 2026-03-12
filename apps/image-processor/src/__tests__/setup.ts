/**
 * Test setup for image-processor
 *
 * Provides mock implementations for Cloudflare Worker bindings:
 * R2Bucket, KVNamespace, D1Database, and global fetch.
 */
import { vi } from "vitest";

// ── Mock KV Namespace ──────────────────────────────────────────────
export function createMockKV(): KVNamespace {
  const store = new Map<string, string>();

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (options?: { prefix?: string }) => {
      const keys = Array.from(store.keys())
        .filter((k) => !options?.prefix || k.startsWith(options.prefix))
        .map((name) => ({ name, expiration: undefined, metadata: undefined }));
      return { keys, list_complete: true, caches: undefined, cursor: "" };
    }),
    getWithMetadata: vi.fn(async (key: string) => ({
      value: store.get(key) ?? null,
      metadata: null,
      cacheStatus: null,
    })),
  } as unknown as KVNamespace;
}

// ── Mock R2 Bucket ─────────────────────────────────────────────────
export function createMockR2Bucket(): R2Bucket {
  return {
    head: vi.fn(async () => null),
    get: vi.fn(async () => null),
    put: vi.fn(async () => null),
    delete: vi.fn(async () => undefined),
    list: vi.fn(async () => ({
      objects: [],
      truncated: false,
      delimitedPrefixes: [],
    })),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  } as unknown as R2Bucket;
}

// ── Mock D1 Database ───────────────────────────────────────────────
export function createMockD1(): D1Database {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(async () => null),
      all: vi.fn(async () => ({ results: [], success: true, meta: {} })),
      run: vi.fn(async () => ({
        results: [],
        success: true,
        meta: { changes: 0 },
      })),
      raw: vi.fn(async () => []),
    })),
    exec: vi.fn(async () => ({ count: 0, duration: 0 })),
    batch: vi.fn(async () => []),
    dump: vi.fn(async () => new ArrayBuffer(0)),
  } as unknown as D1Database;
}

// ── Default mock Env ───────────────────────────────────────────────
export function createMockEnv() {
  return {
    IMAGES_BUCKET: createMockR2Bucket(),
    IMAGE_CACHE: createMockKV(),
    DB: createMockD1(),
    CLOUDFLARE_ACCOUNT_ID: "test-account-id",
    CLOUDFLARE_IMAGES_API_TOKEN: "test-api-token",
    NODE_ENV: "development" as const,
    API_VERSION: "v1",
    IMAGE_API_BASE_URL: "https://api.cloudflare.com/client/v4/accounts",
    MAX_IMAGE_SIZE_MB: "10",
    ALLOWED_MIME_TYPES: "image/jpeg,image/png,image/webp",
    DEFAULT_VARIANTS: "thumbnail,small,medium,large,original",
    THUMBNAIL_SIZE: "150x150",
    SMALL_SIZE: "300x300",
    MEDIUM_SIZE: "600x600",
    LARGE_SIZE: "1200x1200",
    MAX_UPLOADS_PER_MINUTE: "20",
    MAX_TRANSFORMS_PER_MINUTE: "100",
    JWT_SECRET: "a]super-secret-test-key-that-is-long-enough-32chars",
    TOKEN_BLACKLIST: createMockKV(),
    API_KEY: "test-api-key",
    SLACK_WEBHOOK_URL: "https://hooks.slack.com/test",
  };
}

// ── JPEG magic bytes for test images ───────────────────────────────
export function createJPEGBuffer(): ArrayBuffer {
  // Minimal valid JPEG header: FF D8 FF E0 ...
  const bytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  return bytes.buffer;
}

export function createPNGBuffer(): ArrayBuffer {
  // PNG header: 89 50 4E 47 0D 0A 1A 0A
  const bytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);
  return bytes.buffer;
}

export function createWebPBuffer(): ArrayBuffer {
  // RIFF....WEBP
  const bytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
  return bytes.buffer;
}

export function createGIFBuffer(): ArrayBuffer {
  // GIF89a
  const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  return bytes.buffer;
}

export function createInvalidBuffer(): ArrayBuffer {
  // Not a valid image header
  const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
  return bytes.buffer;
}

// ── Suppress console noise in tests ────────────────────────────────
beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});
