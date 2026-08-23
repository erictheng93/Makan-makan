import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSelectFixtureDb,
  type SelectFixtures,
} from "@makanmasak/database/testing";

const mocks = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
  drizzle: vi.fn(),
  adapter: {
    verifyWebhook: vi.fn(),
  },
  integrationService: {
    getDecryptedCredentials: vi.fn(),
    readStoredCredentials: vi.fn(),
  },
  integrationServiceCtor: vi.fn(),
  orderService: {
    processWebhook: vi.fn(),
  },
  orderServiceCtor: vi.fn(),
}));

vi.mock("../../../middleware/idempotency", () => ({
  idempotencyMiddleware: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: mocks.drizzle,
}));

vi.mock("drizzle-orm", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  and: vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })),
  eq: vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })),
}));

vi.mock("@makanmasak/database", () => ({
  platformIntegrations: {
    enabled: "enabled",
    platform: "platform",
  },
  platformWebhookLogs: {
    id: "id",
  },
  WEBHOOK_LOG_STATUS: {
    RECEIVED: "received",
    PROCESSED: "processed",
    FAILED: "failed",
    IGNORED: "ignored",
  },
}));

vi.mock("../adapters/PlatformAdapter", () => ({
  getAdapter: vi.fn(() => mocks.adapter),
}));

vi.mock("../services/PlatformIntegrationService", () => ({
  PlatformIntegrationService: vi.fn(function PlatformIntegrationService(
    ...args: unknown[]
  ) {
    mocks.integrationServiceCtor(...args);
    return mocks.integrationService;
  }),
}));

vi.mock("../services/PlatformOrderService", () => ({
  PlatformOrderService: vi.fn(function PlatformOrderService(
    ...args: unknown[]
  ) {
    mocks.orderServiceCtor(...args);
    return mocks.orderService;
  }),
}));

import routes from "./webhook";
import { platformIntegrations } from "@makanmasak/database";
import { idempotencyMiddleware } from "../../../middleware/idempotency";

// The route builds its middleware once, while `./webhook` is evaluated — long
// before the first `beforeEach`. Snapshot the options here, because
// `vi.clearAllMocks()` would otherwise erase the only call there is.
const idempotencyOptions = vi
  .mocked(idempotencyMiddleware)
  .mock.calls.map(([options]) => options);

const fixtureTables = { platformIntegrations };
type SelectFixtureName = keyof typeof fixtureTables;

function mockSelectResults(fixtures: SelectFixtures<SelectFixtureName>) {
  Object.assign(mocks.db, createSelectFixtureDb(fixtureTables, fixtures));
}

function mockMutations(returningRows: unknown[] = [{ id: "log-1" }]) {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];
  const onConflictDoNothing = vi.fn();

  mocks.db.insert.mockImplementation(() => {
    const builder = {
      values: vi.fn((payload: unknown) => {
        inserted.push(payload);
        return builder;
      }),
      returning: vi.fn(() => Promise.resolve(returningRows)),
      onConflictDoNothing,
    };
    onConflictDoNothing.mockImplementation(() => builder);
    return builder;
  });

  mocks.db.update.mockImplementation(() => {
    const builder = {
      set: vi.fn((payload: unknown) => {
        updated.push(payload);
        return builder;
      }),
      where: vi.fn(() => builder),
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => Promise.resolve(undefined).then(resolve, reject),
    };
    return builder;
  });

  return { inserted, updated, onConflictDoNothing };
}

function request(path: string, init: RequestInit = {}) {
  return routes.request(path, init, {
    DB: { binding: "db" },
    ENCRYPTION_KEY: "test-key",
  } as never);
}

async function json(response: Response) {
  return (await response.json()) as {
    data?: unknown;
    error?: string;
    orderId?: number;
    success?: boolean;
  };
}

function integration(overrides: Record<string, unknown> = {}) {
  return {
    id: "integration-1",
    restaurantId: "restaurant-1",
    platform: "uber_eats",
    enabled: true,
    credentials: { storeId: "store-1" },
    config: { webhookSecret: "configured-secret" },
    ...overrides,
  };
}

function webhookPayload(overrides: Record<string, unknown> = {}) {
  return {
    event_id: "event-1",
    event_type: "order.created",
    store: { id: "store-1" },
    order: { id: "uber-order-1" },
    ...overrides,
  };
}

describe("platform webhook routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.drizzle.mockReturnValue(mocks.db);
    mocks.adapter.verifyWebhook.mockResolvedValue(true);
    mocks.integrationService.getDecryptedCredentials.mockResolvedValue({
      clientSecret: "decrypted-secret",
    });
    mocks.integrationService.readStoredCredentials.mockImplementation(
      (stored: unknown) => Promise.resolve(stored),
    );
    mocks.orderService.processWebhook.mockResolvedValue(101);
  });

  it("rejects malformed payloads and payloads without a store id", async () => {
    let response = await request("/uber-eats", {
      method: "POST",
      body: "{",
    });
    let body = await json(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: { code: "INVALID_JSON", message: "Invalid JSON payload" },
    });
    expect(mocks.db.select).not.toHaveBeenCalled();

    response = await request("/uber-eats", {
      method: "POST",
      body: JSON.stringify({ event_id: "event-1" }),
      headers: { "Content-Type": "application/json" },
    });
    body = await json(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      error: { code: "MISSING_PARAM", message: "Missing store.id in payload" },
    });
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it("returns not found when no enabled integration matches the store", async () => {
    mockSelectResults({
      platformIntegrations: [
        [
          integration({ credentials: { storeId: "other-store" } }),
          integration({ credentials: { storeId: "third-store" } }),
        ],
      ],
    });

    const response = await request("/uber-eats", {
      method: "POST",
      body: JSON.stringify(webhookPayload()),
      headers: { "Content-Type": "application/json" },
    });
    const body = await json(response);

    expect(response.status).toBe(404);
    expect(body).toEqual({
      success: false,
      error: { code: "INTEGRATION_NOT_FOUND", message: "Unknown store" },
    });
    expect(mocks.adapter.verifyWebhook).not.toHaveBeenCalled();
  });

  it("rejects invalid webhook signatures with the configured secret", async () => {
    mockSelectResults({ platformIntegrations: [[integration()]] });
    mocks.adapter.verifyWebhook.mockResolvedValueOnce(false);

    const response = await request("/uber-eats", {
      method: "POST",
      body: JSON.stringify(webhookPayload()),
      headers: {
        "Content-Type": "application/json",
        "X-Uber-Signature": "invalid",
      },
    });
    const body = await json(response);

    expect(response.status).toBe(401);
    expect(body).toEqual({
      success: false,
      error: { code: "INVALID_SIGNATURE", message: "Invalid signature" },
    });
    expect(mocks.adapter.verifyWebhook).toHaveBeenCalledWith(
      expect.any(Request),
      "configured-secret",
    );
    expect(
      mocks.integrationService.getDecryptedCredentials,
    ).not.toHaveBeenCalled();
  });

  it("uses encrypted credentials for store matching and webhook secrets", async () => {
    const mutations = mockMutations();
    const encryptedCredentials = "encrypted-credentials";
    mockSelectResults({
      platformIntegrations: [
        [integration({ credentials: encryptedCredentials, config: {} })],
      ],
    });
    mocks.integrationService.readStoredCredentials.mockResolvedValueOnce({
      storeId: "store-1",
      clientSecret: "client-secret",
      webhookSecret: "decrypted-webhook-secret",
    });

    const response = await request("/uber-eats", {
      method: "POST",
      body: JSON.stringify(webhookPayload()),
      headers: { "Content-Type": "application/json" },
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.integrationService.readStoredCredentials).toHaveBeenCalledWith(
      encryptedCredentials,
    );
    expect(mocks.adapter.verifyWebhook).toHaveBeenCalledWith(
      expect.any(Request),
      "decrypted-webhook-secret",
    );
    expect(mocks.orderService.processWebhook).toHaveBeenCalledWith(
      "uber_eats",
      webhookPayload(),
      "restaurant-1",
    );
    expect(body).toEqual({ success: true, orderId: 101 });
    expect(mutations.inserted[0]).toMatchObject({
      restaurantId: "restaurant-1",
      platform: "uber_eats",
      eventType: "order.created",
      status: "received",
    });
    expect(mutations.updated[0]).toMatchObject({ status: "processed" });
  });

  it("acknowledges a duplicate event before creating another order", async () => {
    const mutations = mockMutations([]);
    mockSelectResults({ platformIntegrations: [[integration()]] });

    const response = await request("/uber-eats", {
      method: "POST",
      body: JSON.stringify(webhookPayload()),
      headers: { "Content-Type": "application/json" },
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: { duplicate: true },
    });
    expect(mocks.orderService.processWebhook).not.toHaveBeenCalled();
    expect(mutations.inserted[0]).toMatchObject({
      platform: "uber_eats",
      platformEventId: "event-1",
    });
    expect(mutations.onConflictDoNothing).toHaveBeenCalled();
  });

  it("reserves the camelCase event id the idempotency middleware also accepts", async () => {
    const mutations = mockMutations();
    mockSelectResults({ platformIntegrations: [[integration()]] });

    const response = await request("/uber-eats", {
      method: "POST",
      body: JSON.stringify({
        ...webhookPayload(),
        event_id: undefined,
        eventId: "event-camel",
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).toBe(200);
    expect(mutations.inserted[0]).toMatchObject({
      platformEventId: "event-camel",
    });
  });

  it("acknowledges event types that do not announce a new order", async () => {
    const mutations = mockMutations();
    mockSelectResults({ platformIntegrations: [[integration()]] });

    const response = await request("/uber-eats", {
      method: "POST",
      body: JSON.stringify(webhookPayload({ event_type: "orders.cancel" })),
      headers: { "Content-Type": "application/json" },
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        acknowledged: true,
        eventType: "orders.cancel",
        handled: false,
      },
    });
    // Routing a cancellation through order creation is what produced the
    // orphan orders in #237.
    expect(mocks.orderService.processWebhook).not.toHaveBeenCalled();
    expect(mutations.updated[0]).toMatchObject({ status: "ignored" });
  });

  it("acknowledges payment events without order processing", async () => {
    const mutations = mockMutations();
    mockSelectResults({ platformIntegrations: [[integration()]] });

    const response = await request("/uber-eats", {
      method: "POST",
      body: JSON.stringify(webhookPayload({ event_type: "payment.succeeded" })),
      headers: { "Content-Type": "application/json" },
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        acknowledged: true,
        eventType: "payment.succeeded",
      },
    });
    expect(mocks.orderService.processWebhook).not.toHaveBeenCalled();
    expect(mutations.updated).toEqual([
      expect.objectContaining({ status: "processed" }),
    ]);
  });

  it("configures the idempotency middleware to release the key on a 5xx", () => {
    // This suite mocks the middleware to a pass-through, so the replay
    // behaviour itself is covered in `middleware/idempotency.test.ts`. What
    // has to be pinned here is the wiring: without this flag the 500 below is
    // cached for the whole TTL and the released `platform_event_id` never
    // gets a redelivery to accept.
    expect(idempotencyOptions).toContainEqual(
      expect.objectContaining({ releaseOnServerError: true }),
    );
  });

  it("logs failed order processing and returns an error", async () => {
    const mutations = mockMutations();
    mockSelectResults({ platformIntegrations: [[integration()]] });
    mocks.orderService.processWebhook.mockRejectedValueOnce(
      new Error("menu item missing"),
    );

    const response = await request("/uber-eats", {
      method: "POST",
      body: JSON.stringify(webhookPayload()),
      headers: { "Content-Type": "application/json" },
    });
    const body = await json(response);

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: {
        code: "WEBHOOK_PROCESSING_FAILED",
        message: "Processing failed",
      },
    });
    // The reservation is released so the platform's redelivery is processed
    // rather than acknowledged as a duplicate that never happened.
    expect(mutations.updated[0]).toMatchObject({
      status: "failed",
      error: "menu item missing",
      platformEventId: null,
    });
  });

  it("returns not implemented for foodpanda webhooks", async () => {
    const response = await request("/foodpanda", { method: "POST" });
    const body = await json(response);

    expect(response.status).toBe(501);
    expect(body).toEqual({
      success: false,
      error: {
        code: "INTEGRATION_NOT_AVAILABLE",
        message: "Foodpanda integration not yet implemented",
      },
    });
  });
});
