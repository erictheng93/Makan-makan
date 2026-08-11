import { PAYMENT_AUDIT_EVENT_TYPES } from "@makanmasak/database";
import { paymentAuditLog } from "@makanmasak/database";
import type { PaymentAuditEventType } from "@makanmasak/database";
import { generateUUID } from "@makanmasak/utils";
import type { BatchItem } from "drizzle-orm/batch";
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

  buildAppendQuery(
    drizzleDb: {
      insert: (table: typeof paymentAuditLog) => {
        values: (value: typeof paymentAuditLog.$inferInsert) => {
          onConflictDoNothing: () => BatchItem<"sqlite">;
        };
      };
    },
    event: PaymentAuditEventInput,
  ): BatchItem<"sqlite"> {
    const occurredAtMs = event.occurredAtMs ?? Date.now();

    return drizzleDb
      .insert(paymentAuditLog)
      .values({
        id: generateUUID(),
        restaurantId: event.restaurantId ?? null,
        paymentTransactionId: event.paymentTransactionId ?? null,
        subscriptionId: event.subscriptionId ?? null,
        eventType: event.eventType,
        provider: event.provider ?? null,
        providerEventId: event.providerEventId ?? null,
        providerEventType: event.providerEventType ?? null,
        amount: event.amount ?? null,
        currency: event.currency ?? null,
        rawPayload: event.rawPayload ?? null,
        errorCode: event.errorCode ?? null,
        errorMessage: event.errorMessage ?? null,
        occurredAt: new Date(occurredAtMs),
      })
      .onConflictDoNothing();
  }

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
