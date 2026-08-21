import { describe, expect, it, vi } from "vitest";
import routes from "./routes";

function database(firstResult: unknown = null, changes = 1) {
  const statement = {
    bind: vi.fn(() => statement),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ meta: { changes } }),
  };
  return { prepare: vi.fn(() => statement), statement };
}

function request(
  path: string,
  init: RequestInit,
  db: ReturnType<typeof database>,
) {
  return routes.request(path, init, {
    DB: db,
    PRINT_AGENT_API_KEY: "agent-secret",
  } as never);
}

describe("cloud print jobs", () => {
  it("atomically claims a pending receipt only for the authenticated register restaurant", async () => {
    const db = database({
      id: "receipt-1",
      order_id: "order-1",
      content: JSON.stringify({ items: [], totalAmount: 12 }),
      created_at_ms: 1755000000000,
    });
    const response = await request(
      "/jobs?registerId=register-1",
      {
        headers: {
          "X-Print-Agent-Key": "agent-secret",
          "X-Restaurant-Id": "restaurant-1",
        },
      },
      db,
    );

    expect(response.status).toBe(200);
    expect(db.statement.bind).toHaveBeenCalledWith(
      "register-1",
      "restaurant-1",
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        receiptId: "receipt-1",
        request: { restaurantId: "restaurant-1" },
      },
    });
  });

  it("renders the claimed receipt timestamp from epoch milliseconds", async () => {
    // created_at_ms is an INTEGER column, so the row arrives as a number.
    // Handing that to Date as a string yields an Invalid Date whose
    // toISOString() throws — and it throws *after* the claim UPDATE has run,
    // stranding the receipt in "printing" with nothing left to print it.
    // A small seed value hides this: new Date("0") happens to parse.
    const db = database({
      id: "receipt-1",
      order_id: "order-1",
      content: JSON.stringify({ items: [], totalAmount: 12 }),
      created_at_ms: 1755000000000,
    });

    const response = await request(
      "/jobs?registerId=register-1",
      {
        headers: {
          "X-Print-Agent-Key": "agent-secret",
          "X-Restaurant-Id": "restaurant-1",
        },
      },
      db,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        request: {
          data: { order: { createdAt: "2025-08-12T12:00:00.000Z" } },
        },
      },
    });
  });

  it("rejects agents with invalid credentials before querying jobs", async () => {
    const db = database();
    const response = await request(
      "/jobs?registerId=register-1",
      {
        headers: {
          "X-Print-Agent-Key": "wrong",
          "X-Restaurant-Id": "restaurant-1",
        },
      },
      db,
    );
    expect(response.status).toBe(401);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("only settles a claimed job when the agent acknowledges its outcome", async () => {
    const db = database(null, 1);
    const response = await request(
      "/jobs/receipt-1/ack",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Print-Agent-Key": "agent-secret",
          "X-Restaurant-Id": "restaurant-1",
        },
        body: JSON.stringify({ status: "printed", printerName: "USB-1" }),
      },
      db,
    );
    expect(response.status).toBe(200);
    expect(db.statement.bind).toHaveBeenCalledWith(
      "printed",
      "printed",
      expect.any(Number),
      "USB-1",
      null,
      "receipt-1",
      "restaurant-1",
    );
  });
});
