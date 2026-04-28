import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApiPost = vi.hoisted(() => vi.fn());

vi.mock("@/services/api", () => ({
  api: {
    post: mockApiPost,
  },
}));

import WebSocketService from "../websocketService";

class MockWebSocket {
  static OPEN = 1;

  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(public readonly url: string) {
    mockWebSockets.push(this);
  }
}

let mockWebSockets: MockWebSocket[] = [];

describe("WebSocketService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSockets = [];
    localStorage.clear();
    localStorage.setItem("auth_token", "auth-token");
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  it("requests realtime auth tokens through the shared api client", async () => {
    mockApiPost.mockResolvedValueOnce({
      status: 200,
      statusText: "OK",
      data: {
        success: true,
        data: {
          token: "ws-token",
          wsUrl: "ws://localhost/ws?token=ws-token",
        },
      },
    });

    const service = new WebSocketService();
    await service.connect("restaurant-1");

    expect(mockApiPost).toHaveBeenCalledWith(
      "/realtime/auth/token",
      {
        roomType: "admin",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: "auth-token",
      },
      expect.objectContaining({ validateStatus: expect.any(Function) }),
    );
    expect(mockWebSockets).toHaveLength(1);
    expect(mockWebSockets[0].url).toBe("ws://localhost/ws?token=ws-token");
  });

  it("preserves non-retryable HTTP status handling", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockApiPost.mockResolvedValueOnce({
      status: 400,
      statusText: "Bad Request",
      data: { success: false },
    });

    const service = new WebSocketService({ maxReconnectAttempts: 1 });
    await service.connect("restaurant-1");

    expect(service.status.value).toBe("error");
    expect(mockWebSockets).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledWith(
      "WebSocket connection aborted (HTTP 400), not retrying",
    );
  });
});
