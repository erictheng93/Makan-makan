import { drizzle } from "drizzle-orm/d1";
import { and, eq, gte, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  creditAccounts,
  creditCards,
  creditLedgerEntries,
  type CreditEntryType,
} from "@makanmakan/database";
import type { Env } from "../../../types/env";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized,
} from "../../../shared/utils/api-error";

// Spends strictly above this amount require a PIN ((b) 門檻式 PIN). Override via env.
const DEFAULT_CREDIT_PIN_THRESHOLD_CENTS = 20000;
const MAX_PIN_RETRIES = 5;
const PIN_LOCK_MS = 15 * 60 * 1000; // lock card for 15 min after repeated PIN failures
const CREDIT_ROLLING_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000; // activity extends expiry 1 year
const BCRYPT_COST = 10; // matches repo convention (customer OTP hashing)

export interface IssueCardInput {
  currency: string;
  ownerCustomerId?: string;
  /** Optional PIN; required later for spends above the threshold. */
  pin?: string;
  initialBalanceCents?: number;
}

export interface IssueCardResult {
  cardId: string;
  publicId: string;
  accountId: string;
  currency: string;
}

export interface CreditBalance {
  publicId: string;
  accountId: string;
  currency: string;
  balanceCents: number;
  status: string;
  cardStatus: string;
  expiresAtMs: number | null;
}

export interface SpendInput {
  publicId: string;
  amountCents: number;
  currency: string;
  /** Stable per logical operation — replays return the prior ledger entry, never double-spend. */
  idempotencyKey: string;
  sourceType: string;
  sourceId?: string;
  marketCheckoutPaymentId?: string;
  pin?: string;
}

export interface TopupInput {
  publicId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  sourceType: string;
  sourceId?: string;
}

export interface RefundInput {
  /** Account to credit back. */
  accountId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  sourceType: string;
  sourceId?: string;
  marketCheckoutPaymentId?: string;
}

export interface LedgerMovementResult {
  ledgerEntryId: string;
  accountId: string;
  balanceAfterCents: number;
}

type CreditAccountRow = typeof creditAccounts.$inferSelect;
type CreditCardRow = typeof creditCards.$inferSelect;

/**
 * Stored-value credits (代幣) ledger service.
 *
 * Money-safety is enforced by a single conditional UPDATE with a balance guard
 * (`balance_cents >= :amount`) — atomic on D1, so concurrent spends on the same
 * balance cannot overspend and cannot double-spend (proven against real D1).
 * `idempotency_key` UNIQUE on the ledger makes every movement replay-safe; a
 * lost race compensates by reversing the duplicate deduction.
 */
export class CreditService {
  private readonly db: ReturnType<typeof drizzle>;
  private readonly pinThresholdCents: number;

  constructor(private readonly env: Env) {
    this.db = drizzle(env.DB);
    const parsed = Number(env.CREDIT_PIN_THRESHOLD_CENTS);
    this.pinThresholdCents =
      Number.isFinite(parsed) && parsed >= 0
        ? parsed
        : DEFAULT_CREDIT_PIN_THRESHOLD_CENTS;
  }

  async issueCard(input: IssueCardInput): Promise<IssueCardResult> {
    if (
      input.initialBalanceCents !== undefined &&
      input.initialBalanceCents < 0
    ) {
      throw badRequest("Initial balance cannot be negative");
    }
    const secretHash = input.pin
      ? await bcrypt.hash(input.pin, BCRYPT_COST)
      : null;
    const expiresAt = new Date(Date.now() + CREDIT_ROLLING_EXPIRY_MS);

    const [account] = await this.db
      .insert(creditAccounts)
      .values({
        ownerCustomerId: input.ownerCustomerId ?? null,
        currency: input.currency,
        balanceCents: input.initialBalanceCents ?? 0,
        expiresAtMs: expiresAt,
      })
      .returning();

    const publicId = crypto.randomUUID();
    const [card] = await this.db
      .insert(creditCards)
      .values({
        accountId: account.id,
        publicId,
        secretHash,
      })
      .returning();

    return {
      cardId: card.id,
      publicId: card.publicId,
      accountId: account.id,
      currency: account.currency,
    };
  }

  async getBalance(publicId: string): Promise<CreditBalance> {
    const { card, account } = await this.loadCardAndAccount(publicId);
    return {
      publicId: card.publicId,
      accountId: account.id,
      currency: account.currency,
      balanceCents: account.balanceCents,
      status: account.status,
      cardStatus: card.status,
      expiresAtMs: account.expiresAtMs ? account.expiresAtMs.getTime() : null,
    };
  }

  /**
   * Deduct `amountCents` from the card's account in full (no partial spend).
   * Throws `INSUFFICIENT_BALANCE` (409) when the balance cannot cover it.
   */
  async spend(input: SpendInput): Promise<LedgerMovementResult> {
    if (input.amountCents <= 0) {
      throw badRequest("Spend amount must be positive");
    }

    // Replay safety: a prior identical operation returns its recorded result.
    const existing = await this.findLedgerByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) {
      return {
        ledgerEntryId: existing.id,
        accountId: existing.accountId,
        balanceAfterCents: existing.balanceAfterCents,
      };
    }

    const { card, account } = await this.loadCardAndAccount(input.publicId);
    if (account.status !== "active") {
      throw forbidden(
        "Credit account is not active",
        "CREDIT_ACCOUNT_INACTIVE",
      );
    }
    if (account.currency !== input.currency) {
      throw badRequest(
        "Credit currency does not match checkout currency",
        "CREDIT_CURRENCY_MISMATCH",
      );
    }
    await this.assertPinIfRequired(card, input.amountCents, input.pin);

    // Atomic guarded deduction. The balance guard prevents overspend AND
    // serialises concurrent spends — a losing concurrent spend matches 0 rows.
    const expiresAt = new Date(Date.now() + CREDIT_ROLLING_EXPIRY_MS);
    const deducted = await this.db
      .update(creditAccounts)
      .set({
        balanceCents: sql`${creditAccounts.balanceCents} - ${input.amountCents}`,
        version: sql`${creditAccounts.version} + 1`,
        expiresAtMs: expiresAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(creditAccounts.id, account.id),
          eq(creditAccounts.currency, input.currency),
          eq(creditAccounts.status, "active"),
          gte(creditAccounts.balanceCents, input.amountCents),
        ),
      )
      .returning({ balanceAfter: creditAccounts.balanceCents });

    if (deducted.length === 0) {
      throw conflict("Insufficient credit balance", "INSUFFICIENT_BALANCE");
    }
    const balanceAfterCents = deducted[0].balanceAfter;

    return this.appendLedgerOrCompensate({
      accountId: account.id,
      entryType: "spend",
      amountCents: -input.amountCents,
      balanceAfterCents,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      marketCheckoutPaymentId: input.marketCheckoutPaymentId,
      // Compensation if a concurrent twin already recorded this exact key:
      // reverse our duplicate deduction (credit it back).
      reverseAmountCents: input.amountCents,
    });
  }

  async topup(input: TopupInput): Promise<LedgerMovementResult> {
    if (input.amountCents <= 0) {
      throw badRequest("Top-up amount must be positive");
    }
    const existing = await this.findLedgerByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) {
      return {
        ledgerEntryId: existing.id,
        accountId: existing.accountId,
        balanceAfterCents: existing.balanceAfterCents,
      };
    }

    const { account } = await this.loadCardAndAccount(input.publicId);
    if (account.currency !== input.currency) {
      throw badRequest(
        "Credit currency does not match top-up currency",
        "CREDIT_CURRENCY_MISMATCH",
      );
    }

    const balanceAfterCents = await this.applyDelta(
      account.id,
      input.amountCents,
    );
    return this.appendLedgerOrCompensate({
      accountId: account.id,
      entryType: "topup",
      amountCents: input.amountCents,
      balanceAfterCents,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      reverseAmountCents: -input.amountCents,
    });
  }

  /** Credit an amount back to an account (e.g. market-checkout refund). */
  async refund(input: RefundInput): Promise<LedgerMovementResult> {
    if (input.amountCents <= 0) {
      throw badRequest("Refund amount must be positive");
    }
    const existing = await this.findLedgerByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) {
      return {
        ledgerEntryId: existing.id,
        accountId: existing.accountId,
        balanceAfterCents: existing.balanceAfterCents,
      };
    }

    const account = await this.db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.id, input.accountId))
      .get();
    if (!account) {
      throw notFound("Credit account not found", "CREDIT_ACCOUNT_NOT_FOUND");
    }
    if (account.currency !== input.currency) {
      throw badRequest(
        "Credit currency does not match refund currency",
        "CREDIT_CURRENCY_MISMATCH",
      );
    }

    const balanceAfterCents = await this.applyDelta(
      account.id,
      input.amountCents,
    );
    return this.appendLedgerOrCompensate({
      accountId: account.id,
      entryType: "refund",
      amountCents: input.amountCents,
      balanceAfterCents,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      marketCheckoutPaymentId: input.marketCheckoutPaymentId,
      reverseAmountCents: -input.amountCents,
    });
  }

  /**
   * Refund a prior credit spend by its idempotency key — resolves the account
   * from the original spend ledger entry, then credits it back.
   */
  async refundByOriginalSpend(input: {
    spendIdempotencyKey: string;
    refundIdempotencyKey: string;
    amountCents: number;
    currency: string;
    sourceType: string;
    sourceId?: string;
    marketCheckoutPaymentId?: string;
  }): Promise<LedgerMovementResult> {
    const spend = await this.findLedgerByIdempotencyKey(
      input.spendIdempotencyKey,
    );
    if (!spend) {
      throw notFound(
        "Original credit spend not found for refund",
        "CREDIT_SPEND_NOT_FOUND",
      );
    }
    return this.refund({
      accountId: spend.accountId,
      amountCents: input.amountCents,
      currency: input.currency,
      idempotencyKey: input.refundIdempotencyKey,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      marketCheckoutPaymentId: input.marketCheckoutPaymentId,
    });
  }

  // ---- internals -----------------------------------------------------------

  private async loadCardAndAccount(
    publicId: string,
  ): Promise<{ card: CreditCardRow; account: CreditAccountRow }> {
    const card = await this.db
      .select()
      .from(creditCards)
      .where(eq(creditCards.publicId, publicId))
      .get();
    if (!card) {
      throw notFound("Credit card not found", "CREDIT_CARD_NOT_FOUND");
    }
    const account = await this.db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.id, card.accountId))
      .get();
    if (!account) {
      throw notFound("Credit account not found", "CREDIT_ACCOUNT_NOT_FOUND");
    }
    return { card, account };
  }

  private async assertPinIfRequired(
    card: CreditCardRow,
    amountCents: number,
    pin: string | undefined,
  ): Promise<void> {
    if (card.status !== "active") {
      throw forbidden("Credit card is not active", "CREDIT_CARD_INACTIVE");
    }
    if (amountCents <= this.pinThresholdCents) {
      return; // small amount — PIN not required
    }
    if (!card.secretHash) {
      throw forbidden(
        "This amount requires a PIN but the card has none set",
        "CREDIT_PIN_NOT_SET",
      );
    }
    const now = Date.now();
    if (card.lockedUntilMs && card.lockedUntilMs.getTime() > now) {
      throw forbidden(
        "Credit card is temporarily locked",
        "CREDIT_CARD_LOCKED",
      );
    }
    if (!pin) {
      throw unauthorized("PIN required for this amount", "CREDIT_PIN_REQUIRED");
    }

    const valid = await bcrypt.compare(pin, card.secretHash);
    if (!valid) {
      const nextCount = (card.pinRetryCount ?? 0) + 1;
      const lock = nextCount >= MAX_PIN_RETRIES;
      await this.db
        .update(creditCards)
        .set({
          pinRetryCount: nextCount,
          lockedUntilMs: lock
            ? new Date(now + PIN_LOCK_MS)
            : card.lockedUntilMs,
          updatedAt: new Date(),
        })
        .where(eq(creditCards.id, card.id));
      throw unauthorized("Invalid PIN", "CREDIT_PIN_INVALID");
    }

    if ((card.pinRetryCount ?? 0) > 0 || card.lockedUntilMs) {
      await this.db
        .update(creditCards)
        .set({ pinRetryCount: 0, lockedUntilMs: null, updatedAt: new Date() })
        .where(eq(creditCards.id, card.id));
    }
  }

  /** Increment/decrement balance (used by topup/refund — increments don't need a guard). */
  private async applyDelta(
    accountId: string,
    deltaCents: number,
  ): Promise<number> {
    const expiresAt = new Date(Date.now() + CREDIT_ROLLING_EXPIRY_MS);
    const [row] = await this.db
      .update(creditAccounts)
      .set({
        balanceCents: sql`${creditAccounts.balanceCents} + ${deltaCents}`,
        version: sql`${creditAccounts.version} + 1`,
        expiresAtMs: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(creditAccounts.id, accountId))
      .returning({ balanceAfter: creditAccounts.balanceCents });
    return row.balanceAfter;
  }

  private async findLedgerByIdempotencyKey(key: string) {
    return this.db
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.idempotencyKey, key))
      .get();
  }

  /**
   * Insert the ledger entry; the UNIQUE idempotency key guards against a
   * concurrent twin. If the insert finds a conflict the balance change we just
   * made is a duplicate, so we reverse it and return the canonical entry.
   */
  private async appendLedgerOrCompensate(params: {
    accountId: string;
    entryType: CreditEntryType;
    amountCents: number;
    balanceAfterCents: number;
    currency: string;
    idempotencyKey: string;
    sourceType: string;
    sourceId?: string;
    marketCheckoutPaymentId?: string;
    reverseAmountCents: number;
  }): Promise<LedgerMovementResult> {
    const [entry] = await this.db
      .insert(creditLedgerEntries)
      .values({
        accountId: params.accountId,
        entryType: params.entryType,
        amountCents: params.amountCents,
        balanceAfterCents: params.balanceAfterCents,
        currency: params.currency,
        sourceType: params.sourceType,
        sourceId: params.sourceId ?? null,
        marketCheckoutPaymentId: params.marketCheckoutPaymentId ?? null,
        idempotencyKey: params.idempotencyKey,
      })
      .onConflictDoNothing({ target: creditLedgerEntries.idempotencyKey })
      .returning();

    if (entry) {
      return {
        ledgerEntryId: entry.id,
        accountId: params.accountId,
        balanceAfterCents: params.balanceAfterCents,
      };
    }

    // Lost the race: a twin already recorded this idempotency key. Reverse the
    // duplicate balance change and return the canonical entry.
    await this.applyDelta(params.accountId, params.reverseAmountCents);
    const canonical = await this.findLedgerByIdempotencyKey(
      params.idempotencyKey,
    );
    if (!canonical) {
      throw conflict(
        "Credit ledger conflict could not be reconciled",
        "CREDIT_LEDGER_CONFLICT",
      );
    }
    return {
      ledgerEntryId: canonical.id,
      accountId: canonical.accountId,
      balanceAfterCents: canonical.balanceAfterCents,
    };
  }
}
