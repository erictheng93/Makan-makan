import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import type { CloudflareEnv } from "./base";
import {
  NotificationService,
  resolveEmailProviderName,
  type EmailProviderEnv,
} from "./NotificationService";

function buildEnv(overrides: Partial<EmailProviderEnv> = {}): EmailProviderEnv {
  return { ...overrides };
}

describe("resolveEmailProviderName", () => {
  it.each([
    [
      "uses noop without an explicit MailChannels opt-in or Resend key",
      {},
      "noop",
    ],
    [
      "defaults to Resend when its key is configured",
      { RESEND_API_KEY: "resend-key" },
      "resend",
    ],
    [
      "uses Resend when MailChannels is explicitly disabled",
      { USE_MAILCHANNELS: "false", RESEND_API_KEY: "resend-key" },
      "resend",
    ],
    [
      "uses noop when MailChannels is disabled without a Resend key",
      { USE_MAILCHANNELS: "false" },
      "noop",
    ],
    [
      "uses MailChannels only when explicitly enabled",
      { USE_MAILCHANNELS: "true", RESEND_API_KEY: "resend-key" },
      "mailchannels",
    ],
    [
      "normalizes the MailChannels opt-in before comparing it",
      { USE_MAILCHANNELS: " TRUE " },
      "mailchannels",
    ],
    // The bug this whole issue came from was an opt-*out* test
    // (`USE_MAILCHANNELS !== "false"`), which made every unset or unexpected
    // value select the dead MailChannels relay. Only the literal opt-in counts.
    [
      "treats a non-'true' flag as no opt-in rather than as an opt-out",
      { USE_MAILCHANNELS: "1", RESEND_API_KEY: "resend-key" },
      "resend",
    ],
    [
      "treats an empty flag as no opt-in",
      { USE_MAILCHANNELS: "", RESEND_API_KEY: "resend-key" },
      "resend",
    ],
  ] as const)("%s", (_description, env, expected) => {
    expect(resolveEmailProviderName(buildEnv(env))).toBe(expected);
  });

  it("exposes Resend as the production-default provider", () => {
    const service = new NotificationService(
      {} as D1Database,
      { RESEND_API_KEY: "resend-key" } as CloudflareEnv,
    );

    expect(service.emailProviderName).toBe("resend");
  });
});
