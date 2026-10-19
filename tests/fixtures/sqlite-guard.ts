import { createRequire } from "node:module";
import { LavaEnforcer } from "../../src/worker/guard/LavaEnforcer";
import type { GuardSql } from "../../src/worker/guard/storage";
interface Database { exec(query: string): void; close(): void; prepare(query: string): { columns(): unknown[]; all(...args: unknown[]): Record<string, unknown>[]; run(...args: unknown[]): unknown; get(): Record<string, unknown> | undefined } }
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => Database };
export function sqliteGuard() {
  const database = new DatabaseSync(":memory:");
  const sql = { exec(query: string, ...args: (string|number)[]) {
    if (!args.length && query.includes(";")) { database.exec(query); return []; }
    const statement = database.prepare(query), rows = statement.columns().length ? statement.all(...args) : (statement.run(...args),[]);
    return {toArray:()=>rows,[Symbol.iterator]:()=>rows[Symbol.iterator]()};
  } } as unknown as GuardSql;
  return {database,sql,guard:new LavaEnforcer(sql)};
}
