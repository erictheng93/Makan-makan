import { describe, expect, it, vi } from "vitest";
import { ServiceBookingService } from "./ServiceBookingService";

describe("ServiceBookingService.blockSlot", () => {
  it("does not overwrite existing slot capacity when a stale read races with slot creation", async () => {
    let upsertRan = false;
    const storedSlot = {
      id: "slot-1",
      restaurantId: "rest-1",
      serviceItemId: 10,
      date: "2026-06-10",
      timeSlot: "10:00",
      maxCapacity: 2,
      currentBookings: 0,
      isAvailable: 1,
      blockReason: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const fakeD1 = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...params: unknown[]) => ({
          run: vi.fn(async () => {
            upsertRan = true;
            storedSlot.isAvailable = 0;
            storedSlot.blockReason = String(params.at(-1));
            if (sql.includes("max_capacity = excluded.max_capacity")) {
              storedSlot.maxCapacity = Number(params[5]);
            }
            return { meta: { changes: 1 } };
          }),
        })),
      })),
    };
    const fakeDb = {
      select: vi.fn((selection?: unknown) => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(async () => {
              if (selection) {
                return { id: 10, restaurantId: "rest-1" };
              }
              return upsertRan ? storedSlot : undefined;
            }),
          })),
        })),
      })),
    };
    const service = new ServiceBookingService({ DB: fakeD1 } as never);
    Object.defineProperty(service, "db", { value: fakeDb });
    Object.defineProperty(service, "d1", { value: fakeD1 });

    const slot = await service.blockSlot({
      restaurantId: "rest-1",
      serviceItemId: 10,
      date: "2026-06-10",
      timeSlot: "10:00",
      blockReason: "Private event",
    });

    expect(slot).toMatchObject({
      maxCapacity: 2,
      isAvailable: 0,
      blockReason: "Private event",
    });
  });
});
