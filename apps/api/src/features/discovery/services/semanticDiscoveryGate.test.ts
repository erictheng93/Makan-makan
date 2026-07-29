import { describe, expect, it, vi } from "vitest";
import {
  createSemanticDiscovery,
  isSemanticDiscoveryEnabled,
} from "./DiscoveryService";

/**
 * Vectorize bills for stored dimensions and Workers AI for embedding calls, so
 * semantic discovery costs money continuously once its index is populated --
 * whether or not anyone searches. Having the bindings in wrangler.toml must
 * therefore not be the same as having the feature on.
 */
function buildEnv(overrides: Record<string, unknown> = {}) {
  return {
    AI: { run: vi.fn() },
    DISCOVERY_VECTORIZE: { query: vi.fn(), upsert: vi.fn() },
    DISCOVERY_EMBEDDING_MODEL: "@cf/baai/bge-m3",
    CACHE_KV: { get: vi.fn(async () => null) } as never,
    ...overrides,
  };
}

describe("semantic discovery gate", () => {
  it("stays off when the flag is absent", () => {
    expect(isSemanticDiscoveryEnabled({})).toBe(false);
  });

  it('treats anything other than "true" as off', () => {
    expect(
      isSemanticDiscoveryEnabled({ DISCOVERY_SEMANTIC_ENABLED: "false" }),
    ).toBe(false);
    expect(
      isSemanticDiscoveryEnabled({ DISCOVERY_SEMANTIC_ENABLED: "1" }),
    ).toBe(false);
    expect(isSemanticDiscoveryEnabled({ DISCOVERY_SEMANTIC_ENABLED: "" })).toBe(
      false,
    );
  });

  it('turns on for exactly "true"', () => {
    expect(
      isSemanticDiscoveryEnabled({ DISCOVERY_SEMANTIC_ENABLED: "true" }),
    ).toBe(true);
  });

  // The gate withholds the bindings rather than branching at each call site, so
  // "off" lands on a path SemanticDiscoveryService already handles.
  it("reports disabled and queries nothing while gated off", async () => {
    const env = buildEnv();
    const semantic = createSemanticDiscovery(env);

    await expect(semantic.searchDishIdsWithStatus("laksa")).resolves.toEqual({
      matches: [],
      embeddingStatus: "disabled",
    });
    expect(env.DISCOVERY_VECTORIZE.query).not.toHaveBeenCalled();
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it("wires the bindings through once switched on", async () => {
    const env = buildEnv({ DISCOVERY_SEMANTIC_ENABLED: "true" });
    const semantic = createSemanticDiscovery(env);

    const result = await semantic.searchDishIdsWithStatus("laksa", {
      embeddingMode: "cache-only",
    });

    // The embedding cache is empty, so it reports a miss and stops before
    // Vectorize. "cache-miss" rather than "disabled" is the whole point: the
    // service is live and simply had nothing cached.
    expect(result.embeddingStatus).toBe("cache-miss");
    expect(env.CACHE_KV.get).toHaveBeenCalled();
  });
});
