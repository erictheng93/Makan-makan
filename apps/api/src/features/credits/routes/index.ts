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
import { toCsv } from "../../../shared/utils/csv";
import { CreditService } from "../services/CreditService";
import { CreditTopupService } from "../services/CreditTopupService";
import { CreditTopupWebhookService } from "../services/CreditTopupWebhookService";
import {
  accountingExportQuerySchema,
  freezeSchema,
  issueCardSchema,
  ledgerQuerySchema,
  onlineTopupSchema,
  publicIdParamSchema,
  setPinSchema,
  topupSchema,
} from "../schemas/validation";
import type { creditLedgerEntries } from "@makanmakan/database";
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

// Start an online top-up (public, rate-limited). Creates a pending intent and
// returns a provider next action; the balance is credited only on a verified
// webhook (POST /topup-webhooks/:provider) — the client is never trusted.
app.post(
  "/cards/:publicId/topup/online",
  rateLimitMiddleware({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: "credit_topup_online",
    message: "Too many top-up attempts. Please try again later.",
  }),
  validateParams(publicIdParamSchema),
  validateBody(onlineTopupSchema),
  async (c) => {
    const { publicId } = c.get("validatedParams");
    const body = c.get("validatedBody");
    const result = await new CreditTopupService(c.env).createIntent({
      publicId,
      amountCents: body.amountCents,
      currency: body.currency,
    });
    return c.json(
      {
        success: true,
        data: {
          intentId: result.intent.id,
          status: result.intent.status,
          amountCents: result.intent.amountCents,
          currency: result.intent.currency,
          providerTransactionId: result.intent.providerTransactionId,
          nextAction: result.nextAction ?? null,
        },
      },
      201,
    );
  },
);

// Provider top-up callback (signature-verified; credits on confirmed payment).
app.post("/topup-webhooks/:provider", async (c) => {
  const rawBody = await c.req.text();
  const result = await new CreditTopupWebhookService(c.env).handle(
    rawBody,
    c.req.raw.headers,
  );
  return c.json({ success: true, data: result });
});

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

// Credits liability (2100) sub-ledger CSV export (admin). NOTE: the spend/refund
// *settlement* legs (vendor payable, platform fee) are journaled by the
// market-checkout accounting export; this report is the liability-movement
// detail (topup / spend / refund / expire / adjust) that reconciles to 2100.
app.get(
  "/accounting/export",
  authMiddleware,
  ADMIN_ONLY,
  validateQuery(accountingExportQuerySchema),
  async (c) => {
    const { from, to } = c.get("validatedQuery");
    const entries = await new CreditService(c.env).listLedgerForExport({
      fromMs: from,
      toMs: to,
    });
    return new Response(buildCreditLedgerCsv(entries), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition":
          'attachment; filename="credit-liability-ledger.csv"',
      },
    });
  },
);

export default app;

const CREDIT_LIABILITY_ACCOUNT = { code: "2100", name: "credits_liability" };

function buildCreditLedgerCsv(
  entries: (typeof creditLedgerEntries.$inferSelect)[],
): string {
  const headers = [
    "created_at_ms",
    "account_id",
    "entry_type",
    "account_code",
    "account_name",
    "direction",
    "amount_cents",
    "currency",
    "source_type",
    "source_id",
    "balance_after_cents",
    "idempotency_key",
  ];
  const rows = entries.map((e) => [
    e.createdAt instanceof Date ? e.createdAt.getTime() : e.createdAt,
    e.accountId,
    e.entryType,
    CREDIT_LIABILITY_ACCOUNT.code,
    CREDIT_LIABILITY_ACCOUNT.name,
    // Liability increases (credit) on inflows, decreases (debit) on outflows.
    e.amountCents >= 0 ? "credit" : "debit",
    Math.abs(e.amountCents),
    e.currency,
    e.sourceType,
    e.sourceId ?? "",
    e.balanceAfterCents,
    e.idempotencyKey,
  ]);
  return toCsv([headers, ...rows]);
}
