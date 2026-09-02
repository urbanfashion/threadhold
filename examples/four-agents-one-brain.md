# Four agents, one brain

Scenario: Cursor, Claude Desktop, Hermes, and a CLI agent all talk to the same Mnem MCP server.

## 1. Cursor remembers a preference

remember({ content: "User prefers TypeScript strict mode and ESM", kind: "preference", agent_id: "cursor" })

## 2. Claude Desktop searches

search({ query: "TypeScript strict" })

## 3. Hermes records a decision

remember({ content: "SQLite+FTS5 canonical; vault is projection", kind: "decision", namespace: "project:mnem", agent_id: "hermes" })

## 4. CLI supersedes

supersede({ id: "<ulid>", content: "Also expose read-only HTTP later", agent_id: "cli" })

## 5. Soft delete

forget({ id: "<ulid>" })

Result: four agents, zero clobber, one ~/.mnem/mnem.db.
