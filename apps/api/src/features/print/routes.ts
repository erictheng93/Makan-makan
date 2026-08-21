import { Hono, type Context } from "hono";
import { z } from "zod";
import type { Env } from "../../types/env";

const app = new Hono<{ Bindings: Env }>();

const acknowledgementSchema = z.object({
  status: z.enum(["printed", "failed"]),
  printerName: z.string().trim().max(200).optional(),
  response: z.string().max(2000).optional(),
});

function isAgentAuthorized(request: Request, env: Env): boolean {
  const expected = env.PRINT_AGENT_API_KEY;
  return (
    Boolean(expected) && request.headers.get("X-Print-Agent-Key") === expected
  );
}

function unauthorized(c: Context<{ Bindings: Env }>) {
  return c.json(
    {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid print-agent credentials",
      },
    },
    401,
  );
}

function requestForReceipt(
  receipt: Record<string, unknown>,
  restaurantId: string,
) {
  let content: Record<string, unknown> = {};
  try {
    content = JSON.parse(String(receipt.content || "{}")) as Record<
      string,
      unknown
    >;
  } catch {
    // A malformed historic payload should be acknowledged as failed by the
    // agent rather than leaving a claimed row behind after an API exception.
  }
  return {
    country: "TW",
    type: "receipt",
    restaurantId,
    data: {
      order: {
        id: String(receipt.order_id),
        tableNumber:
          typeof content.tableNumber === "string"
            ? content.tableNumber
            : undefined,
        items: Array.isArray(content.items)
          ? content.items.map((item: Record<string, unknown>) => ({
              name: String(item.name ?? "Item"),
              quantity: Number(item.quantity ?? 1),
              price: Number(item.price ?? 0),
            }))
          : [],
        subtotal: Number(content.subtotal ?? 0),
        tax: Number(content.taxAmount ?? 0),
        total: Number(content.totalAmount ?? 0),
        // created_at_ms is INTEGER epoch milliseconds. Stringifying it first
        // hands Date a numeric string, which it parses as a date literal and
        // not as a timestamp — every real receipt became an Invalid Date whose
        // toISOString() threw, after the claim UPDATE had already run.
        createdAt: new Date(Number(receipt.created_at_ms)).toISOString(),
      },
      customer: content.customerName
        ? { name: String(content.customerName) }
        : undefined,
      payment: content.paymentMethod
        ? {
            method: String(content.paymentMethod),
            amount: Number(content.totalAmount ?? 0),
            transactionId: String(receipt.id),
          }
        : undefined,
    },
  };
}

app.get("/jobs", async (c) => {
  if (!isAgentAuthorized(c.req.raw, c.env)) return unauthorized(c);
  const registerId = c.req.query("registerId");
  const restaurantId = c.req.header("X-Restaurant-Id");
  if (!registerId || !restaurantId)
    return c.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "registerId and X-Restaurant-Id are required",
        },
      },
      400,
    );

  const receipt = await c.env.DB.prepare(
    `UPDATE receipts
       SET print_status = 'printing', print_attempts = print_attempts + 1
     WHERE id = (
       SELECT r.id FROM receipts r
       JOIN cash_registers cr ON cr.id = r.register_id
       WHERE r.print_status = 'pending' AND r.register_id = ? AND cr.restaurant_id = ?
       ORDER BY r.created_at_ms ASC LIMIT 1
     ) AND print_status = 'pending'
     RETURNING id, order_id, content, created_at_ms`,
  )
    .bind(registerId, restaurantId)
    .first<Record<string, unknown>>();
  if (!receipt) return c.json({ success: true, data: null });
  return c.json({
    success: true,
    data: {
      receiptId: receipt.id,
      request: requestForReceipt(receipt, restaurantId),
    },
  });
});

app.post("/jobs/:receiptId/ack", async (c) => {
  if (!isAgentAuthorized(c.req.raw, c.env)) return unauthorized(c);
  const restaurantId = c.req.header("X-Restaurant-Id");
  if (!restaurantId)
    return c.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "X-Restaurant-Id is required",
        },
      },
      400,
    );
  const parsed = acknowledgementSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success)
    return c.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid acknowledgement" },
      },
      400,
    );
  const result = await c.env.DB.prepare(
    `UPDATE receipts SET print_status = ?, printed_at_ms = CASE WHEN ? = 'printed' THEN ? ELSE printed_at_ms END,
       printer_name = ?, printer_response = ?
     WHERE id = ? AND print_status = 'printing' AND register_id IN
       (SELECT id FROM cash_registers WHERE restaurant_id = ?)`,
  )
    .bind(
      parsed.data.status,
      parsed.data.status,
      Date.now(),
      parsed.data.printerName ?? null,
      parsed.data.response ?? null,
      c.req.param("receiptId"),
      restaurantId,
    )
    .run();
  if (!result.meta.changes)
    return c.json(
      {
        success: false,
        error: { code: "JOB_NOT_FOUND", message: "No claimed print job found" },
      },
      404,
    );
  return c.json({ success: true });
});

export default app;
