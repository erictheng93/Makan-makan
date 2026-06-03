/**
 * Stored-value Credits (代幣) Feature Routes
 *
 * Admin-managed stored-value cards: issue, top up (cash/manual funding in
 * Phase 1), set PIN, freeze, and read the ledger. Balance lookup is public but
 * rate-limited (anti-enumeration). Money operations require an Idempotency-Key.
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { idempotencyMiddleware } from "../../../middleware/idempotency";
import { rateLimitMiddleware } from "../../../middleware/rateLimiter";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../../middleware/validation";
import { CreditService } from "../services/CreditService";
import {
  freezeSchema,
  issueCardSchema,
  ledgerQuerySchema,
  publicIdParamSchema,
  setPinSchema,
  topupSchema,
} from "../schemas/validation";
import type { Env } from "../../../types/env";

const app = new Hono<{ Bindings: Env }>();

const ADMIN_ONLY = requireRole([0]);

// Issue a new stored-value card (admin).
app.post(
  "/cards",
  authMiddleware,
  ADMIN_ONLY,
  idempotencyMiddleware({ scope: "credit", requireKey: false }),
  validateBody(issueCardSchema),
  async (c) => {
    const input = c.get("validatedBody");
    const result = await new CreditService(c.env).issueCard(input);
    return c.json({ success: true, data: result }, 201);
  },
);

// Top up a card balance (admin, idempotent).
app.post(
  "/cards/:publicId/topup",
  authMiddleware,
  ADMIN_ONLY,
  idempotencyMiddleware({ scope: "credit" }),
  validateParams(publicIdParamSchema),
  validateBody(topupSchema),
  async (c) => {
    const { publicId } = c.get("validatedParams");
    const body = c.get("validatedBody");
    const idempotencyKey = c.req.header("Idempotency-Key") as string;
    const result = await new CreditService(c.env).topup({
      publicId,
      amountCents: body.amountCents,
      currency: body.currency,
      idempotencyKey,
      sourceType: "topup",
      sourceId: body.reference,
    });
    return c.json({ success: true, data: result });
  },
);

// Public balance lookup by card public id (rate-limited, no PII).
app.get(
  "/cards/:publicId/balance",
  rateLimitMiddleware({
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: "credit_balance",
    message: "Too many balance lookups. Please try again later.",
  }),
  validateParams(publicIdParamSchema),
  async (c) => {
    const { publicId } = c.get("validatedParams");
    const balance = await new CreditService(c.env).getBalance(publicId);
    return c.json({ success: true, data: balance });
  },
);

// Set or reset the card PIN (admin, rate-limited).
app.post(
  "/cards/:publicId/pin",
  authMiddleware,
  ADMIN_ONLY,
  rateLimitMiddleware({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: "credit_pin",
    message: "Too many PIN updates. Please try again later.",
  }),
  validateParams(publicIdParamSchema),
  validateBody(setPinSchema),
  async (c) => {
    const { publicId } = c.get("validatedParams");
    const { newPin } = c.get("validatedBody");
    await new CreditService(c.env).setPin(publicId, newPin);
    return c.json({ success: true });
  },
);

// Freeze / mark lost / reactivate a card (admin).
app.post(
  "/cards/:publicId/freeze",
  authMiddleware,
  ADMIN_ONLY,
  validateParams(publicIdParamSchema),
  validateBody(freezeSchema),
  async (c) => {
    const { publicId } = c.get("validatedParams");
    const { status } = c.get("validatedBody");
    await new CreditService(c.env).setCardStatus(publicId, status);
    return c.json({ success: true });
  },
);

// Ledger history for a card's account (admin).
app.get(
  "/cards/:publicId/ledger",
  authMiddleware,
  ADMIN_ONLY,
  validateParams(publicIdParamSchema),
  validateQuery(ledgerQuerySchema),
  async (c) => {
    const { publicId } = c.get("validatedParams");
    const { limit, offset } = c.get("validatedQuery");
    const result = await new CreditService(c.env).listLedger(publicId, {
      limit,
      offset,
    });
    return c.json({ success: true, data: result });
  },
);

export default app;
