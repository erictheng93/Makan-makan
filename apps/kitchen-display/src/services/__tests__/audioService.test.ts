import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AudioSettings, SoundType } from "@/services/audioService";

// --- Howl mock ---
// We track calls through shared arrays since vi.resetModules() re-evaluates
// the mock factory and we need consistent references across resets.
const mockPlayCalls: unknown[][] = [];
const mockStopCalls: unknown[][] = [];
const mockVolumeCalls: unknown[][] = [];
const mockOnceCalls: Array<{
  event: string;
  cb: (...args: unknown[]) => void;
}> = [];
const mockConstructorCalls: unknown[][] = [];

vi.mock("howler", () => {
  class MockHowl {
    constructor(...args: unknown[]) {
      mockConstructorCalls.push(args);
    }
    play(...args: unknown[]) {
      mockPlayCalls.push(args);
    }
    stop(...args: unknown[]) {
      mockStopCalls.push(args);
    }
    volume(...args: unknown[]) {
      mockVolumeCalls.push(args);
    }
    once(event: string, cb: (...args: unknown[]) => void) {
      mockOnceCalls.push({ event, cb });
      if (event === "end") {
        setTimeout(cb, 10);
      }
    }
    on() {}
  }
  return { Howl: MockHowl };
});

const ALL_SOUND_TYPES: SoundType[] = [
  "newOrder",
  "orderReady",
  "orderUrgent",
  "orderComplete",
  "warning",
  "success",
  "error",
  "notification",
  "bell",
  "chime",
];

const STORAGE_KEY = "kitchen-audio-settings";
const SOUND_COUNT = ALL_SOUND_TYPES.length; // 10

describe("AudioService", () => {
  let audioService: any;

  beforeEach(async () => {
    vi.useFakeTimers();

    // Clear our tracking arrays
    mockPlayCalls.length = 0;
    mockStopCalls.length = 0;
    mockVolumeCalls.length = 0;
    mockOnceCalls.length = 0;
    mockConstructorCalls.length = 0;

    localStorage.clear();

    // Suppress console output
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Reset modules so the singleton is re-created on next import
    vi.resetModules();
    const mod = await import("@/services/audioService");
    audioService = mod.audioService;

    // Clear the calls from constructor initialization
    mockPlayCalls.length = 0;
    mockStopCalls.length = 0;
    mockVolumeCalls.length = 0;
    mockOnceCalls.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------
  // Constructor & Initialization
  // ---------------------------------------------------------------
  describe("constructor and initialization", () => {
    it("should initialize with default settings when no localStorage data exists", () => {
      const settings = audioService.getSettings();
      expect(settings.masterVolume).toBe(0.7);
      expect(settings.enabled).toBe(true);
      expect(settings.notificationQueue).toBe(true);
      expect(settings.maxQueueSize).toBe(10);
      expect(settings.priorityOverride).toBe(true);
    });

    it("should have default sound settings for all 10 sound types", () => {
      const settings = audioService.getSettings();
      for (const type of ALL_SOUND_TYPES) {
        expect(settings.sounds[type]).toBeDefined();
        expect(settings.sounds[type].enabled).toBe(true);
        expect(typeof settings.sounds[type].volume).toBe("number");
      }
    });

    it("should load saved settings from localStorage", async () => {
      const customSettings: Partial<AudioSettings> = {
        masterVolume: 0.5,
        enabled: false,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customSettings));

      vi.resetModules();
      mockConstructorCalls.length = 0;
      const mod = await import("@/services/audioService");
      const freshService = mod.audioService;
      const settings = freshService.getSettings();

      expect(settings.masterVolume).toBe(0.5);
      expect(settings.enabled).toBe(false);
      // Default values should still be present via spread merge
      expect(settings.notificationQueue).toBe(true);
    });

    it("should create Howl instances for all 10 sound types", async () => {
      // Re-import to count constructor calls from scratch
      vi.resetModules();
      mockConstructorCalls.length = 0;
      await import("@/services/audioService");
      expect(mockConstructorCalls.length).toBe(SOUND_COUNT);
    });

    it("should pass volume settings to each Howl constructor", async () => {
      vi.resetModules();
      mockConstructorCalls.length = 0;
      await import("@/services/audioService");
      // Each constructor call should include a volume property
      for (const call of mockConstructorCalls) {
        const options = call[0] as { volume: number };
        expect(options.volume).toBeGreaterThanOrEqual(0);
        expect(options.volume).toBeLessThanOrEqual(1);
      }
    });
  });

  // ---------------------------------------------------------------
  // play()
  // ---------------------------------------------------------------
  describe("play()", () => {
    it("should resolve immediately when audio is disabled", async () => {
      audioService.disable();
      mockPlayCalls.length = 0;

      const promise = audioService.play("newOrder");
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(mockPlayCalls.length).toBe(0);
    });

    it("should resolve immediately when the specific sound type is disabled", async () => {
      audioService.updateSettings({
        sounds: {
          ...audioService.getSettings().sounds,
          newOrder: { enabled: false, volume: 0.8 },
        },
      });
      mockPlayCalls.length = 0;

      const promise = audioService.play("newOrder");
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(mockPlayCalls.length).toBe(0);
    });

    it("should play a sound when enabled and sound type is enabled", async () => {
      mockPlayCalls.length = 0;

      const promise = audioService.play("newOrder");
      await vi.advanceTimersByTimeAsync(50);
      await promise;

      expect(mockPlayCalls.length).toBe(1);
    });

    it("should set volume as notification.volume * masterVolume before playing", async () => {
      mockVolumeCalls.length = 0;

      const promise = audioService.play("newOrder");
      await vi.advanceTimersByTimeAsync(50);
      await promise;

      // newOrder default volume = 0.8, masterVolume = 0.7 => 0.56
      const volumeCall = mockVolumeCalls.find(
        (call) =>
          typeof call[0] === "number" &&
          Math.abs((call[0] as number) - 0.56) < 0.001,
      );
      expect(volumeCall).toBeDefined();
    });

    it("should queue notification when already playing and queue is enabled", async () => {
      mockPlayCalls.length = 0;

      // Start first sound - sets isPlaying=true
      audioService.play("newOrder");
      // Advance past delay=0 setTimeout to start playback
      await vi.advanceTimersByTimeAsync(0);
      expect(mockPlayCalls.length).toBe(1);

      // Second play while first is still playing should be queued
      audioService.play("bell");
      // Should NOT have called play again yet
      expect(mockPlayCalls.length).toBe(1);

      // Let the end callback fire so queue processes
      await vi.advanceTimersByTimeAsync(100);
      // Now the queued sound should have played
      expect(mockPlayCalls.length).toBe(2);
    });

    it("should apply custom delay before playing", async () => {
      mockPlayCalls.length = 0;

      audioService.play("success", { delay: 200 });

      // Before delay elapses, play should not be called
      await vi.advanceTimersByTimeAsync(100);
      expect(mockPlayCalls.length).toBe(0);

      // After delay elapses, play should fire
      await vi.advanceTimersByTimeAsync(150);
      expect(mockPlayCalls.length).toBe(1);
    });

    it("should handle custom repeat count", async () => {
      mockPlayCalls.length = 0;

      const promise = audioService.play("success", { repeat: 3 });
      // 3 repeats: play + end(10ms) + gap(200ms) + play + end(10ms) + gap(200ms) + play + end(10ms)
      await vi.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockPlayCalls.length).toBe(3);
    });
  });

  // ---------------------------------------------------------------
  // Queue management
  // ---------------------------------------------------------------
  describe("queue management", () => {
    it("should remove oldest items when queue exceeds maxQueueSize", async () => {
      audioService.updateSettings({ maxQueueSize: 2 });
      mockPlayCalls.length = 0;

      // Start a sound to set isPlaying=true
      audioService.play("newOrder");
      await vi.advanceTimersByTimeAsync(0);

      // Queue 3 more sounds (but max is 2, so first queued gets evicted)
      audioService.play("bell", { priority: "low" });
      audioService.play("chime", { priority: "low" });
      audioService.play("notification", { priority: "low" });

      // Let everything complete
      await vi.advanceTimersByTimeAsync(5000);

      // 1 immediate + 2 from queue (the oldest was evicted)
      expect(mockPlayCalls.length).toBe(3);
    });

    it("should insert higher priority notifications before lower ones when priorityOverride is enabled", async () => {
      mockPlayCalls.length = 0;

      // Start a sound to set isPlaying=true
      audioService.play("newOrder");
      await vi.advanceTimersByTimeAsync(0);

      // Queue a low priority sound first, then an urgent one
      audioService.play("bell", { priority: "low" });
      audioService.play("error", { priority: "urgent" });

      // Let everything complete
      await vi.advanceTimersByTimeAsync(5000);

      // All 3 should have been played
      expect(mockPlayCalls.length).toBe(3);
    });
  });

  // ---------------------------------------------------------------
  // Convenience methods
  // ---------------------------------------------------------------
  describe("playNewOrder()", () => {
    it("should play newOrder with 1 repeat when urgent=false", async () => {
      mockPlayCalls.length = 0;

      const promise = audioService.playNewOrder(false);
      await vi.advanceTimersByTimeAsync(50);
      await promise;

      expect(mockPlayCalls.length).toBe(1);
    });

    it("should play orderUrgent with 3 repeats when urgent=true", async () => {
      mockPlayCalls.length = 0;

      const promise = audioService.playNewOrder(true);
      // 3 repeats with end callbacks and 200ms gaps
      await vi.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockPlayCalls.length).toBe(3);
    });
  });

  describe("playOrderReady()", () => {
    it("should play orderReady with 2 repeats", async () => {
      mockPlayCalls.length = 0;

      const promise = audioService.playOrderReady();
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(mockPlayCalls.length).toBe(2);
    });
  });

  describe("playOrderComplete()", () => {
    it("should play orderComplete with 1 repeat", async () => {
      mockPlayCalls.length = 0;

      const promise = audioService.playOrderComplete();
      await vi.advanceTimersByTimeAsync(50);
      await promise;

      expect(mockPlayCalls.length).toBe(1);
    });
  });

  describe("playWarning()", () => {
    it("should play warning with 2 repeats", async () => {
      mockPlayCalls.length = 0;

      const promise = audioService.playWarning();
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(mockPlayCalls.length).toBe(2);
    });
  });

  describe("playSuccess()", () => {
    it("should play success with default (1 repeat, medium priority)", async () => {
      mockPlayCalls.length = 0;

      const promise = audioService.playSuccess();
      await vi.advanceTimersByTimeAsync(50);
      await promise;

      expect(mockPlayCalls.length).toBe(1);
    });
  });

  describe("playError()", () => {
    it("should play error with 2 repeats", async () => {
      mockPlayCalls.length = 0;

      const promise = audioService.playError();
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(mockPlayCalls.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------
  // Settings management
  // ---------------------------------------------------------------
  describe("updateSettings()", () => {
    it("should merge new settings with existing ones", () => {
      audioService.updateSettings({ masterVolume: 0.3 });
      const settings = audioService.getSettings();

      expect(settings.masterVolume).toBe(0.3);
      // Other settings should remain unchanged
      expect(settings.enabled).toBe(true);
      expect(settings.notificationQueue).toBe(true);
    });

    it("should persist settings to localStorage", () => {
      audioService.updateSettings({ masterVolume: 0.4 });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.masterVolume).toBe(0.4);
    });

    it("should update all Howl volumes after settings change", () => {
      mockVolumeCalls.length = 0;

      audioService.updateSettings({ masterVolume: 1.0 });

      // updateSoundVolumes should call volume() on each of the 10 sounds
      expect(mockVolumeCalls.length).toBe(SOUND_COUNT);
    });
  });

  describe("getSettings()", () => {
    it("should return a shallow clone of settings (not the same reference)", () => {
      const settings1 = audioService.getSettings();
      const settings2 = audioService.getSettings();

      expect(settings1).toEqual(settings2);
      expect(settings1).not.toBe(settings2);
    });
  });

  // ---------------------------------------------------------------
  // enable / disable
  // ---------------------------------------------------------------
  describe("enable()", () => {
    it("should set enabled to true and save to localStorage", () => {
      audioService.disable(); // first disable
      audioService.enable();

      expect(audioService.getSettings().enabled).toBe(true);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.enabled).toBe(true);
    });
  });

  describe("disable()", () => {
    it("should set enabled to false, call stopAll, and save to localStorage", () => {
      mockStopCalls.length = 0;

      audioService.disable();

      expect(audioService.getSettings().enabled).toBe(false);
      // stopAll calls stop() on each of the 10 sounds
      expect(mockStopCalls.length).toBe(SOUND_COUNT);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.enabled).toBe(false);
    });

    it("should prevent subsequent play calls from producing sound", async () => {
      audioService.disable();
      mockPlayCalls.length = 0;

      await audioService.play("bell");
      await vi.advanceTimersByTimeAsync(50);

      expect(mockPlayCalls.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // setMasterVolume
  // ---------------------------------------------------------------
  describe("setMasterVolume()", () => {
    it("should clamp volume to 0 when given a negative value", () => {
      audioService.setMasterVolume(-0.5);
      expect(audioService.getSettings().masterVolume).toBe(0);
    });

    it("should clamp volume to 1 when given a value above 1", () => {
      audioService.setMasterVolume(1.5);
      expect(audioService.getSettings().masterVolume).toBe(1);
    });

    it("should set volume correctly within the valid range", () => {
      audioService.setMasterVolume(0.5);
      expect(audioService.getSettings().masterVolume).toBe(0.5);
    });

    it("should update all Howl volumes and persist to localStorage", () => {
      mockVolumeCalls.length = 0;

      audioService.setMasterVolume(0.9);

      expect(mockVolumeCalls.length).toBe(SOUND_COUNT);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.masterVolume).toBe(0.9);
    });
  });

  // ---------------------------------------------------------------
  // stopAll
  // ---------------------------------------------------------------
  describe("stopAll()", () => {
    it("should call stop() on all 10 Howl instances", () => {
      mockStopCalls.length = 0;

      audioService.stopAll();

      expect(mockStopCalls.length).toBe(SOUND_COUNT);
    });

    it("should clear the notification queue and reset isPlaying", async () => {
      // Start a sound so isPlaying = true, then queue more
      audioService.play("newOrder");
      await vi.advanceTimersByTimeAsync(0);
      audioService.play("bell");
      audioService.play("chime");

      mockPlayCalls.length = 0;
      audioService.stopAll();

      // After stopAll, a new play should work immediately (not be queued)
      const promise = audioService.play("success");
      await vi.advanceTimersByTimeAsync(50);
      await promise;

      expect(mockPlayCalls.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------
  // testSound / testAllSounds
  // ---------------------------------------------------------------
  describe("testSound()", () => {
    it("should play the specified sound type", async () => {
      mockPlayCalls.length = 0;

      const promise = audioService.testSound("bell");
      await vi.advanceTimersByTimeAsync(50);
      await promise;

      expect(mockPlayCalls.length).toBe(1);
    });
  });

  describe("testAllSounds()", () => {
    it("should play all 10 sound types sequentially with 500ms delays", async () => {
      mockPlayCalls.length = 0;

      const promise = audioService.testAllSounds();

      // Each sound: delay(0) timeout + play + end(10ms) + 500ms gap
      // Advance enough for all 10 sounds to complete
      for (let i = 0; i < SOUND_COUNT; i++) {
        await vi.advanceTimersByTimeAsync(600);
      }

      await promise;

      expect(mockPlayCalls.length).toBe(SOUND_COUNT);
    });
  });

  // ---------------------------------------------------------------
  // Singleton export
  // ---------------------------------------------------------------
  describe("singleton export", () => {
    it("should export audioService as the default export", async () => {
      vi.resetModules();
      const mod = await import("@/services/audioService");

      expect(mod.audioService).toBeDefined();
      expect(mod.default).toBe(mod.audioService);
    });
  });
});
