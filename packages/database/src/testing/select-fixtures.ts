import { vi } from "vitest";

export type SelectFixtures<Name extends string> = Partial<
  Record<Name, unknown[][]>
>;

export interface SelectFixtureDb<Name extends string> {
  select: ReturnType<typeof vi.fn>;
}

/**
 * Creates a Drizzle select mock whose fixtures are declared per source table.
 *
 * Reads remain positional within one table: the Nth read of a table consumes
 * the Nth fixture for that table. Register every table a test subject can read;
 * an unregistered table, a missing declaration, or an exhausted queue fails
 * immediately rather than returning a misleading empty result.
 */
export function createSelectFixtureDb<Name extends string>(
  fixtureTables: Record<Name, unknown>,
  fixtures: SelectFixtures<Name> = {},
): SelectFixtureDb<Name> {
  const tableNamesByValue = new Map<unknown, Name>(
    Object.entries(fixtureTables).map(([name, table]) => [table, name as Name]),
  );
  const results = new Map<unknown, unknown[][]>(
    Object.entries(fixtures).map(([name, queue]) => [
      fixtureTables[name as Name],
      [...(queue ?? [])],
    ]),
  );
  const unselectedTable = Symbol("unselectedTable");

  const nextResultFor = (table: unknown): unknown[] => {
    if (table === unselectedTable) {
      throw new Error("Select fixture query never called from(table)");
    }

    const name = tableNamesByValue.get(table) ?? "<unknown table>";
    const queue = results.get(table);
    if (!queue) {
      throw new Error(`Missing select fixture for ${name}`);
    }

    const result = queue.shift();
    if (result === undefined) {
      throw new Error(`No select fixtures remaining for ${name}`);
    }
    return result;
  };

  const createQuery = () => {
    let selectedTable: unknown = unselectedTable;
    const builder = {
      from: vi.fn((table: unknown) => {
        selectedTable = table;
        return builder;
      }),
      innerJoin: vi.fn(() => builder),
      leftJoin: vi.fn(() => builder),
      where: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      groupBy: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      offset: vi.fn(() => builder),
      get: vi.fn(async () => nextResultFor(selectedTable)[0]),
      all: vi.fn(async () => nextResultFor(selectedTable)),
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) =>
        Promise.resolve()
          .then(() => nextResultFor(selectedTable))
          .then(resolve, reject),
    };
    return builder;
  };

  return { select: vi.fn(createQuery) };
}
