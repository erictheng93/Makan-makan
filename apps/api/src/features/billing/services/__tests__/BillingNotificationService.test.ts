import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BILLING_NOTIFICATION_KINDS,
  BillingReminderService,
  BillingNotificationService,
  NOTIFICATION_CHANNELS,
} from "../BillingNotificationService";
import type { Env } from "../../../../types/env";

function createDb(firstResult: unknown = null) {
  const first = vi.fn().mockResolvedValue(firstResult);
  const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const bind = vi.fn(() => ({ first, run }));
  const prepare = vi.fn(() => ({ bind }));
  return { db: { prepare } as unknown as Env["DB"], bind, first, run };
}

describe("BillingNotificationService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records provider-unconfigured email dispatches", async () => {
    const { db, bind, run } = createDb();
    const service = new BillingNotificationService({
      DB: db,
    } as unknown as Env);

    const result = await service.send({
      restaurantId: "rest-1",
      kind: BILLING_NOTIFICATION_KINDS.TRIAL_3D,
      dedupKey: "trial_3d:rest-1",
      channel: NOTIFICATION_CHANNELS.EMAIL,
      recipient: "owner@example.com",
      text: "Trial ends soon",
    });

    expect(result.status).toBe("skipped_provider_unconfigured");
    expect(run).toHaveBeenCalledOnce();
    expect(bind).toHaveBeenLastCalledWith(
      expect.any(String),
      "rest-1",
      "trial_3d",
      "trial_3d:rest-1",
      "email",
      "skipped_provider_unconfigured",
      "owner@example.com",
      null,
      null,
      null,
      expect.any(Number),
    );
  });

  it.each([
    BILLING_NOTIFICATION_KINDS.QUOTA_HARD,
    BILLING_NOTIFICATION_KINDS.TRIAL_3D,
    BILLING_NOTIFICATION_KINDS.TRIAL_1D,
    BILLING_NOTIFICATION_KINDS.TRIAL_0D,
    BILLING_NOTIFICATION_KINDS.PAYMENT_FAILED,
    BILLING_NOTIFICATION_KINDS.GRACE_PERIOD_START,
    BILLING_NOTIFICATION_KINDS.ACCOUNT_SUSPENDED,
    BILLING_NOTIFICATION_KINDS.CYCLE_CLOSED,
  ])("records %s notification dispatches end to end", async (kind) => {
    const { db, bind } = createDb();
    const service = new BillingNotificationService({
      DB: db,
    } as unknown as Env);

    const result = await service.send({
      restaurantId: "rest-1",
      kind,
      dedupKey: `${kind}:rest-1`,
      channel: NOTIFICATION_CHANNELS.EMAIL,
      recipient: "owner@example.com",
      text: `${kind} notice`,
      payload: { kind },
    });

    expect(result).toMatchObject({
      status: "skipped_provider_unconfigured",
      duplicate: false,
    });
    expect(bind).toHaveBeenLastCalledWith(
      expect.any(String),
      "rest-1",
      kind,
      `${kind}:rest-1`,
      "email",
      "skipped_provider_unconfigured",
      "owner@example.com",
      null,
      null,
      JSON.stringify({ kind }),
      expect.any(Number),
    );
  });

  it("sends configured Slack notifications once per dedup key", async () => {
    const { db, bind } = createDb();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const service = new BillingNotificationService({
      DB: db,
      SLACK_WEBHOOK_URL: "https://hooks.slack.test/billing",
    } as unknown as Env);

    const result = await service.send({
      restaurantId: "rest-1",
      kind: BILLING_NOTIFICATION_KINDS.PAYMENT_FAILED,
      dedupKey: "payment_failed:event-1",
      channel: NOTIFICATION_CHANNELS.SLACK,
      text: "Payment failed",
    });

    expect(result).toEqual({ status: "sent", duplicate: false });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.test/billing",
      expect.objectContaining({ method: "POST" }),
    );
    expect(bind).toHaveBeenLastCalledWith(
      expect.any(String),
      "rest-1",
      "payment_failed",
      "payment_failed:event-1",
      "slack",
      "sent",
      null,
      null,
      null,
      null,
      expect.any(Number),
    );
  });

  it("sends configured email notifications through Resend", async () => {
    const { db, bind } = createDb();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "email_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = new BillingNotificationService({
      DB: db,
      RESEND_API_KEY: "resend-key",
      BILLING_EMAIL_FROM: "billing@makanmasak.app",
    } as unknown as Env);

    const result = await service.send({
      restaurantId: "rest-1",
      kind: BILLING_NOTIFICATION_KINDS.PAYMENT_FAILED,
      dedupKey: "payment_failed:event-1",
      channel: NOTIFICATION_CHANNELS.EMAIL,
      recipient: "owner@example.com",
      subject: "Payment failed",
      text: "Payment failed",
    });

    expect(result).toEqual({ status: "sent", duplicate: false });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer resend-key",
        }),
      }),
    );
    expect(bind).toHaveBeenLastCalledWith(
      expect.any(String),
      "rest-1",
      "payment_failed",
      "payment_failed:event-1",
      "email",
      "sent",
      "owner@example.com",
      "email_1",
      null,
      null,
      expect.any(Number),
    );
  });

  it("dispatches trial ending reminders through the email channel", async () => {
    const first = vi.fn().mockResolvedValue(null);
    const all = vi.fn().mockResolvedValue({
      results: [
        {
          restaurant_id: "rest-1",
          restaurant_name: "Demo Shop",
          email: "owner@example.com",
          trial_ends_at_ms: 4_000,
        },
      ],
    });
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const bind = vi.fn(() => ({ all, first, run }));
    const prepare = vi.fn(() => ({ bind }));
    const env = { DB: { prepare } } as unknown as Env;

    const result = await new BillingReminderService(
      env,
    ).sendTrialEndingReminders(1_000 - 3 * 24 * 60 * 60 * 1000);

    expect(result).toEqual({ attempted: 2 });
    expect(bind).toHaveBeenCalledWith(
      expect.any(String),
      "rest-1",
      "trial_3d",
      "trial_3d:rest-1:4000",
      "email",
      "skipped_provider_unconfigured",
      "owner@example.com",
      null,
      null,
      expect.stringContaining('"trialEndsAt":4000'),
      expect.any(Number),
    );
    expect(bind).toHaveBeenLastCalledWith(
      expect.any(String),
      "rest-1",
      "trial_1d",
      "trial_1d:rest-1:4000",
      "email",
      "skipped_provider_unconfigured",
      "owner@example.com",
      null,
      null,
      expect.stringContaining('"trialEndsAt":4000'),
      expect.any(Number),
    );
  });
});
