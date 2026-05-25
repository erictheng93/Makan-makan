import { describe, expect, it, vi } from "vitest";
import { setLocale, setLocaleMessages, t } from "./index";
import type { Messages } from "./types";

describe("kitchen i18n runtime", () => {
  it("merges locale messages without exposing prototype-pollution keys", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const maliciousMessages = JSON.parse(`{
      "history": { "title": "History" },
      "__proto__": { "polluted": "yes" },
      "constructor": { "prototype": { "polluted": "yes" } }
    }`) as Messages;

    setLocaleMessages("en-US", maliciousMessages);
    setLocale("en-US");

    expect(t("history.title")).toBe("History");
    expect(t("__proto__.polluted")).toBe("__proto__.polluted");
    expect(t("constructor.prototype.polluted")).toBe(
      "constructor.prototype.polluted",
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
