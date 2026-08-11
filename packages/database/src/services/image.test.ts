import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  images,
  imageProcessingJobs,
  imageViews,
  restaurants,
} from "../schema";
import {
  createTestDatabase,
  REAL_D1_SETUP_TIMEOUT_MS,
  type TestDatabase,
} from "../testing/create-test-database";
import { ImageService } from "./image";

const restaurantId = "image-analytics-restaurant";
const imageId = "image-analytics-1";

describe("ImageService analytics timestamp handling", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, REAL_D1_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
  });

  it("groups image views by local hour from Unix millisecond timestamps", async () => {
    const service = new ImageService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    await seedImage(testDb);
    await testDb.drizzle.insert(imageViews).values([
      {
        imageId,
        variant: "thumbnail",
        viewedAt: new Date("2026-06-07T03:15:00.000Z"),
      },
      {
        imageId,
        variant: "thumbnail",
        viewedAt: new Date("2026-06-07T03:45:00.000Z"),
      },
    ] as never);

    const analytics = await service.getUsageAnalytics({ restaurantId });

    expect(analytics.hourly_distribution).toEqual([
      {
        hour: "11",
        view_count: 2,
        avg_hourly_views: 2,
      },
    ]);
  });

  it("calculates image processing job duration from Unix millisecond timestamps", async () => {
    const service = new ImageService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    await seedImage(testDb);
    await testDb.drizzle.insert(imageProcessingJobs).values({
      imageId,
      jobType: "resize",
      status: "completed",
      startedAt: new Date("2026-06-07T03:00:00.000Z"),
      completedAt: new Date("2026-06-07T03:02:30.000Z"),
      createdAt: new Date("2026-06-07T02:59:00.000Z"),
    } as never);

    const stats = await service.getJobStats();

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      status: "completed",
      count: 1,
    });
    expect(stats[0].avg_duration).toBeCloseTo(150);
  });
});

async function seedImage(testDb: TestDatabase) {
  await testDb.drizzle.insert(restaurants).values({
    id: restaurantId,
    name: "Image Analytics Restaurant",
    type: "restaurant",
    category: "casual",
    address: "1 Image St",
    district: "Central",
    city: "Taipei",
    phone: "0200000000",
    settings: {},
    isAvailable: true,
    isActive: true,
    createdAt: new Date("2026-06-07T03:00:00.000Z"),
    updatedAt: new Date("2026-06-07T03:00:00.000Z"),
  } as never);

  await testDb.drizzle.insert(images).values({
    id: imageId,
    restaurantId,
    filename: "image.jpg",
    originalFilename: "image.jpg",
    mimeType: "image/jpeg",
    size: 1024,
    category: "menu",
    isActive: true,
    uploadedAt: new Date("2026-06-07T03:00:00.000Z"),
    updatedAt: new Date("2026-06-07T03:00:00.000Z"),
  } as never);

  const [image] = await testDb.drizzle
    .select()
    .from(images)
    .where(eq(images.id, imageId));
  expect(image).toBeTruthy();
}
