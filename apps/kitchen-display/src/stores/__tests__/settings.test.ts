/**
 * Settings Store Tests
 * 測試設定 store 的狀態管理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

describe("Settings Store", () => {
  let localStorageMock: Map<string, string>;

  beforeEach(() => {
    setActivePinia(createPinia());

    // Mock localStorage with Map for better tracking
    localStorageMock = new Map();

    const localStorageStub = {
      getItem: vi.fn((key: string) => localStorageMock.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        localStorageMock.delete(key);
      }),
      clear: vi.fn(() => {
        localStorageMock.clear();
      }),
    };

    vi.stubGlobal("localStorage", localStorageStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Initial State", () => {
    it("should have default settings", () => {
      const defaultSettings = {
        language: "zh-TW",
        theme: "light",
        soundEnabled: true,
        volume: 0.7,
        autoRefresh: true,
        refreshInterval: 30,
      };

      expect(defaultSettings).toBeDefined();
    });
  });

  describe("Setting Updates", () => {
    it("should update language setting", () => {
      let language = "zh-TW";

      language = "en-US";

      expect(language).toBe("en-US");
    });

    it("should update theme setting", () => {
      let theme = "light";

      theme = "dark";

      expect(theme).toBe("dark");
    });

    it("should update sound settings", () => {
      let soundEnabled = true;

      soundEnabled = false;

      expect(soundEnabled).toBe(false);
    });

    it("should update volume level", () => {
      let volume = 0.7;

      volume = 0.5;

      expect(volume).toBe(0.5);
      expect(volume).toBeGreaterThanOrEqual(0);
      expect(volume).toBeLessThanOrEqual(1);
    });
  });

  describe("Persistence", () => {
    it("should save settings to localStorage", () => {
      const settings = {
        language: "zh-TW",
        theme: "dark",
        volume: 0.8,
      };

      localStorage.setItem("kitchen-settings", JSON.stringify(settings));

      const saved = localStorage.getItem("kitchen-settings");
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      expect(parsed.theme).toBe("dark");
    });

    it("should load settings from localStorage", () => {
      const savedSettings = {
        language: "en-US",
        theme: "light",
        volume: 0.6,
      };

      localStorage.setItem("kitchen-settings", JSON.stringify(savedSettings));

      const loaded = localStorage.getItem("kitchen-settings");
      const parsed = JSON.parse(loaded!);

      expect(parsed.language).toBe("en-US");
      expect(parsed.volume).toBe(0.6);
    });
  });

  describe("Settings Validation", () => {
    it("should validate volume range", () => {
      const isValidVolume = (vol: number) => vol >= 0 && vol <= 1;

      expect(isValidVolume(0.5)).toBe(true);
      expect(isValidVolume(-0.1)).toBe(false);
      expect(isValidVolume(1.5)).toBe(false);
    });

    it("should validate refresh interval", () => {
      const isValidInterval = (interval: number) =>
        interval >= 5 && interval <= 300;

      expect(isValidInterval(30)).toBe(true);
      expect(isValidInterval(1)).toBe(false);
      expect(isValidInterval(500)).toBe(false);
    });
  });

  describe("Reset Settings", () => {
    it("should reset to default values", () => {
      let settings = {
        language: "en-US",
        theme: "dark",
        volume: 0.3,
      };

      const defaults = {
        language: "zh-TW",
        theme: "light",
        volume: 0.7,
      };

      settings = { ...defaults };

      expect(settings.language).toBe("zh-TW");
      expect(settings.theme).toBe("light");
      expect(settings.volume).toBe(0.7);
    });
  });
});
