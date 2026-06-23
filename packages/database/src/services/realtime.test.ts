import { beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeService } from "./realtime";

const mocks = vi.hoisted(() => ({
  orderService: {
    updateOrderStatus: vi.fn(),
  },
}));

vi.mock("./order", () => ({
  OrderService: vi.fn(function OrderService() {
    return mocks.orderService;
  }),
}));

function createD1(rows: unknown[] = []) {
  const first = vi.fn(async () => rows.shift() ?? null);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));

  return {
    db: { prepare } as unknown as D1Database,
    prepare,
    bind,
    first,
  };
}

function createCache() {
  const values = new Map<string, string>();
  return {
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    get: vi.fn(async (key: string) => values.get(key) ?? null),
  };
}

function createService(rows: unknown[] = []) {
  const d1 = createD1(rows);
  const cache = createCache();
  const fetch = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);

  return {
    service: new RealtimeService(
      d1.db,
      { JWT_SECRET: "secret", NODE_ENV: "test" },
      cache,
      "https://realtime.example.test",
    ),
    d1,
    cache,
    fetch,
  };
}

describe("RealtimeService order identity handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.orderService.updateOrderStatus.mockResolvedValue({ id: 202 });
  });

  it("updates status from a public order id while preserving numeric and UUID cache keys", async () => {
    const publicId = "018f0000-0000-7000-8000-000000000202";
    const { service, d1, cache, fetch } = createService([
      { id: 202, public_id: publicId },
    ]);

    await expect(
      service.updateOrderStatus(
        publicId,
        "preparing",
        "restaurant-1",
        "table-9",
        12,
      ),
    ).resolves.toBe(true);

    expect(d1.prepare).toHaveBeenCalledWith(
      expect.stringContaining("public_id"),
    );
    expect(d1.bind).toHaveBeenCalledWith("restaurant-1", 0, publicId);
    expect(mocks.orderService.updateOrderStatus).toHaveBeenCalledWith(202, {
      status: "preparing",
    });
    expect(cache.put).toHaveBeenCalledWith(
      `order_status:${publicId}`,
      expect.any(String),
      expect.any(Object),
    );
    expect(cache.put).toHaveBeenCalledWith(
      "order_status:202",
      expect.any(String),
      expect.any(Object),
    );

    const payloads = fetch.mock.calls.map(([, init]) =>
      JSON.parse(String((init as RequestInit).body)),
    );
    expect(payloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 202,
            orderPublicId: publicId,
          }),
        }),
      ]),
    );
  });

  it("keeps numeric order id compatibility and adds orderPublicId when available", async () => {
    const publicId = "018f0000-0000-7000-8000-000000000303";
    const { service, cache, fetch } = createService([
      { id: 303, public_id: publicId },
    ]);

    await expect(
      service.updateOrderStatus("303", "ready", "restaurant-1", "table-3"),
    ).resolves.toBe(true);

    expect(mocks.orderService.updateOrderStatus).toHaveBeenCalledWith(303, {
      status: "ready",
    });
    expect(cache.put).toHaveBeenCalledWith(
      "order_status:303",
      expect.any(String),
      expect.any(Object),
    );
    expect(cache.put).toHaveBeenCalledWith(
      `order_status:${publicId}`,
      expect.any(String),
      expect.any(Object),
    );
    expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toMatchObject({
      data: {
        orderId: 303,
        orderPublicId: publicId,
      },
    });
  });
});
