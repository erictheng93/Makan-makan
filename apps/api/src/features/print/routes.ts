import { Hono, type Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { cashRegisters, printAgents, receipts } from "@makanmasak/database";
import { z } from "zod";
import type { Env } from "../../types/env";
import { hashPrintAgentKey } from "../../shared/utils/print-agent-key";

const app = new Hono<{ Bindings: Env }>();

/**
 * A claim older than this lost its agent rather than the race: the agent caps
 * its own wait on the physical printer at 30s, so anything still "printing"
 * after five minutes is a process that died between claiming and
 * acknowledging. Without this the row stays claimed forever and the receipt is
 * silently never printed.
 */
const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Delivery attempts before a receipt is given up on. A receipt that reliably
 * kills the agent — a malformed historic payload, say — would otherwise be
 * reclaimed on every poll forever.
 */
const MAX_DELIVERY_ATTEMPTS = 5;

const acknowledgementSchema = z.object({
  status: z.enum(["printed", "failed"]),
  printerName: z.string().trim().max(200).optional(),
  response: z.string().max(2000).optional(),
});

interface AgentIdentity {
  agentId: string;
  registerId: string;
  restaurantId: string;
}

/**
 * Resolve the caller from its key alone. The register — and through it the
 * restaurant — is derived from the credential, never read from a header: an
 * agent that could name its own tenant could claim and read another shop's
 * receipts, which carry customer names, line items and payment methods.
 */
async function authenticateAgent(
  c: Context<{ Bindings: Env }>,
): Promise<AgentIdentity | null> {
  const presented = c.req.header("X-Print-Agent-Key");
  if (!presented) return null;

  const [agent] = await drizzle(c.env.DB)
    .select({
      agentId: printAgents.id,
      registerId: printAgents.registerId,
      restaurantId: cashRegisters.restaurantId,
    })
    .from(printAgents)
    .innerJoin(cashRegisters, eq(cashRegisters.id, printAgents.registerId))
    .where(
      and(
        eq(printAgents.keyHash, await hashPrintAgentKey(presented)),
        isNull(printAgents.revokedAt),
      ),
    )
    .limit(1);

  return agent ?? null;
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
  receipt: {
    id: string;
    orderId: string;
    content: string;
    createdAt: Date | null;
  },
  restaurantId: string,
) {
  let content: Record<string, unknown> = {};
  try {
    content = JSON.parse(receipt.content || "{}") as Record<string, unknown>;
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
        id: receipt.orderId,
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
        createdAt: (receipt.createdAt ?? new Date(0)).toISOString(),
      },
      customer: content.customerName
        ? { name: String(content.customerName) }
        : undefined,
      payment: content.paymentMethod
        ? {
            method: String(content.paymentMethod),
            amount: Number(content.totalAmount ?? 0),
            transactionId: receipt.id,
          }
        : undefined,
    },
  };
}

app.get("/jobs", async (c) => {
  const agent = await authenticateAgent(c);
  if (!agent) return unauthorized(c);

  const db = drizzle(c.env.DB);
  const now = new Date();
  const staleBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MS);

  // A claim older than the timeout is abandoned. So is one with no timestamp
  // at all: "printing" with nothing tracking the claim is precisely the state
  // this reclaim exists to resolve.
  const abandoned = and(
    eq(receipts.printStatus, "printing"),
    or(isNull(receipts.claimedAt), lte(receipts.claimedAt, staleBefore)),
  );

  await db
    .update(receipts)
    .set({
      printStatus: "failed",
      printerResponse: `Abandoned after ${MAX_DELIVERY_ATTEMPTS} delivery attempts`,
      claimedAt: null,
    })
    .where(
      and(
        eq(receipts.registerId, agent.registerId),
        abandoned,
        gte(receipts.printAttempts, MAX_DELIVERY_ATTEMPTS),
      ),
    );

  const claimable = or(
    eq(receipts.printStatus, "pending"),
    and(abandoned, lt(receipts.printAttempts, MAX_DELIVERY_ATTEMPTS)),
  );

  const nextJob = db
    .select({ id: receipts.id })
    .from(receipts)
    .where(and(eq(receipts.registerId, agent.registerId), claimable))
    .orderBy(asc(receipts.createdAt))
    .limit(1);

  // Claim and read in one statement, so two agents sharing a register cannot
  // both walk away with the same receipt.
  const [claimed] = await db
    .update(receipts)
    .set({
      printStatus: "printing",
      printAttempts: sql`${receipts.printAttempts} + 1`,
      claimedAt: now,
    })
    .where(
      and(
        // The register predicate is repeated outside the subquery so the
        // tenant scope of the write is visible without tracing into it.
        eq(receipts.registerId, agent.registerId),
        inArray(receipts.id, nextJob),
        claimable,
      ),
    )
    .returning({
      id: receipts.id,
      orderId: receipts.orderId,
      content: receipts.content,
      createdAt: receipts.createdAt,
    });

  await db
    .update(printAgents)
    .set({ lastSeenAt: now, updatedAt: now })
    .where(eq(printAgents.id, agent.agentId));

  if (!claimed) return c.json({ success: true, data: null });
  return c.json({
    success: true,
    data: {
      receiptId: claimed.id,
      request: requestForReceipt(claimed, agent.restaurantId),
    },
  });
});

app.post("/jobs/:receiptId/ack", async (c) => {
  const agent = await authenticateAgent(c);
  if (!agent) return unauthorized(c);

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

  const settled = await drizzle(c.env.DB)
    .update(receipts)
    .set({
      printStatus: parsed.data.status,
      printerName: parsed.data.printerName ?? null,
      printerResponse: parsed.data.response ?? null,
      claimedAt: null,
      ...(parsed.data.status === "printed" ? { printedAt: new Date() } : {}),
    })
    .where(
      and(
        eq(receipts.id, c.req.param("receiptId")),
        eq(receipts.printStatus, "printing"),
        // Scoped to the acknowledging agent's own register, so a credential
        // can never settle a job it was not handed.
        eq(receipts.registerId, agent.registerId),
      ),
    )
    .returning({ id: receipts.id });

  if (settled.length === 0)
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
