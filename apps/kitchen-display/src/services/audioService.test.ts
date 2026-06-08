import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("howler", () => ({
  Howl: vi.fn(function HowlMock() {
    return {
      once: vi.fn((event: string, callback: () => void) => {
        if (event === "end") {
          setTimeout(callback, 0);
        }
      }),
      play: vi.fn(),
      stop: vi.fn(),
      volume: vi.fn(),
    };
  }),
}));

describe("audioService browser playback observability", () => {
  beforeEach(() => {
    vi.resetModules();
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
});
