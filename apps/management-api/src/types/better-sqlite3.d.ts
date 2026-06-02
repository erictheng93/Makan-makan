declare module "better-sqlite3" {
  namespace Database {
    interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }

    interface Statement {
      reader: boolean;
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): RunResult;
      raw(): Statement;
    }

    interface Database {
      pragma(source: string): unknown;
      exec(source: string): void;
      prepare(source: string): Statement;
      close(): void;
    }
  }

  const Database: {
    new (filename: string): Database.Database;
  };

  export default Database;
}
