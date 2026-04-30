import type { DurableObjectNamespace } from "@cloudflare/workers-types";

/**
 * In-memory Durable Object stub for integration tests that don't exercise
 * DO state transitions. Returns an empty 200 response for every fetch.
 * Does NOT emulate alarms, storage, or transactions.
 */
export function createDurableObjectStub(): DurableObjectNamespace {
  const state = new Map<string, Map<string, unknown>>();

  return {
    idFromName: (name: string) => ({ toString: () => name, name }) as never,
    idFromString: (id: string) => ({ toString: () => id }) as never,
    newUniqueId: () => ({ toString: () => crypto.randomUUID() }) as never,
    get: (id: any) => {
      const idStr = id.toString();
      if (!state.has(idStr)) state.set(idStr, new Map());
      return {
        fetch: async () => new Response("{}", { status: 200 }),
      } as never;
    },
  } as unknown as DurableObjectNamespace;
}
