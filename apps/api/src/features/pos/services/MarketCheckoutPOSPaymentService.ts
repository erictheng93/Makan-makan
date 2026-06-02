import type { Env } from "../../../types/env";
import {
  badRequest,
  forbidden,
  notFound,
} from "../../../shared/utils/api-error";

type MarketCheckoutPaymentStatus =
  | "pending"
  | "partial_paid"
  | "paid"
  | "failed"
  | "refunded"
  | "partial_refunded";

type MarketCheckoutPaymentMethod = "cash" | "card" | "digital_wallet";

interface MarketCheckoutSessionRow {
  id: string;
  market_id: string;
  market_slug: string;
  market_name: string;
  platform_fee_rate_bps: number | null;
  payment_status: MarketCheckoutPaymentStatus;
  payment_summary: string | Record<string, unknown> | null;
  subtotal_cents: number;
  child_order_count: number;
  created_at_ms: number;
}

interface MarketCheckoutChildOrderRow {
  restaurant_id: string;
  restaurant_name: string;
  order_id: number;
  order_number: string;
  total_amount: number;
  total_amount_cents: number | null;
}

interface ActiveShiftRow {
  shift_id: string;
  register_id: string;
  restaurant_id: string;
}

export interface ProcessMarketCheckoutPOSPaymentInput {
  checkoutId: string;
  registerId: string;
  shiftId?: string;
  paymentMethod: MarketCheckoutPaymentMethod;
  country: "TW" | "MY" | "VN";
  currency: "TWD" | "MYR" | "VND";
  operatorId: number;
  operatorRole: number;
  operatorRestaurantId?: string | number | null;
  idempotencyKey?: string | null;
}

export class MarketCheckoutPOSPaymentService {
  constructor(private readonly env: Env) {}

  async process(input: ProcessMarketCheckoutPOSPaymentInput) {
    const session = await this.readSession(input.checkoutId);
    if (!session) {
      throw notFound("Market checkout not found");
    }
    if (session.payment_status === "paid") {
      return {
        checkout: this.buildResponseCheckout(
          session,
          [],
          session.payment_summary,
        ),
        payment: parseJsonObject(session.payment_summary),
        alreadyPaid: true,
      };
    }

    const [children, shift] = await Promise.all([
      this.readChildren(input.checkoutId),
      this.readActiveShift(input),
    ]);
    if (children.length === 0) {
      throw badRequest("Market checkout has no child orders to pay");
    }
    if (!shift) {
      throw badRequest("Active POS shift not found for register");
    }
    this.assertCanUseRegister(input, shift, children);

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const parentIdempotencyKey =
      input.idempotencyKey ?? `pos-market-checkout:${input.checkoutId}`;
    const childPayments = children.map((child) => {
      const amountCents = orderChildTotalCents(child);
      return {
        restaurantId: child.restaurant_id,
        restaurantName: child.restaurant_name,
        orderId: child.order_id,
        orderNumber: child.order_number,
        paymentId: `pos_market_${input.checkoutId}_${child.order_id}`,
        status: "paid" as const,
        amount: amountCents / 100,
        amountCents,
      };
    });
    const totalAmountCents = childPayments.reduce(
      (sum, payment) => sum + payment.amountCents,
      0,
    );
    const payment = {
      status: "paid" as const,
      method: `pos_${input.paymentMethod}`,
      currency: input.currency,
      country: input.country,
      totalAmount: totalAmountCents / 100,
      totalAmountCents,
      paidAmount: totalAmountCents / 100,
      paidAmountCents: totalAmountCents,
      refundedAmount: 0,
      refundedAmountCents: 0,
      paidAt: nowIso,
      childPayments,
      parentPayment: {
        paymentId: `market_pay_${input.checkoutId}`,
        status: "paid" as const,
        provider: `pos_${input.paymentMethod}`,
        splitMode: "child_transactions" as const,
        idempotencyKey: parentIdempotencyKey,
        amountCents: totalAmountCents,
        paidAmountCents: totalAmountCents,
        refundedAmountCents: 0,
        childPaymentIds: childPayments.map((child) => child.paymentId),
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      settlement: buildSettlement(session, childPayments),
    };

    await Promise.all(
      children.map((child) =>
        this.recordChildPayment({
          child,
          paymentId: `pos_market_${input.checkoutId}_${child.order_id}`,
          paymentMethod: input.paymentMethod,
          amountCents: orderChildTotalCents(child),
          currency: input.currency,
          country: input.country,
          checkoutId: input.checkoutId,
          registerId: input.registerId,
          shiftId: shift.shift_id,
          idempotencyKey: `${parentIdempotencyKey}:${child.order_id}`,
          nowMs,
        }),
      ),
    );
    await Promise.all([
      this.updateSessionPayment(input.checkoutId, payment, nowMs),
      this.upsertParentPayment({
        session,
        payment,
        registerId: input.registerId,
        shiftId: shift.shift_id,
        paymentMethod: input.paymentMethod,
        nowMs,
      }),
      this.recordPOSSale({
        checkoutId: input.checkoutId,
        registerId: input.registerId,
        shiftId: shift.shift_id,
        operatorId: input.operatorId,
        paymentMethod: input.paymentMethod,
        amountCents: totalAmountCents,
        nowMs,
      }),
    ]);

    const checkout = this.buildResponseCheckout(session, children, payment);
    await Promise.all([
      this.updateCachedSession(input.checkoutId, checkout),
      this.updateCachedIndex(input.checkoutId),
    ]);

    return { checkout, payment, alreadyPaid: false };
  }

  private readSession(checkoutId: string) {
    return this.env.DB.prepare(
      `SELECT id, market_id, market_slug, market_name, platform_fee_rate_bps,
              payment_status, payment_summary, subtotal_cents,
              child_order_count, created_at_ms
         FROM market_checkout_sessions
        WHERE id = ?
        LIMIT 1`,
    )
      .bind(checkoutId)
      .first<MarketCheckoutSessionRow>();
  }

  private readChildren(checkoutId: string) {
    return this.env.DB.prepare(
      `SELECT restaurant_id, restaurant_name, order_id, order_number,
              total_amount, total_amount_cents
         FROM market_checkout_child_orders
        WHERE checkout_id = ?
        ORDER BY order_id ASC`,
    )
      .bind(checkoutId)
      .all<MarketCheckoutChildOrderRow>()
      .then((result) => result.results ?? []);
  }

  private readActiveShift(input: ProcessMarketCheckoutPOSPaymentInput) {
    const shiftFilter = input.shiftId
      ? "s.id = ? AND s.register_id = ?"
      : "s.register_id = ?";
    const bindings = input.shiftId
      ? [input.shiftId, input.registerId]
      : [input.registerId];

    return this.env.DB.prepare(
      `SELECT s.id AS shift_id, s.register_id, r.restaurant_id
         FROM cash_shifts s
         JOIN cash_registers r ON r.id = s.register_id
        WHERE ${shiftFilter}
          AND s.status = 'active'
          AND r.is_active = 1
        LIMIT 1`,
    )
      .bind(...bindings)
      .first<ActiveShiftRow>();
  }

  private assertCanUseRegister(
    input: ProcessMarketCheckoutPOSPaymentInput,
    shift: ActiveShiftRow,
    children: MarketCheckoutChildOrderRow[],
  ) {
    if (input.operatorRole === 0) return;

    if (
      input.operatorRestaurantId === undefined ||
      input.operatorRestaurantId === null ||
      String(input.operatorRestaurantId) !== shift.restaurant_id
    ) {
      throw forbidden("Cannot use a POS register outside your restaurant");
    }

    if (
      !children.some((child) => child.restaurant_id === shift.restaurant_id)
    ) {
      throw forbidden(
        "POS register restaurant is not a vendor in this market checkout",
      );
    }
  }

  private async recordChildPayment(input: {
    child: MarketCheckoutChildOrderRow;
    paymentId: string;
    paymentMethod: MarketCheckoutPaymentMethod;
    amountCents: number;
    currency: string;
    country: string;
    checkoutId: string;
    registerId: string;
    shiftId: string;
    idempotencyKey: string;
    nowMs: number;
  }) {
    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT OR IGNORE INTO payment_transactions (
            transaction_id, order_id, restaurant_id, amount_cents, currency,
            country_code, payment_method, gateway, status, idempotency_key,
            metadata, created_at_ms, updated_at_ms, completed_at_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pos', 'paid', ?, ?, ?, ?, ?)`,
      ).bind(
        input.paymentId,
        input.child.order_id,
        input.child.restaurant_id,
        input.amountCents,
        input.currency,
        input.country,
        input.paymentMethod,
        input.idempotencyKey,
        JSON.stringify({
          source: "pos_market_checkout",
          marketCheckoutId: input.checkoutId,
          registerId: input.registerId,
          shiftId: input.shiftId,
        }),
        input.nowMs,
        input.nowMs,
        input.nowMs,
      ),
      this.env.DB.prepare(
        `UPDATE orders
            SET payment_status = 'paid',
                payment_method = ?,
                payment_transaction_id = ?,
                paid_at_ms = COALESCE(paid_at_ms, ?),
                updated_at_ms = ?
          WHERE id = ?`,
      ).bind(
        input.paymentMethod,
        input.paymentId,
        input.nowMs,
        input.nowMs,
        input.child.order_id,
      ),
    ]);
  }

  private async updateSessionPayment(
    checkoutId: string,
    payment: Record<string, unknown>,
    nowMs: number,
  ) {
    await this.env.DB.prepare(
      `UPDATE market_checkout_sessions
          SET payment_status = 'paid',
              payment_summary = ?,
              updated_at_ms = ?
        WHERE id = ?`,
    )
      .bind(JSON.stringify(payment), nowMs, checkoutId)
      .run();
  }

  private async upsertParentPayment(input: {
    session: MarketCheckoutSessionRow;
    payment: Record<string, unknown> & {
      parentPayment?: {
        paymentId: string;
        provider: string;
        splitMode: string;
        idempotencyKey: string;
        childPaymentIds: string[];
      };
      totalAmountCents?: number;
      paidAmountCents?: number;
      refundedAmountCents?: number;
      currency?: string;
      country?: string;
      settlement?: unknown;
    };
    registerId: string;
    shiftId: string;
    paymentMethod: MarketCheckoutPaymentMethod;
    nowMs: number;
  }) {
    const parentPayment = input.payment.parentPayment;
    if (!parentPayment) return;

    await this.env.DB.prepare(
      `INSERT INTO market_checkout_payments (
          payment_id, checkout_id, market_id, provider, split_mode,
          idempotency_key, status, amount_cents, paid_amount_cents,
          refunded_amount_cents, currency, country_code, child_payment_ids,
          provider_payload, created_at_ms, updated_at_ms, completed_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(payment_id) DO UPDATE SET
          provider = excluded.provider,
          split_mode = excluded.split_mode,
          idempotency_key = excluded.idempotency_key,
          status = excluded.status,
          amount_cents = excluded.amount_cents,
          paid_amount_cents = excluded.paid_amount_cents,
          refunded_amount_cents = excluded.refunded_amount_cents,
          currency = excluded.currency,
          country_code = excluded.country_code,
          child_payment_ids = excluded.child_payment_ids,
          provider_payload = excluded.provider_payload,
          updated_at_ms = excluded.updated_at_ms,
          completed_at_ms = COALESCE(market_checkout_payments.completed_at_ms, excluded.completed_at_ms)`,
    )
      .bind(
        parentPayment.paymentId,
        input.session.id,
        input.session.market_id,
        parentPayment.provider,
        parentPayment.splitMode,
        parentPayment.idempotencyKey,
        input.payment.totalAmountCents ?? 0,
        input.payment.paidAmountCents ?? 0,
        input.payment.refundedAmountCents ?? 0,
        input.payment.currency ?? null,
        input.payment.country ?? null,
        JSON.stringify(parentPayment.childPaymentIds),
        JSON.stringify({
          source: "pos_market_checkout",
          paymentMethod: input.paymentMethod,
          registerId: input.registerId,
          shiftId: input.shiftId,
          settlement: input.payment.settlement ?? null,
        }),
        input.nowMs,
        input.nowMs,
        input.nowMs,
      )
      .run();
  }

  private async recordPOSSale(input: {
    checkoutId: string;
    registerId: string;
    shiftId: string;
    operatorId: number;
    paymentMethod: MarketCheckoutPaymentMethod;
    amountCents: number;
    nowMs: number;
  }) {
    const amount = input.amountCents / 100;
    const methodColumn = posShiftMethodColumn(input.paymentMethod);
    await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE cash_shifts
            SET total_sales = total_sales + ?,
                total_sales_cents = COALESCE(total_sales_cents, 0) + ?,
                ${methodColumn.amountColumn} = ${methodColumn.amountColumn} + ?,
                ${methodColumn.centsColumn} = COALESCE(${methodColumn.centsColumn}, 0) + ?,
                total_transactions = total_transactions + 1
          WHERE id = ?`,
      ).bind(
        amount,
        input.amountCents,
        amount,
        input.amountCents,
        input.shiftId,
      ),
      this.env.DB.prepare(
        `INSERT INTO cash_movements (
            id, shift_id, register_id, type, amount, amount_cents,
            description, reference_id, reference_type, payment_method,
            denomination_breakdown, recorded_by, approval_status, metadata,
            created_at_ms
          ) VALUES (?, ?, ?, 'sale', ?, ?, ?, NULL, 'market_checkout', ?, '{}', ?, 'approved', ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        input.shiftId,
        input.registerId,
        amount,
        input.amountCents,
        `Market checkout ${input.checkoutId} POS payment`,
        input.paymentMethod,
        input.operatorId,
        JSON.stringify({ marketCheckoutId: input.checkoutId }),
        input.nowMs,
      ),
    ]);
  }

  private buildResponseCheckout(
    session: MarketCheckoutSessionRow,
    children: MarketCheckoutChildOrderRow[],
    payment: unknown,
  ) {
    return {
      id: session.id,
      market: {
        id: session.market_id,
        slug: session.market_slug,
        name: session.market_name,
        platformFeeRateBps: session.platform_fee_rate_bps ?? undefined,
      },
      status: "submitted",
      childOrders: children.map((child) => ({
        restaurantId: child.restaurant_id,
        restaurantName: child.restaurant_name,
        orderId: child.order_id,
        orderNumber: child.order_number,
        totalAmount: child.total_amount,
        totalAmountCents: orderChildTotalCents(child),
      })),
      payment: parseJsonObject(payment),
      subtotal: session.subtotal_cents,
      createdAt: new Date(session.created_at_ms).toISOString(),
    };
  }

  private async updateCachedSession(checkoutId: string, checkout: unknown) {
    const key = `market_checkout:${checkoutId}`;
    const stored = await this.env.CACHE_KV.get(key);
    if (!stored) return;

    const previous = JSON.parse(stored) as Record<string, unknown>;
    await this.env.CACHE_KV.put(
      key,
      JSON.stringify({ ...previous, ...(checkout as Record<string, unknown>) }),
      { expirationTtl: 4 * 60 * 60 },
    );
  }

  private async updateCachedIndex(checkoutId: string) {
    const stored = await this.env.CACHE_KV.get("market_checkout:index");
    if (!stored) return;

    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return;

    const nextIndex = parsed.map((item) => {
      if (!item || typeof item !== "object") return item;
      const checkout = item as Record<string, unknown>;
      if (checkout.id !== checkoutId) return item;
      return {
        ...checkout,
        paymentStatus: "paid",
        updatedAt: new Date().toISOString(),
      };
    });
    await this.env.CACHE_KV.put(
      "market_checkout:index",
      JSON.stringify(nextIndex),
      {
        expirationTtl: 4 * 60 * 60,
      },
    );
  }
}

function orderChildTotalCents(child: {
  total_amount: number;
  total_amount_cents?: number | null;
}) {
  return Number(
    child.total_amount_cents ??
      Math.round(Number(child.total_amount ?? 0) * 100),
  );
}

function buildSettlement(
  session: MarketCheckoutSessionRow,
  childPayments: Array<{
    restaurantId: string;
    restaurantName: string;
    orderId: number;
    orderNumber: string;
    amountCents: number;
  }>,
) {
  const platformFeeRateBps = clampPlatformFeeRateBps(
    session.platform_fee_rate_bps,
  );
  const vendorAllocations = childPayments.map((child) => {
    const platformFeeCents = Math.round(
      (child.amountCents * platformFeeRateBps) / 10000,
    );
    return {
      restaurantId: child.restaurantId,
      restaurantName: child.restaurantName,
      orderId: child.orderId,
      orderNumber: child.orderNumber,
      grossAmountCents: child.amountCents,
      refundedAmountCents: 0,
      platformFeeCents,
      netAmountCents: child.amountCents - platformFeeCents,
    };
  });

  return {
    platformFeeRateBps,
    platformFeeCents: vendorAllocations.reduce(
      (sum, allocation) => sum + allocation.platformFeeCents,
      0,
    ),
    vendorNetAmountCents: vendorAllocations.reduce(
      (sum, allocation) => sum + allocation.netAmountCents,
      0,
    ),
    vendorAllocations,
  };
}

function clampPlatformFeeRateBps(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(10000, Math.max(0, Math.trunc(value)));
}

function parseJsonObject(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return undefined;

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function posShiftMethodColumn(paymentMethod: MarketCheckoutPaymentMethod) {
  if (paymentMethod === "cash") {
    return { amountColumn: "cash_sales", centsColumn: "cash_sales_cents" };
  }
  if (paymentMethod === "card") {
    return { amountColumn: "card_sales", centsColumn: "card_sales_cents" };
  }
  return {
    amountColumn: "digital_sales",
    centsColumn: "digital_sales_cents",
  };
}
