import Database from "better-sqlite3";
import { ulid } from "ulid";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type FactStatus = "active" | "forgotten" | "superseded";

export interface Fact {
  id: string;
  content: string;
  kind: string;
  tags: string[];
  namespace: string;
  agent_id: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  status: FactStatus;
  supersedes_id: string | null;
  idempotency_key: string | null;
}

export interface RememberInput {
  content: string;
  kind?: string;
  tags?: string[];
  namespace?: string;
  agent_id?: string;
  source?: string;
  idempotency_key?: string;
}

export interface SearchOptions {
  query: string;
  namespace?: string;
  kind?: string;
  limit?: number;
  includeForgotten?: boolean;
}

export interface ListRecentOptions {
  limit?: number;
  namespace?: string;
  kind?: string;
  agent_id?: string;
}

interface FactRow {
  id: string;
  content: string;
  kind: string;
  tags: string;
  namespace: string;
  agent_id: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  status: FactStatus;
  supersedes_id: string | null;
  idempotency_key: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function rowToFact(row: FactRow): Fact {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags || "[]");
    if (!Array.isArray(tags)) tags = [];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    content: row.content,
    kind: row.kind,
    tags,
    namespace: row.namespace,
    agent_id: row.agent_id,
    source: row.source,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status,
    supersedes_id: row.supersedes_id,
    idempotency_key: row.idempotency_key,
  };
}

export function defaultDbPath(): string {
  return path.join(os.homedir(), ".mnem", "mnem.db");
}

export class Store {
  readonly db: Database.Database;
  readonly dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? defaultDbPath();
    const dir = path.dirname(this.dbPath);
    fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");

    this.migrate();
  }

  private migrate(): void {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    this.db.exec(schema);
  }

  close(): void {
    this.db.close();
  }

  remember(input: RememberInput): Fact {
    const content = input.content?.trim();
    if (!content) {
      throw new Error("content is required");
    }

    const kind = input.kind?.trim() || "note";
    const tags = input.tags ?? [];
    const namespace = input.namespace?.trim() || "default";
    const agent_id = input.agent_id ?? null;
    const source = input.source ?? null;
    const idempotency_key = input.idempotency_key ?? null;
    const ts = nowIso();

    if (idempotency_key) {
      const existing = this.db
        .prepare(
          `SELECT * FROM facts WHERE idempotency_key = ? LIMIT 1`
        )
        .get(idempotency_key) as FactRow | undefined;
      if (existing) {
        return rowToFact(existing);
      }
    }

    const id = ulid();
    const insert = this.db.prepare(`
      INSERT INTO facts (
        id, content, kind, tags, namespace, agent_id, source,
        created_at, updated_at, status, supersedes_id, idempotency_key
      ) VALUES (
        @id, @content, @kind, @tags, @namespace, @agent_id, @source,
        @created_at, @updated_at, 'active', NULL, @idempotency_key
      )
    `);

    const runInsert = () => {
      insert.run({
        id,
        content,
        kind,
        tags: JSON.stringify(tags),
        namespace,
        agent_id,
        source,
        created_at: ts,
        updated_at: ts,
        idempotency_key,
      });
    };

    // Retry on rare UNIQUE race for idempotency_key under concurrent writers
    try {
      runInsert();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (idempotency_key && /UNIQUE/i.test(msg)) {
        const existing = this.db
          .prepare(
            `SELECT * FROM facts WHERE idempotency_key = ? LIMIT 1`
          )
          .get(idempotency_key) as FactRow | undefined;
        if (existing) return rowToFact(existing);
      }
      throw err;
    }

    return this.recall(id)!;
  }

  recall(id: string): Fact | null {
    const row = this.db
      .prepare(`SELECT * FROM facts WHERE id = ?`)
      .get(id) as FactRow | undefined;
    return row ? rowToFact(row) : null;
  }

  search(options: SearchOptions): Fact[] {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 200);
    const query = options.query.trim();
    if (!query) return [];

    // Escape FTS5 special chars; treat as phrase/AND of tokens
    const tokens = query
      .replace(/["']/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t.replace(/"/g, "")}"`);
    if (tokens.length === 0) return [];
    const ftsQuery = tokens.join(" AND ");

    const clauses: string[] = [`facts_fts MATCH ?`];
    const params: unknown[] = [ftsQuery];

    if (!options.includeForgotten) {
      clauses.push(`f.status = 'active'`);
    }
    if (options.namespace) {
      clauses.push(`f.namespace = ?`);
      params.push(options.namespace);
    }
    if (options.kind) {
      clauses.push(`f.kind = ?`);
      params.push(options.kind);
    }

    params.push(limit);

    const sql = `
      SELECT f.*
      FROM facts_fts
      JOIN facts f ON f.rowid = facts_fts.rowid
      WHERE ${clauses.join(" AND ")}
      ORDER BY bm25(facts_fts), f.updated_at DESC
      LIMIT ?
    `;

    try {
      const rows = this.db.prepare(sql).all(...params) as FactRow[];
      return rows.map(rowToFact);
    } catch {
      // Fallback: LIKE search if FTS query is malformed
      const like = `%${query.replace(/%/g, "")}%`;
      const fallbackClauses = [`f.content LIKE ?`];
      const fallbackParams: unknown[] = [like];
      if (!options.includeForgotten) {
        fallbackClauses.push(`f.status = 'active'`);
      }
      if (options.namespace) {
        fallbackClauses.push(`f.namespace = ?`);
        fallbackParams.push(options.namespace);
      }
      if (options.kind) {
        fallbackClauses.push(`f.kind = ?`);
        fallbackParams.push(options.kind);
      }
      fallbackParams.push(limit);
      const rows = this.db
        .prepare(
          `SELECT f.* FROM facts f WHERE ${fallbackClauses.join(" AND ")}
           ORDER BY f.updated_at DESC LIMIT ?`
        )
        .all(...fallbackParams) as FactRow[];
      return rows.map(rowToFact);
    }
  }

  listRecent(options: ListRecentOptions = {}): Fact[] {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 200);
    const clauses = [`status = 'active'`];
    const params: unknown[] = [];

    if (options.namespace) {
      clauses.push(`namespace = ?`);
      params.push(options.namespace);
    }
    if (options.kind) {
      clauses.push(`kind = ?`);
      params.push(options.kind);
    }
    if (options.agent_id) {
      clauses.push(`agent_id = ?`);
      params.push(options.agent_id);
    }
    params.push(limit);

    const rows = this.db
      .prepare(
        `SELECT * FROM facts WHERE ${clauses.join(" AND ")}
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(...params) as FactRow[];
    return rows.map(rowToFact);
  }

  forget(id: string): Fact | null {
    const existing = this.recall(id);
    if (!existing) return null;
    if (existing.status === "forgotten") return existing;

    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE facts SET status = 'forgotten', updated_at = ? WHERE id = ?`
      )
      .run(ts, id);
    return this.recall(id);
  }

  supersede(oldId: string, input: RememberInput): { old: Fact; neu: Fact } {
    const old = this.recall(oldId);
    if (!old) {
      throw new Error(`fact not found: ${oldId}`);
    }
    if (old.status === "forgotten") {
      throw new Error(`cannot supersede forgotten fact: ${oldId}`);
    }

    const content = input.content?.trim();
    if (!content) {
      throw new Error("content is required");
    }

    const kind = input.kind?.trim() || old.kind;
    const tags = input.tags ?? old.tags;
    const namespace = input.namespace?.trim() || old.namespace;
    const agent_id = input.agent_id ?? old.agent_id;
    const source = input.source ?? old.source;
    const idempotency_key = input.idempotency_key ?? null;
    const ts = nowIso();
    const newId = ulid();

    const tx = this.db.transaction(() => {
      if (idempotency_key) {
        const existing = this.db
          .prepare(
            `SELECT * FROM facts WHERE idempotency_key = ? LIMIT 1`
          )
          .get(idempotency_key) as FactRow | undefined;
        if (existing) {
          return { reused: true as const, id: existing.id };
        }
      }

      this.db
        .prepare(
          `UPDATE facts SET status = 'superseded', updated_at = ? WHERE id = ?`
        )
        .run(ts, oldId);

      this.db
        .prepare(
          `
        INSERT INTO facts (
          id, content, kind, tags, namespace, agent_id, source,
          created_at, updated_at, status, supersedes_id, idempotency_key
        ) VALUES (
          @id, @content, @kind, @tags, @namespace, @agent_id, @source,
          @created_at, @updated_at, 'active', @supersedes_id, @idempotency_key
        )
      `
        )
        .run({
          id: newId,
          content,
          kind,
          tags: JSON.stringify(tags),
          namespace,
          agent_id,
          source,
          created_at: ts,
          updated_at: ts,
          supersedes_id: oldId,
          idempotency_key,
        });

      return { reused: false as const, id: newId };
    });

    const result = tx();
    const neu = this.recall(result.id)!;
    const updatedOld = this.recall(oldId)!;
    return { old: updatedOld, neu };
  }

  status(): {
    db_path: string;
    total: number;
    active: number;
    forgotten: number;
    superseded: number;
    schema_version: string;
  } {
    const counts = this.db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'forgotten' THEN 1 ELSE 0 END) as forgotten,
          SUM(CASE WHEN status = 'superseded' THEN 1 ELSE 0 END) as superseded
         FROM facts`
      )
      .get() as {
      total: number;
      active: number;
      forgotten: number;
      superseded: number;
    };

    const versionRow = this.db
      .prepare(`SELECT value FROM meta WHERE key = 'schema_version'`)
      .get() as { value: string } | undefined;

    return {
      db_path: this.dbPath,
      total: counts.total ?? 0,
      active: counts.active ?? 0,
      forgotten: counts.forgotten ?? 0,
      superseded: counts.superseded ?? 0,
      schema_version: versionRow?.value ?? "1",
    };
  }

  /** All active facts, for vault projection */
  listActive(namespace?: string): Fact[] {
    if (namespace) {
      const rows = this.db
        .prepare(
          `SELECT * FROM facts WHERE status = 'active' AND namespace = ?
           ORDER BY kind, created_at ASC`
        )
        .all(namespace) as FactRow[];
      return rows.map(rowToFact);
    }
    const rows = this.db
      .prepare(
        `SELECT * FROM facts WHERE status = 'active'
         ORDER BY kind, created_at ASC`
      )
      .all() as FactRow[];
    return rows.map(rowToFact);
  }
}
