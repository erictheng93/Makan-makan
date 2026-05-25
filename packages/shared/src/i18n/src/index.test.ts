import { describe, expect, it, vi } from "vitest";
import { createI18n } from "./index";

type TestLocale = "zh-TW" | "en-US";
type TestMessages = Record<string, unknown>;

const locales = [
  {
    code: "zh-TW" as const,
    name: "繁體中文",
    nativeName: "繁體中文",
    flag: "TW",
  },
  {
    code: "en-US" as const,
    name: "English",
    nativeName: "English",
    flag: "US",
  },
];

describe("createI18n runtime", () => {
  it("translates current locale, interpolates params, and falls back to zh-TW", async () => {
    const runtime = createI18n<TestLocale, TestMessages>({
      defaultLocale: "zh-TW",
      fallbackLocale: "zh-TW",
      supportedLocales: locales,
      initialMessages: {
        "zh-TW": {
          common: { save: "儲存", greeting: "你好 {name}" },
        },
      },
      loadMessages: async (locale) => ({
        common: locale === "en-US" ? { save: "Save" } : {},
      }),
    });

    await runtime.loadLocaleMessages("en-US");
    runtime.setLocale("en-US");

    expect(runtime.t("common.save")).toBe("Save");
    expect(runtime.t("common.greeting", { name: "Eric" })).toBe("你好 Eric");
  });

  it("rejects unsafe merge keys when adding locale messages", () => {
    const runtime = createI18n<TestLocale, TestMessages>({
      defaultLocale: "zh-TW",
      fallbackLocale: "zh-TW",
      supportedLocales: locales,
      initialMessages: { "zh-TW": {} },
      loadMessages: async () => ({}),
    });

    runtime.setLocaleMessages("en-US", {
      safe: "ok",
      __proto__: { polluted: true },
      constructor: { prototype: { polluted: true } },
    } as TestMessages);
    runtime.setLocale("en-US");

    expect(runtime.t("safe")).toBe("ok");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("uses a configurable storage key and migrates legacy locale values", async () => {
    const store = new Map<string, string>([["locale", "en-US"]]);
    const localStorageMock = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
    };

    const runtime = createI18n<TestLocale, TestMessages>({
      defaultLocale: "zh-TW",
      fallbackLocale: "zh-TW",
      storageKey: "makanmakan_locale",
      legacyStorageKeys: ["locale"],
      supportedLocales: locales,
      initialMessages: { "zh-TW": {}, "en-US": { ready: "Ready" } },
      loadMessages: async () => ({}),
      storage: localStorageMock,
      getBrowserLocale: () => "zh-TW",
    });

    await runtime.initI18n();

    expect(runtime.useI18n().locale.value).toBe("en-US");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "makanmakan_locale",
      "en-US",
    );
  });

  it("falls back when locale storage is unavailable", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const runtime = createI18n<TestLocale, TestMessages>({
        defaultLocale: "zh-TW",
        fallbackLocale: "zh-TW",
        supportedLocales: locales,
        initialMessages: { "zh-TW": { ready: "就緒" } },
        loadMessages: async () => ({}),
        storage: {
          getItem: vi.fn(() => {
            throw new Error("storage disabled");
          }),
          setItem: vi.fn(() => {
            throw new Error("storage disabled");
          }),
        },
        getBrowserLocale: () => "zh-TW",
      });

      await expect(runtime.initI18n()).resolves.toBeUndefined();
      expect(runtime.t("ready")).toBe("就緒");
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to read locale from storage:",
        expect.any(Error),
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
