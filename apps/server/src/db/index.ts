import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { ServerConfig } from '../config.js';
import * as schema from './schema.js';

export type Database = ReturnType<typeof createDb>['db'];

export function createDb(config: ServerConfig): { db: ReturnType<typeof drizzle<typeof schema>>; sql: postgres.Sql } {
  const sql = postgres(config.databaseUrl, { max: 10 });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export async function ensureSchema(sql: postgres.Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      github_id VARCHAR(64) UNIQUE,
      name VARCHAR(255) NOT NULL,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL REFERENCES users(id),
      name VARCHAR(255) NOT NULL DEFAULT '未命名',
      thumbnail_key TEXT,
      schema_version INTEGER NOT NULL DEFAULT 1,
      snapshot_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS share_links (
      token VARCHAR(32) PRIMARY KEY,
      document_id UUID NOT NULL REFERENCES documents(id),
      mode VARCHAR(8) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES documents(id),
      page_id VARCHAR(32) NOT NULL,
      element_id VARCHAR(32),
      world_x REAL NOT NULL,
      world_y REAL NOT NULL,
      author_id UUID REFERENCES users(id),
      author_name VARCHAR(255),
      body TEXT NOT NULL,
      resolved_at TIMESTAMPTZ,
      parent_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES documents(id),
      sha256 VARCHAR(64) NOT NULL,
      mime VARCHAR(128) NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      s3_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
}
