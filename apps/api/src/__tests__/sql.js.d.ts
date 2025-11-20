/**
 * Type definitions for sql.js
 * sql.js is a JavaScript SQL database library that runs in the browser
 */

declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): void
    exec(sql: string): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
  }

  export interface Statement {
    bind(values?: any[]): boolean
    step(): boolean
    get(params?: any[]): any[]
    getAsObject(params?: any[]): any
    run(values?: any[]): void
    reset(): void
    freemem(): void
    free(): void
  }

  export interface QueryExecResult {
    columns: string[]
    values: any[][]
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string
  }): Promise<SqlJsStatic>

  export { Database as Database }
}
