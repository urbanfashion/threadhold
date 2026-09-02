#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Store } from "./store.js";
import {
  createToolHandlers,
  RememberSchema,
  RecallSchema,
  SupersedeSchema,
  SearchSchema,
  ListRecentSchema,
  ForgetSchema,
} from "./tools.js";
import { zodToJsonSchema } from "./zod-json.js";

const store = new Store(process.env.THREADHOLD_DB);
const handlers = createToolHandlers(store);

const TOOLS = [
  {
    name: "remember",
    description:
      "Persist a fact into shared Threadhold memory (SQLite). Optional vault projection.",
    inputSchema: zodToJsonSchema(RememberSchema),
  },
  {
    name: "recall",
    description: "Fetch a fact by id (ULID).",
    inputSchema: zodToJsonSchema(RecallSchema),
  },
  {
    name: "supersede",
    description:
      "Mark an existing fact superseded and insert a replacement (atomic).",
    inputSchema: zodToJsonSchema(SupersedeSchema),
  },
  {
    name: "search",
    description: "Full-text search (FTS5) over active facts.",
    inputSchema: zodToJsonSchema(SearchSchema),
  },
  {
    name: "list_recent",
    description: "List recently created active facts.",
    inputSchema: zodToJsonSchema(ListRecentSchema),
  },
  {
    name: "forget",
    description: "Soft-delete a fact (status=forgotten).",
    inputSchema: zodToJsonSchema(ForgetSchema),
  },
  {
    name: "status",
    description: "DB path, counts, and schema version.",
    inputSchema: { type: "object", properties: {} },
  },
] as const;

const server = new Server(
  { name: "threadhold", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...TOOLS],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "remember":
        return handlers.remember(RememberSchema.parse(args));
      case "recall":
        return handlers.recall(RecallSchema.parse(args));
      case "supersede":
        return handlers.supersede(SupersedeSchema.parse(args));
      case "search":
        return handlers.search(SearchSchema.parse(args));
      case "list_recent":
        return handlers.list_recent(ListRecentSchema.parse(args));
      case "forget":
        return handlers.forget(ForgetSchema.parse(args));
      case "status":
        return handlers.status();
      default:
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ ok: false, error: `unknown tool: ${name}` }),
            },
          ],
          isError: true,
        };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ ok: false, error: message }),
        },
      ],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("threadhold server failed:", err);
  process.exit(1);
});
