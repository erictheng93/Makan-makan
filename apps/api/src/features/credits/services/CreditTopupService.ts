import { drizzle } from "drizzle-orm/d1";
import { eq, or } from "drizzle-orm";
import {
  creditAccounts,
  creditCards,
  creditTopupIntents,
} from "@makanmakan/database";
import type { Env } from "../../../types/env";
import { badRequest, notFound } from "../../../shared/utils/api-error";
import { CreditService } from "./CreditService";

const INTENT_TTL_MS = 30 * 60 * 1000; // intents expire after 30 minutes
const TOPUP_PROVIDER_NAME = "credit_topup";

export interface CreditTopupNextAction {
  type: "redirect" | "client_secret";
  redirectUrl?: string;
  clientSecret?: string;
}

export interface CreditTopupGatewayInput {
  intentId: string;
  publicId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
}

export interface CreditTopupGatewayResult {
  providerTransactionId: string;
  status: "pending" | "requires_action" | "paid";
  nextAction?: CreditTopupNextAction;
}

export interface CreditTopupGateway {
  createCharge(
    input: CreditTopupGatewayInput,
  ): Promise<CreditTopupGatewayResult>;
}

type CreditTopupIntentRow = typeof creditTopupIntents.$inferSelect;

export interface CreateIntentInput {
  publicId: string;
  amountCents: number;
  currency: string;
}

export interface CreateIntentResult {
  intent: CreditTopupIntentRow;
  nextAction?: CreditTopupNextAction;
}

export interface ConfirmIntentInput {
  intentId?: string;
  providerTransactionId?: string;
  status: "paid" | "failed";
  providerPayload?: Record<string, unknown> | null;
  errorMessage?: string;
}

export interface ConfirmIntentResult {
  intent: CreditTopupIntentRow;
  credited: boolean;
  alreadyProcessed: boolean;
  balanceAfterCents?: number;
}

/**
 * Online top-up (Phase 2). Creates a pending intent and asks the configured
 * provider gateway to start a charge; the balance is credited only when a
 * verified webhook calls confirmIntent. Crediting is idempotent on the intent
 * id (the ledger idempotency key), so duplicate webhooks never double-credit.
 */
export class CreditTopupService {
  private readonly db: ReturnType<typeof drizzle>;

  constructor(
    private readonly env: Env,
    private readonly creditService = new CreditService(env),
    private readonly gateway: CreditTopupGateway = createCreditTopupGateway(
      env,
    ),
  ) {
    this.db = drizzle(env.DB);
  }

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    if (input.amountCents <= 0) {
      throw badRequest("Top-up amount must be positive");
    }

    const account = await this.db
      .select({
        id: creditAccounts.id,
        currency: creditAccounts.currency,
        status: creditAccounts.status,
      })
      .from(creditCards)
      .innerJoin(creditAccounts, eq(creditCards.accountId, creditAccounts.id))
      .where(eq(creditCards.publicId, input.publicId))
      .get();
    if (!account) {
      throw notFound("Credit card not found", "CREDIT_CARD_NOT_FOUND");
    }
    if (account.status !== "active") {
      throw badRequest(
        "Credit account is not active",
        "CREDIT_ACCOUNT_INACTIVE",
      );
    }
    if (account.currency !== input.currency) {
      throw badRequest(
        "Credit currency does not match top-up currency",
        "CREDIT_CURRENCY_MISMATCH",
      );
    }

    const expiresAt = new Date(Date.now() + INTENT_TTL_MS);
    const [intent] = await this.db
      .insert(creditTopupIntents)
      .values({
        accountId: account.id,
        publicId: input.publicId,
        provider: TOPUP_PROVIDER_NAME,
        amountCents: input.amountCents,
        currency: input.currency,
        expiresAtMs: expiresAt,
      })
      .returning();

    let charge: CreditTopupGatewayResult;
    try {
      charge = await this.gateway.createCharge({
        intentId: intent.id,
        publicId: input.publicId,
        amountCents: input.amountCents,
        currency: input.currency,
        idempotencyKey: this.ledgerKey(intent.id),
      });
    } catch (error) {
      // Don't leave an orphaned pending intent if the gateway rejects.
      await this.db
        .update(creditTopupIntents)
        .set({
          status: "failed",
          failedAtMs: new Date(),
          errorMessage:
            error instanceof Error ? error.message : "Gateway charge failed",
          updatedAt: new Date(),
        })
        .where(eq(creditTopupIntents.id, intent.id));
      throw error;
    }

    const [updated] = await this.db
      .update(creditTopupIntents)
      .set({
        providerTransactionId: charge.providerTransactionId,
        updatedAt: new Date(),
      })
      .where(eq(creditTopupIntents.id, intent.id))
      .returning();

    return { intent: updated, nextAction: charge.nextAction };
  }

  async confirmIntent(input: ConfirmIntentInput): Promise<ConfirmIntentResult> {
    const intent = await this.findIntent(input);
    if (!intent) {
      throw notFound(
        "Top-up intent not found",
        "CREDIT_TOPUP_INTENT_NOT_FOUND",
      );
    }
    if (intent.status === "paid") {
      return { intent, credited: false, alreadyProcessed: true };
    }
    if (intent.status === "failed" || intent.status === "expired") {
      return { intent, credited: false, alreadyProcessed: true };
    }

    const now = new Date();
    if (input.status === "failed") {
      const [failed] = await this.db
        .update(creditTopupIntents)
        .set({
          status: "failed",
          failedAtMs: now,
          providerPayload: input.providerPayload ?? null,
          errorMessage: input.errorMessage ?? null,
          updatedAt: now,
        })
        .where(eq(creditTopupIntents.id, intent.id))
        .returning();
      return { intent: failed, credited: false, alreadyProcessed: false };
    }

    // status === "paid": credit the balance idempotently, then mark paid.
    const credit = await this.creditService.topup({
      publicId: intent.publicId,
      amountCents: intent.amountCents,
      currency: intent.currency,
      idempotencyKey: this.ledgerKey(intent.id),
      sourceType: "topup",
      sourceId: intent.id,
    });

    const [paid] = await this.db
      .update(creditTopupIntents)
      .set({
        status: "paid",
        ledgerEntryId: credit.ledgerEntryId,
        paidAtMs: now,
        providerPayload: input.providerPayload ?? null,
        updatedAt: now,
      })
      .where(eq(creditTopupIntents.id, intent.id))
      .returning();

    return {
      intent: paid,
      credited: true,
      alreadyProcessed: false,
      balanceAfterCents: credit.balanceAfterCents,
    };
  }

  async getIntent(intentId: string): Promise<CreditTopupIntentRow | undefined> {
    return this.db
      .select()
      .from(creditTopupIntents)
      .where(eq(creditTopupIntents.id, intentId))
      .get();
  }

  private ledgerKey(intentId: string): string {
    return `credit-topup:${intentId}`;
  }

  private async findIntent(input: {
    intentId?: string;
    providerTransactionId?: string;
  }): Promise<CreditTopupIntentRow | undefined> {
    if (!input.intentId && !input.providerTransactionId) {
      throw badRequest(
        "Top-up confirmation requires an intent or provider transaction id",
        "CREDIT_TOPUP_IDENTIFIER_REQUIRED",
      );
    }
    const conditions = [
      input.intentId ? eq(creditTopupIntents.id, input.intentId) : undefined,
      input.providerTransactionId
        ? eq(
            creditTopupIntents.providerTransactionId,
            input.providerTransactionId,
          )
        : undefined,
    ].filter(Boolean) as ReturnType<typeof eq>[];

    return this.db
      .select()
      .from(creditTopupIntents)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .get();
  }
}

// ---- gateway -------------------------------------------------------------

class UnconfiguredCreditTopupGateway implements CreditTopupGateway {
  async createCharge(): Promise<CreditTopupGatewayResult> {
    throw badRequest(
      "Online top-up provider is not configured",
      "CREDIT_TOPUP_NOT_CONFIGURED",
    );
  }
}

/**
 * HTTP gateway: posts the charge request to the configured provider and
 * returns its provider transaction id + a customer next action. Mirrors the
 * market-checkout HTTP gateway (optional bearer token + HMAC request signing).
 */
export class HttpCreditTopupGateway implements CreditTopupGateway {
  constructor(
    private readonly endpoint: string,
    private readonly bearerToken?: string,
    private readonly signingSecret?: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async createCharge(
    input: CreditTopupGatewayInput,
  ): Promise<CreditTopupGatewayResult> {
    const body = JSON.stringify(input);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(this.bearerToken
        ? { authorization: `Bearer ${this.bearerToken}` }
        : {}),
    };
    if (this.signingSecret) {
      const timestamp = new Date().toISOString();
      headers["x-credit-topup-signature-timestamp"] = timestamp;
      headers["x-credit-topup-signature"] = await hmacSha256Hex(
        this.signingSecret,
        `${timestamp}.${body}`,
      );
    }

    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) {
      throw new Error(`Credit top-up gateway failed: ${response.status}`);
    }
    return parseGatewayResult(
      (await response.json()) as Partial<CreditTopupGatewayResult>,
    );
  }
}

export function createCreditTopupGateway(env: Env): CreditTopupGateway {
  if (!env.CREDIT_TOPUP_PROVIDER_URL) {
    return new UnconfiguredCreditTopupGateway();
  }
  return new HttpCreditTopupGateway(
    env.CREDIT_TOPUP_PROVIDER_URL,
    env.CREDIT_TOPUP_PROVIDER_TOKEN,
    env.CREDIT_TOPUP_PROVIDER_SIGNING_SECRET,
  );
}

function parseGatewayResult(
  payload: Partial<CreditTopupGatewayResult>,
): CreditTopupGatewayResult {
  if (!payload.providerTransactionId) {
    throw new Error("Credit top-up gateway response is invalid");
  }
  const status =
    payload.status === "paid" ||
    payload.status === "pending" ||
    payload.status === "requires_action"
      ? payload.status
      : "pending";
  return {
    providerTransactionId: payload.providerTransactionId,
    status,
    nextAction: parseNextAction(payload.nextAction),
  };
}

function parseNextAction(value: unknown): CreditTopupNextAction | undefined {
  if (!value || typeof value !== "object") return undefined;
  const action = value as Partial<CreditTopupNextAction>;
  if (action.type === "redirect" && typeof action.redirectUrl === "string") {
    return { type: "redirect", redirectUrl: action.redirectUrl };
  }
  if (
    action.type === "client_secret" &&
    typeof action.clientSecret === "string"
  ) {
    return { type: "client_secret", clientSecret: action.clientSecret };
  }
  return undefined;
}

export async function hmacSha256Hex(
  secret: string,
  value: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
