import { PAYMENT_AUDIT_EVENT_TYPES } from "@makanmakan/database";
import type { PaymentAuditEventType } from "@makanmakan/database";
import { generateUUID } from "@makanmakan/utils";
import type { Env } from "../../../types/env";

export interface PaymentAuditEventInput {
  restaurantId?: string | null;
  paymentTransactionId?: string | null;
  subscriptionId?: string | null;
  eventType: PaymentAuditEventType;
  provider?: string | null;
  providerEventId?: string | null;
  providerEventType?: string | null;
  amount?: number | null;
  currency?: string | null;
  rawPayload?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  occurredAtMs?: number;
}

function encodePayload(payload: unknown): string | null {
  if (payload === undefined || payload === null) return null;
  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

export class PaymentAuditService {
  constructor(private readonly db: Env["DB"]) {}

  prepareAppend(event: PaymentAuditEventInput) {
    const occurredAtMs = event.occurredAtMs ?? Date.now();

    return this.db
      .prepare(
        `INSERT OR IGNORE INTO payment_audit_log (
            id, restaurant_id, payment_transaction_id, subscription_id,
            event_type, provider, provider_event_id, provider_event_type,
            amount, currency, raw_payload, error_code, error_message,
            occurred_at_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        generateUUID(),
        event.restaurantId ?? null,
        event.paymentTransactionId ?? null,
        event.subscriptionId ?? null,
        event.eventType,
        event.provider ?? null,
        event.providerEventId ?? null,
        event.providerEventType ?? null,
        event.amount ?? null,
        event.currency ?? null,
        encodePayload(event.rawPayload),
        event.errorCode ?? null,
        event.errorMessage ?? null,
        occurredAtMs,
      );
  }

  async append(event: PaymentAuditEventInput): Promise<{ inserted: boolean }> {
    const result = await this.prepareAppend(event).run();

    return { inserted: (result.meta?.changes ?? 0) > 0 };
  }
}

export { PAYMENT_AUDIT_EVENT_TYPES };
