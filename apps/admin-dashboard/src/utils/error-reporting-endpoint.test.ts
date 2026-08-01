// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());

vi.mock("vue-toastification", () => ({
  useToast: () => ({
    error: toastError,
    warning: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("@/utils/authTokenProvider", () => ({
  getAuthToken: vi.fn(() => "admin-token"),
  setAuthTokenProvider: vi.fn(),
}));

describe("admin error reporting endpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("posts production error reports to the API origin, not the Pages origin", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.makanmasak.com/api/v1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.resetModules();

    const { KitchenErrorHandler } = await import("./errorHandler");

    KitchenErrorHandler.handleAPIError({
      response: {
        status: 500,
        data: {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "database unavailable" },
        },
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.makanmasak.com/api/v1/system/error-report",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
