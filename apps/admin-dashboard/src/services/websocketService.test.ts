// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocketService from "./websocketService";

const apiPost = vi.hoisted(() => vi.fn());

vi.mock("@/services/api", () => ({
  api: {
    post: apiPost,
  },
}));

vi.mock("@/utils/sanitize", () => ({
  sanitizeForLog: (value: unknown) => value,
}));

class MockWebSocket {
  static OPEN = 1;

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  close = vi.fn();
  send = vi.fn();

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  static instances: MockWebSocket[] = [];
}

describe("WebSocketService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    localStorage.setItem("auth_token", "session-token");
    apiPost.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: {
          token: "ws-token",
          wsUrl: "ws://localhost:8788/admin/restaurant-1?token=ws-token",
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("closes heartbeat timeouts with a reconnectable close code", async () => {
    const service = new WebSocketService({
      heartbeatInterval: 1_000,
      heartbeatTimeout: 500,
    });

    await service.connect("restaurant-1");
    const ws = MockWebSocket.instances[0];
    ws.onopen?.();

    vi.advanceTimersByTime(1_000);
    vi.advanceTimersByTime(500);

    expect(ws.close).toHaveBeenCalledWith(4000, "Heartbeat timeout");
  });
});
