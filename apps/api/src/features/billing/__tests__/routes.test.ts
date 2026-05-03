import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";
import billingRoutes from "../routes";

function buildApp(env: Record<string, unknown>) {
  const app = new Hono<any>();
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as never,
      );
    }
    return c.json({ success: false, error: { message: err.message } }, 500);
  });
  app.route("/billing", billingRoutes);
  return { app, env: { NODE_ENV: "test", ...env } };
}

describe("Billing webhook routes", () => {
  it("records provider webhooks and reconciles invoice.paid", async () => {
    const auditRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const auditBind = vi.fn(() => ({ run: auditRun }));
    const reconcileStatements: Array<{ args: unknown[] }> = [];
    const prepare = vi.fn((sql: string) => {
      if (sql.includes("INSERT OR IGNORE INTO payment_audit_log")) {
        return { bind: auditBind };
      }
      return {
        bind: vi.fn((...args: unknown[]) => {
          const statement = { args };
          reconcileStatements.push(statement);
          return statement;
        }),
      };
    });
    const batch = vi.fn().mockResolvedValue([]);
    const { app, env } = buildApp({ DB: { prepare, batch } });

    const response = await app.request(
      "/billing/webhooks/stripe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "evt_1",
          type: "invoice.paid",
          data: {
            object: {
              metadata: { restaurantId: "rest-1" },
            },
          },
        }),
      },
      env,
    );
    const json = (await response.json()) as {
      data: { duplicate: boolean; reconciled: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({ duplicate: false, reconciled: true });
    expect(auditBind).toHaveBeenCalledWith(
      expect.any(String),
      "rest-1",
      null,
      null,
      "webhook_received",
      "stripe",
      "evt_1",
      "invoice.paid",
      null,
      null,
      expect.stringContaining('"type":"invoice.paid"'),
      null,
      null,
      expect.any(Number),
    );
    expect(batch).toHaveBeenCalledOnce();
    expect(reconcileStatements[0].args).toEqual([expect.any(Number), "rest-1"]);
    expect(reconcileStatements[1].args).toContain("success");
  });

  it("does not reconcile duplicate provider events", async () => {
    const auditRun = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
    const auditBind = vi.fn(() => ({ run: auditRun }));
    const prepare = vi.fn(() => ({ bind: auditBind }));
    const batch = vi.fn();
    const { app, env } = buildApp({ DB: { prepare, batch } });

    const response = await app.request(
      "/billing/webhooks/stripe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "evt_1", type: "invoice.paid" }),
      },
      env,
    );
    const json = (await response.json()) as {
      data: { duplicate: boolean; reconciled: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({ duplicate: true, reconciled: false });
    expect(batch).not.toHaveBeenCalled();
  });
});
