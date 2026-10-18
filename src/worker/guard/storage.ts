/** Minimal SQL port shared by Workers SQLite and local security tests. */
export interface GuardSql {
  exec<T extends Record<string, string | number | null | ArrayBuffer> = Record<string, string | number | null | ArrayBuffer>>(query: string, ...bindings: (string | number | null)[]): {
    toArray(): T[];
    [Symbol.iterator](): Iterator<T>;
  };
}
