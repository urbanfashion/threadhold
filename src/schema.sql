-- Mnem canonical schema: SQLite + FTS5
-- Markdown vault is a projection only; this DB is the source of truth.

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY NOT NULL,
  content TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note',
  tags TEXT NOT NULL DEFAULT '[]',
  namespace TEXT NOT NULL DEFAULT 'default',
  agent_id TEXT,
  source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'forgotten', 'superseded')),
  supersedes_id TEXT REFERENCES facts(id),
  idempotency_key TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_facts_idempotency
  ON facts(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facts_status ON facts(status);
CREATE INDEX IF NOT EXISTS idx_facts_namespace ON facts(namespace);
CREATE INDEX IF NOT EXISTS idx_facts_kind ON facts(kind);
CREATE INDEX IF NOT EXISTS idx_facts_created_at ON facts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facts_updated_at ON facts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_facts_agent_id ON facts(agent_id);
CREATE INDEX IF NOT EXISTS idx_facts_supersedes ON facts(supersedes_id);

-- FTS5 full-text search over content (content sync via triggers)
CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
  content,
  kind,
  namespace,
  tags,
  content='facts',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS facts_ai AFTER INSERT ON facts BEGIN
  INSERT INTO facts_fts(rowid, content, kind, namespace, tags)
  VALUES (new.rowid, new.content, new.kind, new.namespace, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS facts_ad AFTER DELETE ON facts BEGIN
  INSERT INTO facts_fts(facts_fts, rowid, content, kind, namespace, tags)
  VALUES ('delete', old.rowid, old.content, old.kind, old.namespace, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS facts_au AFTER UPDATE ON facts BEGIN
  INSERT INTO facts_fts(facts_fts, rowid, content, kind, namespace, tags)
  VALUES ('delete', old.rowid, old.content, old.kind, old.namespace, old.tags);
  INSERT INTO facts_fts(rowid, content, kind, namespace, tags)
  VALUES (new.rowid, new.content, new.kind, new.namespace, new.tags);
END;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1');
