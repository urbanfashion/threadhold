import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Store } from "../src/store.js";
import { Vault } from "../src/vault.js";

let tmpDir: string;
let dbPath: string;
let store: Store;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mnem-test-"));
  dbPath = path.join(tmpDir, "mnem.db");
  store = new Store(dbPath);
});

afterEach(() => {
  try { store.close(); } catch { /* ignore */ }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("Store basics", () => {
  it("remembers and recalls a fact", () => {
    const fact = store.remember({
      content: "User likes dark mode",
      kind: "preference",
      tags: ["ui"],
      agent_id: "test",
    });
    expect(fact.id).toBeTruthy();
    expect(fact.status).toBe("active");
    expect(fact.tags).toEqual(["ui"]);
    const got = store.recall(fact.id);
    expect(got?.content).toBe("User likes dark mode");
  });

  it("idempotency_key returns same fact", () => {
    const a = store.remember({ content: "once", idempotency_key: "key-1" });
    const b = store.remember({ content: "twice", idempotency_key: "key-1" });
    expect(a.id).toBe(b.id);
    expect(b.content).toBe("once");
  });

  it("search finds content via FTS5", () => {
    store.remember({ content: "Adopt WAL mode for SQLite concurrency" });
    store.remember({ content: "Prefer ESM modules in TypeScript" });
    const hits = store.search({ query: "WAL SQLite" });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].content).toMatch(/WAL/);
  });

  it("listRecent returns newest first", () => {
    store.remember({ content: "first" });
    store.remember({ content: "second" });
    const recent = store.listRecent({ limit: 10 });
    expect(recent[0].content).toBe("second");
  });
});

describe("supersede", () => {
  it("marks old superseded and inserts replacement", () => {
    const old = store.remember({ content: "Use Postgres", kind: "decision" });
    const { old: updated, neu } = store.supersede(old.id, {
      content: "Use SQLite+FTS5",
      kind: "decision",
    });
    expect(updated.status).toBe("superseded");
    expect(neu.status).toBe("active");
    expect(neu.supersedes_id).toBe(old.id);
    expect(neu.content).toBe("Use SQLite+FTS5");
    const active = store.listRecent({ kind: "decision" });
    expect(active.every((f) => f.status === "active")).toBe(true);
    expect(active.find((f) => f.id === old.id)).toBeUndefined();
  });
});

describe("soft delete (forget)", () => {
  it("forgets without hard delete", () => {
    const fact = store.remember({ content: "ephemeral note" });
    const forgotten = store.forget(fact.id);
    expect(forgotten?.status).toBe("forgotten");
    expect(store.recall(fact.id)?.status).toBe("forgotten");
    const searchDefault = store.search({ query: "ephemeral" });
    expect(searchDefault.find((f) => f.id === fact.id)).toBeUndefined();
    const searchAll = store.search({ query: "ephemeral", includeForgotten: true });
    expect(searchAll.find((f) => f.id === fact.id)).toBeTruthy();
  });
});

describe("concurrent remember stress", () => {
  it("survives many concurrent writers with WAL", async () => {
    const N = 40;
    const workers = 8;
    const perWorker = Math.ceil(N / workers);
    const stores = Array.from({ length: workers }, () => new Store(dbPath));
    try {
      await Promise.all(
        stores.map(async (s, wi) => {
          for (let i = 0; i < perWorker; i++) {
            const idx = wi * perWorker + i;
            if (idx >= N) break;
            s.remember({
              content: "concurrent fact " + idx,
              kind: "note",
              agent_id: "agent-" + wi,
              idempotency_key: "stress-" + idx,
            });
          }
        })
      );
      const status = store.status();
      expect(status.active).toBe(N);
      expect(status.total).toBe(N);
      await Promise.all(
        stores.map(async (s, wi) => {
          for (let i = 0; i < perWorker; i++) {
            const idx = wi * perWorker + i;
            if (idx >= N) break;
            s.remember({
              content: "concurrent fact " + idx + " RETRY",
              idempotency_key: "stress-" + idx,
            });
          }
        })
      );
      expect(store.status().total).toBe(N);
    } finally {
      for (const s of stores) {
        try { s.close(); } catch { /* ignore */ }
      }
    }
  });
});

