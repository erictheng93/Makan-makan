/**
 * Tests for static message loader
 * Validates that locale messages are properly structured and complete
 */
import { describe, it, expect } from "vitest";
import {
  getCustomerMessages,
  getAdminMessages,
} from "../src/i18n/src/static-messages";
import { SUPPORTED_LOCALES } from "../src/i18n/src/types";

describe("getCustomerMessages", () => {
  it("returns messages for all supported locales", () => {
    const messages = getCustomerMessages();
    const locales = Object.keys(messages);

    SUPPORTED_LOCALES.forEach((locale) => {
      expect(locales).toContain(locale.code);
    });
  });

  it("each locale has non-empty messages", () => {
    const messages = getCustomerMessages();

    Object.entries(messages).forEach(([locale, msgs]) => {
      expect(Object.keys(msgs).length).toBeGreaterThan(0);
    });
  });

  it("en-US and zh-TW have matching top-level keys", () => {
    const messages = getCustomerMessages();
    const enKeys = Object.keys(messages["en-US"]).sort();
    const zhKeys = Object.keys(messages["zh-TW"]).sort();

    // They should have the same set of top-level keys
    expect(enKeys).toEqual(zhKeys);
  });

  it("all locales have the same top-level key structure as en-US", () => {
    const messages = getCustomerMessages();
    const referenceKeys = Object.keys(messages["en-US"]).sort();

    Object.entries(messages).forEach(([locale, msgs]) => {
      const keys = Object.keys(msgs).sort();
      expect(keys).toEqual(referenceKeys);
    });
  });

  it("common section exists in all locales", () => {
    const messages = getCustomerMessages();

    Object.entries(messages).forEach(([locale, msgs]) => {
      expect(msgs).toHaveProperty("common");
    });
  });
});

describe("getAdminMessages", () => {
  it("returns messages for en-US and zh-TW", () => {
    const messages = getAdminMessages();
    expect(messages).toHaveProperty("en-US");
    expect(messages).toHaveProperty("zh-TW");
  });

  it("en-US messages are non-empty", () => {
    const messages = getAdminMessages();
    expect(Object.keys(messages["en-US"]).length).toBeGreaterThan(0);
  });
});
