import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { images, restaurants } from "@makanmasak/database";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmasak/database/testing";
import { sweepOrphanedImages } from "../../index";
import type { Env } from "../../types/env";

const HOUR = 60 * 60 * 1000;
let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
});

afterAll(async () => {
  await testDb.dispose();
});

beforeEach(async () => {
  await testDb.truncateAll();
  await seedRestaurant(testDb);
});

describe("sweepOrphanedImages real D1", () => {
  it("marks new-pipeline metadata inactive when R2 id is stored as images.id", async () => {
    await testDb.drizzle.insert(images).values({
      id: "r2-orphan-id",
      restaurantId: "sweep-restaurant",
      filename: "orphan.jpg",
      originalFilename: "orphan.jpg",
      mimeType: "image/jpeg",
      size: 1024,
      category: "menu",
      isActive: true,
      uploadedAt: new Date("2026-06-07T03:00:00.000Z"),
      updatedAt: new Date("2026-06-07T03:00:00.000Z"),
    } as never);
    const listStoredImages = vi.fn().mockResolvedValue({
      success: true,
      result: {
        images: [
          {
            id: "r2-orphan-id",
            key: "r2-orphan-id/original",
            variant: "original",
            uploaded: new Date(Date.now() - 72 * HOUR).toISOString(),
          },
        ],
      },
    });
    const deleteImageVariants = vi.fn().mockResolvedValue({ success: true });

    await sweepOrphanedImages({ DB: testDb.bindings.DB } as Env, {
      imageStorage: { listStoredImages, deleteImageVariants },
      resolveReferenced: async () => new Set<string>(),
    });

    const [image] = await testDb.drizzle
      .select()
      .from(images)
      .where(eq(images.id, "r2-orphan-id"));

    expect(image?.isActive).toBe(false);
  });
});

async function seedRestaurant(testDatabase: TestDatabase) {
  await testDatabase.drizzle.insert(restaurants).values({
    id: "sweep-restaurant",
    name: "Sweep Restaurant",
    type: "restaurant",
    category: "casual",
    address: "1 Sweep St",
    district: "Central",
    city: "Taipei",
    phone: "0200000000",
    settings: {},
    isAvailable: true,
    isActive: true,
    createdAt: new Date("2026-06-07T03:00:00.000Z"),
    updatedAt: new Date("2026-06-07T03:00:00.000Z"),
  } as never);
}
