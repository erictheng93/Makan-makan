import { beforeEach, describe, expect, it, vi } from "vitest";
import { KitchenSSEService } from "./sseService";

const mockPost = vi.hoisted(() => vi.fn());

function unexpiredJwt(): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

  return [
    encode({ alg: "HS256", typ: "JWT" }),
    encode({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    "signature",
  ].join(".");
}

vi.mock("./authApi", () => ({
  getKitchenApiBaseUrl: () => "https://api.test/api/v1",
  apiClient: {
    instance: {
      post: mockPost,
    },
  },
}));

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: MockEventSource[] = [];

  readyState = MockEventSource.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockEventSource.CLOSED;
  });
}

describe("KitchenSSEService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    localStorage.setItem("kitchen_auth_token", unexpiredJwt());
    mockPost.mockResolvedValue({
      data: {
        success: true,
        data: { sseToken: "scoped-sse-token" },
      },
    });
  });

  it("uses a short-lived scoped SSE token instead of putting the primary JWT in the URL or logs", async () => {
    const service = new KitchenSSEService({ restaurantId: "restaurant-1" });

    await service.connect();

    expect(mockPost).toHaveBeenCalledWith(
      "/kitchen/restaurant-1/events/token",
      {},
      expect.objectContaining({
        headers: {
          Authorization: expect.stringMatching(/^Bearer .+\..+\..+$/),
        },
      }),
    );
    expect(MockEventSource.instances).toHaveLength(1);
    const url = MockEventSource.instances[0].url;
    expect(url).toBe(
      "https://api.test/api/v1/kitchen/restaurant-1/events?sseToken=scoped-sse-token",
    );
    expect(url).not.toContain("primary-access-token");
    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringContaining("primary-access-token"),
    );
  });
});
