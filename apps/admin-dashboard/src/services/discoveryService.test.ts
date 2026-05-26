import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/services/api";
import { discoveryService } from "./discoveryService";

vi.mock("@/services/api", () => ({
  api: {
    post: vi.fn(),
  },
  unwrapApiPayload: (payload: unknown) =>
    typeof payload === "object" && payload !== null && "data" in payload
      ? (payload as { data: unknown }).data
      : payload,
}));

describe("discoveryService", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it("triggers discovery index reindexing", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          dishes: 12,
          restaurants: 4,
          duration_ms: 250,
        },
      },
    } as never);

    const result = await discoveryService.reindex();

    expect(api.post).toHaveBeenCalledWith("/discovery/reindex");
    expect(result).toEqual({
      dishes: 12,
      restaurants: 4,
      duration_ms: 250,
    });
  });
});
