import { beforeEach, describe, expect, it, vi } from "vitest";

const howlMocks = vi.hoisted(() => ({
  instances: [] as Array<{
    once: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    volume: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("howler", () => ({
  Howl: vi.fn(function HowlMock() {
    const instance = {
      once: vi.fn((event: string, callback: () => void) => {
        if (event === "end") {
          setTimeout(callback, 0);
        }
      }),
      play: vi.fn(),
      stop: vi.fn(),
      volume: vi.fn(),
    };
    howlMocks.instances.push(instance);
    return instance;
  }),
}));

describe("audioService browser playback observability", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    howlMocks.instances.length = 0;
    localStorage.clear();
    (
      window as Window & {
        __kitchenAudioPlayRequests?: unknown[];
      }
    ).__kitchenAudioPlayRequests = [];
  });

  it("records enabled new-order playback requests for browser workflow tests", async () => {
    const { audioService } = await import("./audioService");

    await audioService.playNewOrder(false);

    expect(
      (
        window as Window & {
          __kitchenAudioPlayRequests?: Array<{ type?: string }>;
        }
      ).__kitchenAudioPlayRequests,
    ).toEqual([
      expect.objectContaining({
        type: "newOrder",
        priority: "high",
        repeat: 1,
      }),
    ]);
  });

  it("does not record playback requests when audio is disabled", async () => {
    const { audioService } = await import("./audioService");

    audioService.disable();
    await audioService.playNewOrder(false);

    expect(
      (
        window as Window & {
          __kitchenAudioPlayRequests?: unknown[];
        }
      ).__kitchenAudioPlayRequests,
    ).toEqual([]);
  });

  it("loads saved settings and maps convenience methods to expected sounds", async () => {
    localStorage.setItem(
      "kitchen-audio-settings",
      JSON.stringify({
        masterVolume: 0.5,
        enabled: true,
      }),
    );

    const { audioService } = await import("./audioService");

    await audioService.playNewOrder(true);
    await audioService.playOrderReady();
    await audioService.playOrderComplete();
    await audioService.playWarning();
    await audioService.playSuccess();
    await audioService.playError();

    const requests = (
      window as Window & {
        __kitchenAudioPlayRequests?: Array<{ type?: string; repeat?: number }>;
      }
    ).__kitchenAudioPlayRequests;
    expect(requests).toEqual([
      expect.objectContaining({ type: "orderUrgent", repeat: 3 }),
      expect.objectContaining({ type: "orderReady", repeat: 2 }),
      expect.objectContaining({ type: "orderComplete" }),
      expect.objectContaining({ type: "warning", repeat: 2 }),
      expect.objectContaining({ type: "success" }),
      expect.objectContaining({ type: "error", repeat: 2 }),
    ]);
  });

  it("persists settings, clamps master volume, and updates Howl volumes", async () => {
    const { audioService } = await import("./audioService");

    audioService.updateSettings({ masterVolume: 0.25 });
    expect(
      JSON.parse(localStorage.getItem("kitchen-audio-settings")!),
    ).toMatchObject({ masterVolume: 0.25 });

    audioService.setMasterVolume(2);
    expect(audioService.getSettings().masterVolume).toBe(1);
    expect(
      howlMocks.instances.every((sound) => sound.volume.mock.calls.length),
    ).toBe(true);

    audioService.setMasterVolume(-1);
    expect(audioService.getSettings().masterVolume).toBe(0);
  });

  it("stops all sounds when disabled", async () => {
    const { audioService } = await import("./audioService");

    audioService.disable();

    expect(audioService.getSettings().enabled).toBe(false);
    expect(
      howlMocks.instances.every((sound) => sound.stop.mock.calls.length),
    ).toBe(true);
  });

  it("runs test sound helpers through the normal playback path", async () => {
    const { audioService } = await import("./audioService");

    await audioService.testSound("bell");

    expect(
      (
        window as Window & {
          __kitchenAudioPlayRequests?: Array<{ type?: string }>;
        }
      ).__kitchenAudioPlayRequests,
    ).toEqual([expect.objectContaining({ type: "bell" })]);
  });
});
