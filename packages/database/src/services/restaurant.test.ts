import { describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { restaurants } from "../schema";
import { RestaurantService } from "./restaurant";

function createServiceWithDb<TDb extends object>(db: TDb): RestaurantService {
  const service = new RestaurantService({} as D1Database, {
    JWT_SECRET: "test",
  });
  (service as unknown as { db: TDb }).db = db;
  return service;
}

describe("RestaurantService.updateRestaurant", () => {
  it("merges settings updates with existing persisted settings", async () => {
    const capturedSet: Record<string, unknown>[] = [];
    const updateBuilder = {
      set: vi.fn((values: Record<string, unknown>) => {
        capturedSet.push(values);
        return updateBuilder;
      }),
      where: vi.fn(() => updateBuilder),
      returning: vi.fn(async () => [
        {
          id: "restaurant-1",
          name: "Makan",
          type: "malaysian",
          category: "casual",
          address: "Main Street",
          district: "Central",
          city: "Taipei",
          phone: "0912345678",
          isActive: true,
          settings: {
            allowGuestOrders: true,
            currency: "TWD",
            enableTakeaway: true,
            minOrderAmount: 300,
          },
        },
      ]),
    };
    const db = {
      query: {
        restaurants: {
          findFirst: vi.fn(async () => ({
            settings: {
              allowGuestOrders: true,
              currency: "TWD",
              enableTakeaway: false,
            },
          })),
        },
      },
      update: vi.fn(() => updateBuilder),
    };
    const service = createServiceWithDb(db);

    await service.updateRestaurant("restaurant-1", {
      settings: {
        enableTakeaway: true,
        minOrderAmount: 300,
      },
    });

    expect(db.query.restaurants.findFirst).toHaveBeenCalledOnce();
    expect(db.update).toHaveBeenCalledWith(restaurants);
    expect(capturedSet[0].settings).toEqual({
      allowGuestOrders: true,
      currency: "TWD",
      enableTakeaway: true,
      minOrderAmount: 300,
    });
  });
});
