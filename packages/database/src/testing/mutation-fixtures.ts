import { vi, type Mock } from "vitest";

export type MutationOperation = "insert" | "update" | "delete";

/**
 * A queue entry is the rows one write resolves with, the number of rows it
 * changed, or an `Error` to make that write reject — some subjects are only
 * exercised by a failing write.
 */
export type MutationResult = unknown[] | { changes: number } | Error;

export type MutationFixtures<Name extends string> = Partial<
  Record<Name, Partial<Record<MutationOperation, MutationResult[]>>>
>;

export interface MutationFixtureDb<Name extends string> {
  insert: Mock;
  update: Mock;
  delete: Mock;
  /** Payloads passed to `.values()`, in call order. */
  inserted: unknown[];
  /** Payloads passed to `.set()`, in call order. */
  updated: unknown[];
  /** Unconsumed fixtures keyed `table:operation`, for drain audits. */
  remaining: () => Record<string, number>;
}

/**
 * Creates a Drizzle insert/update/delete mock whose fixtures are declared per
 * target table *and* operation.
 *
 * Keying by table alone is not enough on the write side: `insert(markets)` and
 * `update(markets)` are different writes, and a shared queue lets one eat the
 * other's fixture. Writes stay positional within one table+operation pair.
 * Register every table a test subject can write to; an unregistered table, a
 * missing declaration, or an exhausted queue fails immediately rather than
 * returning a misleading empty result.
 */
export function createMutationFixtureDb<Name extends string>(
  fixtureTables: Record<Name, unknown>,
  fixtures: MutationFixtures<Name> = {},
): MutationFixtureDb<Name> {
  const tableNamesByValue = new Map<unknown, Name>(
    Object.entries(fixtureTables).map(([name, table]) => [table, name as Name]),
  );
  const queues = new Map<string, MutationResult[]>();
  for (const [name, operations] of Object.entries(fixtures) as [
    Name,
    Partial<Record<MutationOperation, MutationResult[]>> | undefined,
  ][]) {
    for (const [operation, queue] of Object.entries(operations ?? {})) {
      queues.set(`${name}:${operation}`, [...queue]);
    }
  }

  const inserted: unknown[] = [];
  const updated: unknown[] = [];

  const nextResultFor = (table: unknown, operation: MutationOperation) => {
    const name = tableNamesByValue.get(table) ?? "<unknown table>";
    const queue = queues.get(`${name}:${operation}`);
    if (!queue) {
      throw new Error(`Missing ${operation} fixture for ${name}`);
    }

    const result = queue.shift();
    if (result === undefined) {
      throw new Error(`No ${operation} fixtures remaining for ${name}`);
    }
    if (result instanceof Error) throw result;
    return { name, result };
  };

  const rowsFor = (table: unknown, operation: MutationOperation): unknown[] => {
    const { name, result } = nextResultFor(table, operation);
    if (!Array.isArray(result)) {
      throw new Error(
        `The next ${operation} fixture for ${name} is a change count, but returning() needs rows`,
      );
    }
    return result;
  };

  // D1 reports a write as `{ meta: { changes } }`; some callers read the bare
  // `changes` instead, so both spellings are answered from the one fixture.
  const metaFor = (table: unknown, operation: MutationOperation) => {
    const { result } = nextResultFor(table, operation);
    const changes = Array.isArray(result) ? result.length : result.changes;
    return { success: true, changes, meta: { changes } };
  };

  const createBuilder = (table: unknown, operation: MutationOperation) => {
    const builder = {
      where: vi.fn(() => builder),
      returning: vi.fn(async () => rowsFor(table, operation)),
      run: vi.fn(async () => metaFor(table, operation)),
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) =>
        Promise.resolve()
          .then(() => metaFor(table, operation))
          .then(resolve, reject),
    };
    return builder;
  };

  return {
    insert: vi.fn((table: unknown) => {
      const builder = {
        ...createBuilder(table, "insert"),
        values: vi.fn((payload: unknown) => {
          inserted.push(payload);
          return builder;
        }),
        select: vi.fn(() => builder),
        onConflictDoNothing: vi.fn(() => builder),
        onConflictDoUpdate: vi.fn(() => builder),
      };
      return builder;
    }),
    update: vi.fn((table: unknown) => {
      const builder = {
        ...createBuilder(table, "update"),
        set: vi.fn((payload: unknown) => {
          updated.push(payload);
          return builder;
        }),
      };
      return builder;
    }),
    delete: vi.fn((table: unknown) => createBuilder(table, "delete")),
    inserted,
    updated,
    remaining: () =>
      Object.fromEntries(
        [...queues]
          .filter(([, queue]) => queue.length > 0)
          .map(([key, queue]) => [key, queue.length]),
      ),
  };
}
