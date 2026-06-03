import type { Env } from "../../../types/env";
import { ApiError } from "../../../shared/utils/api-error";
import { CreditTopupService, hmacSha256Hex } from "./CreditTopupService";

interface CreditTopupWebhookPayload {
  intentId?: string;
  intent_id?: string;
  providerTransactionId?: string;
  provider_transaction_id?: string;
  status?: string;
  errorMessage?: string;
}

export interface CreditTopupWebhookResult {
  duplicate: boolean;
  credited: boolean;
  intentId?: string;
  status?: "paid" | "failed";
  balanceAfterCents?: number;
}

/**
 * Verifies a provider top-up callback (HMAC-SHA256 over `${timestamp}.${body}`)
 * and confirms the matching intent. Crediting is idempotent on the intent id,
 * and a re-delivered webhook for an already-paid intent returns `duplicate`.
 */
export class CreditTopupWebhookService {
  constructor(
    private readonly env: Env,
    private readonly topupService = new CreditTopupService(env),
  ) {}

  async handle(
    rawBody: string,
    headers: Headers,
  ): Promise<CreditTopupWebhookResult> {
    await this.verifySignature(rawBody, headers);

    const payload = JSON.parse(rawBody) as CreditTopupWebhookPayload;
    const intentId = stringValue(
      payload.intentId ??
        payload.intent_id ??
        headers.get("x-credit-topup-intent-id"),
    );
    const providerTransactionId = stringValue(
      payload.providerTransactionId ??
        payload.provider_transaction_id ??
        headers.get("x-provider-transaction-id"),
    );
    const status = normalizeStatus(payload.status);
    if (!status) {
      return { duplicate: false, credited: false, intentId };
    }

    const result = await this.topupService.confirmIntent({
      intentId,
      providerTransactionId,
      status,
      providerPayload: payload as unknown as Record<string, unknown>,
      errorMessage:
        typeof payload.errorMessage === "string"
          ? payload.errorMessage
          : undefined,
    });

    return {
      duplicate: result.alreadyProcessed,
      credited: result.credited,
      intentId: result.intent.id,
      status,
      balanceAfterCents: result.balanceAfterCents,
    };
  }

  private async verifySignature(rawBody: string, headers: Headers) {
    const secret = this.env.CREDIT_TOPUP_WEBHOOK_SECRET;
    if (!secret) {
      throw new ApiError(
        "CREDIT_TOPUP_WEBHOOK_SECRET_MISSING",
        "Credit top-up webhook secret is not configured",
        500,
      );
    }
    const signature = headers.get("x-credit-topup-signature");
    if (!signature) {
      throw new ApiError(
        "CREDIT_TOPUP_WEBHOOK_SIGNATURE_MISSING",
        "Missing webhook signature",
        401,
      );
    }
    const timestamp = headers.get("x-credit-topup-signature-timestamp") ?? "";
    const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
    if (signature !== expected) {
      throw new ApiError(
        "CREDIT_TOPUP_WEBHOOK_SIGNATURE_INVALID",
        "Invalid webhook signature",
        401,
      );
    }
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeStatus(value: unknown): "paid" | "failed" | null {
  const status = typeof value === "string" ? value.toLowerCase() : "";
  if (["paid", "succeeded", "completed"].includes(status)) return "paid";
  if (["failed", "payment_failed", "canceled", "cancelled"].includes(status)) {
    return "failed";
  }
  return null;
}
