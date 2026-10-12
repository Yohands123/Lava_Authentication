// Source of truth for users and their passkeys. Only public keys are stored.

import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

export interface StoredCredential {
  id: string; // base64url credential ID
  userId: string;
  username: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports: string[];
}

export class UserStore extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        public_key BLOB NOT NULL,
        counter INTEGER NOT NULL,
        transports TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  async usernameTaken(username: string): Promise<boolean> {
    return this.sql.exec("SELECT 1 FROM users WHERE username = ?", username).toArray().length > 0;
  }

  /** Create the user and their first passkey atomically. Returns false if the username was taken meanwhile. */
  async createUserWithCredential(
    user: { id: string; username: string },
    credential: { id: string; publicKey: Uint8Array; counter: number; transports: string[] },
  ): Promise<boolean> {
    if (await this.usernameTaken(user.username)) return false;
    const now = Date.now();
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)", user.id, user.username, now);
      this.sql.exec(
        "INSERT INTO credentials (id, user_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        credential.id,
        user.id,
        credential.publicKey.slice().buffer,
        credential.counter,
        JSON.stringify(credential.transports),
        now,
      );
    });
    return true;
  }

  async getCredential(id: string): Promise<StoredCredential | null> {
    const row = this.sql
      .exec<{ id: string; user_id: string; username: string; public_key: ArrayBuffer; counter: number; transports: string }>(
        `SELECT c.id, c.user_id, u.username, c.public_key, c.counter, c.transports
         FROM credentials c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
        id,
      )
      .toArray()[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      username: row.username,
      publicKey: new Uint8Array(row.public_key),
      counter: row.counter,
      transports: JSON.parse(row.transports) as string[],
    };
  }

  async updateCounter(id: string, counter: number): Promise<void> {
    this.sql.exec("UPDATE credentials SET counter = ? WHERE id = ?", counter, id);
  }
}
