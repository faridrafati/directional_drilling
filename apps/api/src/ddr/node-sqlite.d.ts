/**
 * Minimal ambient types for Node's built-in `node:sqlite` (DatabaseSync).
 *
 * @types/node@20 (this workspace's version) predates the module, so we declare
 * only the surface the DDR read layer uses. Node 22.5+ / 25 ships it as an
 * experimental feature (emits a one-time runtime ExperimentalWarning).
 */
declare module "node:sqlite" {
  export interface StatementSync {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }
  export interface DatabaseSyncOptions {
    readOnly?: boolean;
    open?: boolean;
    enableForeignKeyConstraints?: boolean;
  }
  export class DatabaseSync {
    constructor(path: string, options?: DatabaseSyncOptions);
    prepare(sql: string): StatementSync;
    exec(sql: string): void;
    close(): void;
  }
}
