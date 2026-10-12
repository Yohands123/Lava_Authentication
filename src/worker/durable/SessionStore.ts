import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import { toBase64Url } from "../lib/base64url";

export interface Session {
  id: string;
  userId: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

export class SessionStore extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
    `);
  }

  async create(userId: string, username: string, ttlSeconds: number): Promise<Session> {
    const id = toBase64Url(crypto.getRandomValues(new Uint8Array(32))); // 43 chars
    const now = Date.now();
    const session: Session = { id, userId, username, createdAt: now, expiresAt: now + ttlSeconds * 1000 };
    this.sql.exec(
      "INSERT INTO sessions (id, user_id, username, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
      id, userId, username, now, session.expiresAt,
    );
    return session;
  }

  async get(id: string): Promise<Session | null> {
    const row = this.sql
      .exec<{ user_id: string; username: string; created_at: number; expires_at: number }>(
        "SELECT user_id, username, created_at, expires_at FROM sessions WHERE id = ?",
        id,
      )
      .toArray()[0];
    if (!row) return null;
    if (row.expires_at < Date.now()) {
      this.sql.exec("DELETE FROM sessions WHERE id = ?", id);
      return null;
    }
    return { id, userId: row.user_id, username: row.username, createdAt: row.created_at, expiresAt: row.expires_at };
  }

  async revoke(id: string): Promise<void> {
    this.sql.exec("DELETE FROM sessions WHERE id = ?", id);
  }

  async revokeAll(userId: string): Promise<number> {
    const before = this.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?", userId).one().n;
    this.sql.exec("DELETE FROM sessions WHERE user_id = ?", userId);
    return before;
  }
}
