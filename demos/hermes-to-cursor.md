# Hermes → Cursor shared memory demo

Prove that **Hermes** and **Cursor** share one Mnem brain: Hermes `remember`s a fact; Cursor `search`es the same SQLite DB and gets it back. No markdown races.

## Setup

1. Build Mnem:

```bash
cd mnem
npm i
npm run build
```

2. Point both agents at the **same** DB + vault:

```bash
export MNEM_DB="$HOME/.mnem/mnem.db"
export MNEM_VAULT="$HOME/mnem/vault"
```

3. Cursor — merge `adapters/cursor/mcp.json.example` into your MCP config (absolute path to `dist/server.js`, same `MNEM_DB` / `MNEM_VAULT`).

4. Hermes — follow `adapters/hermes/README.md` and launch the same `node dist/server.js` stdio MCP server with the same env.

5. Optional headless check (no IDE): run the script below against the built `dist/`.

## Script

Cross-agent flow (Hermes writes, Cursor reads):

```js
import { Store } from "../dist/store.js";
import { createToolHandlers } from "../dist/tools.js";

const store = new Store(process.env.MNEM_DB);
const h = createToolHandlers(store);

// Hermes agent remembers
const r1 = await h.remember({
  content: "Prefer local-first SQLite for agent memory; never race markdown files.",
  kind: "preference",
  tags: ["architecture", "mnem"],
  namespace: "demo",
  agent_id: "hermes",
  source: "hermes-session",
  idempotency_key: "demo-pref-1",
});
console.log("HERMES_REMEMBER", JSON.parse(r1.content[0].text));

// Cursor agent searches the same DB
const r2 = await h.search({
  query: "SQLite agent memory",
  limit: 5,
  namespace: "demo",
});
console.log("CURSOR_SEARCH", JSON.parse(r2.content[0].text));

const st = await h.status();
console.log("STATUS", JSON.parse(st.content[0].text));
```

### Live MCP path

1. **In Hermes:** call `remember` with the preference above (`agent_id: "hermes"`).
2. **In Cursor:** call `search` with query `SQLite agent memory` (same `namespace: "demo"` if used).
3. Expect the Hermes fact in Cursor's search hits; `status` shows one shared DB path.

## Verified

**2026-09-02** — Cross-agent `remember` (Hermes) → `search` (Cursor) against the same `MNEM_DB` worked: Cursor retrieved the Hermes-written preference; vault stayed a projection of SQLite, not a competing source of truth.
