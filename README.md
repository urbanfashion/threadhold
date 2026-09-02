# Threadhold

**One brain for every agent — a local-first MCP memory bus with safe concurrent writes, provenance, and an Obsidian-readable vault.**

Agents today keep private scratchpads. One Cursor session overwrites another's decisions. Claude Desktop forgets what Hermes just learned. Markdown vaults race on disk. **Threadhold** is the shared brain: SQLite + FTS5 is canonical; an Obsidian-compatible markdown vault is a *projection only*.

## Pitch

- **Cross-agent clobber ends here** — one DB, many MCP clients
- **Local-first** — ~/.threadhold/threadhold.db, no cloud required
- **Searchable** — FTS5 full-text over facts
- **Supersede, do not mutate** — history preserved; soft-delete via forget
- **Vault as mirror** — regenerate preferences.md, decisions.md, projects/, _log.md from the DB

## Install

```bash
git clone https://github.com/urbanfashion/threadhold.git
cd threadhold
npm i
npm run build
npm test
```

Requires Node >= 18 (native better-sqlite3).

Default DB: ~/.threadhold/threadhold.db
Default vault: ~/.threadhold/vault/ (override with THREADHOLD_VAULT)
Optional DB override: THREADHOLD_DB

## MCP tools

| Tool | Purpose |
|------|---------|
| remember | Insert a fact |
| recall | Fetch by ULID |
| supersede | Soft-close old fact + insert replacement |
| search | FTS5 search |
| list_recent | Recent active facts |
| forget | Soft-delete |
| status | Counts + DB path |

## Cursor (mcp.json)

See adapters/cursor/mcp.json.example.

```json
{
  "mcpServers": {
    "threadhold": {
      "command": "node",
      "args": ["/absolute/path/to/threadhold/dist/server.js"],
      "env": { "THREADHOLD_VAULT": "/Users/you/.threadhold/vault" }
    }
  }
}
```

## Claude Desktop

See adapters/claude-desktop/config.example.json. Merge into claude_desktop_config.json.

## Hermes

See adapters/hermes/README.md — point Hermes at the same stdio MCP server.

## Dev

```bash
npm run dev
npm start
npm test
```

## Architecture

```
Agents (Cursor / Claude / Hermes)
        |  MCP stdio
        v
   threadhold server  -->  ~/.threadhold/threadhold.db  (SQLite + FTS5, WAL)
                        |
                        +-- project -->  ~/.threadhold/vault/
```

## License

MIT
