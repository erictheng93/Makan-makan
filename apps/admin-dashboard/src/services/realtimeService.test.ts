// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const websocketService = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  subscribe: vi.fn(() => "ws-sub-1"),
  unsubscribe: vi.fn(),
  send: vi.fn(),
  status: { value: "disconnected" },
  isConnected: { value: false },
}));

vi.mock("./websocketService", () => ({
  useWebSocketService: vi.fn(() => websocketService),
}));

vi.mock("./api", () => ({
  apiClient: {
    get: vi.fn(),
  },
  unwrapApiData: vi.fn((response) => response.data),
}));

describe("realtimeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
    });
    localStorage.setItem("auth_token", "session-token");
  });

  it("connects through the realtime WebSocket service instead of legacy EventSource", async () => {
    const eventSource = vi.fn();
    vi.stubGlobal("EventSource", eventSource);

    const { realtimeService } = await import("./realtimeService");

    await realtimeService.connect("restaurant-1");

    expect(eventSource).not.toHaveBeenCalled();
    expect(websocketService.connect).toHaveBeenCalledWith("restaurant-1");
  });
});
