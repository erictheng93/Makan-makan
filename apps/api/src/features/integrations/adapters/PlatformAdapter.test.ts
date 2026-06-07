import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformType } from "@makanmakan/shared-types";
import {
  getAdapter,
  isPlatformAdapterSupported,
  SUPPORTED_PLATFORM_ADAPTERS,
} from "./PlatformAdapter";

const uberEatsAdapter = vi.hoisted(() =>
  vi.fn(function UberEatsAdapter() {
    return { platform: "uber_eats" };
  }),
);

vi.mock("./UberEatsAdapter", () => ({
  UberEatsAdapter: uberEatsAdapter,
}));

describe("PlatformAdapter registry", () => {
  beforeEach(() => {
    uberEatsAdapter.mockClear();
  });

  it("reports supported platform adapters", () => {
    expect(SUPPORTED_PLATFORM_ADAPTERS).toEqual(["uber_eats"]);
    expect(isPlatformAdapterSupported("uber_eats")).toBe(true);
    expect(isPlatformAdapterSupported("foodpanda" as PlatformType)).toBe(false);
  });

  it("creates enabled adapters and rejects unsupported platforms", () => {
    expect(getAdapter("uber_eats")).toEqual({ platform: "uber_eats" });
    expect(uberEatsAdapter).toHaveBeenCalledOnce();

    expect(() => getAdapter("foodpanda" as PlatformType)).toThrow(
      "Platform adapter is not enabled: foodpanda",
    );
  });
});
