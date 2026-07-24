import { vi } from "vitest";

class TestWebSocketRequestResponsePair {
  constructor(
    public readonly request: string,
    public readonly response: string,
  ) {}
}

vi.stubGlobal("WebSocketRequestResponsePair", TestWebSocketRequestResponsePair);
