import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Fact, Store } from "./store.js";

export function defaultVaultPath(): string {
  return process.env.MNEM_VAULT?.trim() || path.join(os.homedir(), "mnem", "vault");
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function formatFactBlock(fact: Fact): string {
  const tags =
    fact.tags.length > 0
      ? fact.tags.map((t) => `#${t}`).join(" ")
      : "";
  const meta = [
    `id: ${fact.id}`,
    `kind: ${fact.kind}`,
    `namespace: ${fact.namespace}`,
    fact.agent_id ? `agent: ${fact.agent_id}` : null,
    `updated: ${fact.updated_at}`,
    tags || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return `### ${fact.id.slice(0, 10)}…\n\n${fact.content}\n\n<!-- ${meta} -->\n`;
}

function sectionForKind(kind: string, facts: Fact[]): string {
  if (facts.length === 0) {
    return `_No active ${kind} facts._\n`;
  }
  return facts.map(formatFactBlock).join("\n");
}

/**
 * Obsidian-compatible markdown vault is a *projection* of the SQLite store.
 * Never use markdown as the write concurrency surface — regenerate from DB.
 */
export class Vault {
  readonly vaultPath: string;

  constructor(vaultPath?: string) {
    this.vaultPath = vaultPath ?? defaultVaultPath();
  }

  project(store: Store): void {
    ensureDir(this.vaultPath);
    ensureDir(path.join(this.vaultPath, "projects"));

    const active = store.listActive();

    const preferences = active.filter(
      (f) => f.kind === "preference" || f.kind === "preferences"
    );
    const decisions = active.filter((f) => f.kind === "decision");
    const projects = active.filter(
      (f) => f.kind === "project" || f.namespace.startsWith("project:")
    );
    const other = active.filter(
      (f) =>
        !preferences.includes(f) &&
        !decisions.includes(f) &&
        !projects.includes(f)
    );

    this.writeFile(
      "preferences.md",
      `# Preferences\n\n> Regenerated from Mnem SQLite. Do not edit as source of truth.\n\n${sectionForKind("preference", preferences)}`
    );

    this.writeFile(
      "decisions.md",
      `# Decisions\n\n> Regenerated from Mnem SQLite. Do not edit as source of truth.\n\n${sectionForKind("decision", decisions)}`
    );

    // Group projects by namespace (project:foo) or single projects.md rollup
    const byProject = new Map<string, Fact[]>();
    for (const f of projects) {
      let key = "general";
      if (f.namespace.startsWith("project:")) {
        key = f.namespace.slice("project:".length) || "general";
      } else if (f.tags.find((t) => t.startsWith("project:"))) {
        key = f.tags.find((t) => t.startsWith("project:"))!.slice(8) || "general";
      }
      const safe = key.replace(/[^a-zA-Z0-9._-]+/g, "-") || "general";
      if (!byProject.has(safe)) byProject.set(safe, []);
      byProject.get(safe)!.push(f);
    }

    for (const [name, facts] of byProject) {
      this.writeFile(
        path.join("projects", `${name}.md`),
        `# Project: ${name}\n\n> Regenerated from Mnem SQLite.\n\n${sectionForKind("project", facts)}`
      );
    }

    // Notes / other kinds land in notes.md for browseability
    this.writeFile(
      "notes.md",
      `# Notes\n\n> Regenerated from Mnem SQLite.\n\n${sectionForKind("note", other)}`
    );

    this.appendLog(active);
  }

  private writeFile(rel: string, content: string): void {
    const full = path.join(this.vaultPath, rel);
    ensureDir(path.dirname(full));
    fs.writeFileSync(full, content.endsWith("\n") ? content : content + "\n", "utf8");
  }

  /** Append-only activity log — one line per active fact id seen this projection */
  private appendLog(active: Fact[]): void {
    const logPath = path.join(this.vaultPath, "_log.md");
    ensureDir(this.vaultPath);

    let existing = "";
    if (fs.existsSync(logPath)) {
      existing = fs.readFileSync(logPath, "utf8");
    } else {
      existing =
        "# Mnem vault log\n\nAppend-only projection log. Source of truth is SQLite.\n\n";
    }

    const stamped = new Date().toISOString();
    const line = `- ${stamped} · projected ${active.length} active fact(s)\n`;
    // Avoid duplicating identical consecutive projection counts in same second
    if (!existing.includes(line)) {
      fs.appendFileSync(logPath, line, "utf8");
    }
  }
}

/** Convenience: open store projection into vault */
export function projectVault(store: Store, vaultPath?: string): string {
  const vault = new Vault(vaultPath);
  vault.project(store);
  return vault.vaultPath;
}
