import { z } from "zod";
import type { Store } from "./store.js";
import { projectVault } from "./vault.js";

export const RememberSchema = z.object({
  content: z.string().min(1).describe("Fact content to remember"),
  kind: z
    .string()
    .optional()
    .describe("Fact kind: note, preference, decision, project, …"),
  tags: z.array(z.string()).optional().describe("Optional tags"),
  namespace: z.string().optional().describe("Namespace (default: default)"),
  agent_id: z.string().optional().describe("Recording agent id"),
  source: z.string().optional().describe("Source label"),
  idempotency_key: z
    .string()
    .optional()
    .describe("Optional unique key to dedupe writes"),
  project_vault: z
    .boolean()
    .optional()
    .describe("If true, regenerate markdown vault after write"),
});

export const RecallSchema = z.object({
  id: z.string().min(1).describe("Fact id (ULID)"),
});

export const SupersedeSchema = z.object({
  id: z.string().min(1).describe("Id of fact to supersede"),
  content: z.string().min(1).describe("Replacement content"),
  kind: z.string().optional(),
  tags: z.array(z.string()).optional(),
  namespace: z.string().optional(),
  agent_id: z.string().optional(),
  source: z.string().optional(),
  idempotency_key: z.string().optional(),
  project_vault: z.boolean().optional(),
});

export const SearchSchema = z.object({
  query: z.string().min(1).describe("Full-text search query"),
  namespace: z.string().optional(),
  kind: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  include_forgotten: z.boolean().optional(),
});

export const ListRecentSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  namespace: z.string().optional(),
  kind: z.string().optional(),
  agent_id: z.string().optional(),
});

export const ForgetSchema = z.object({
  id: z.string().min(1).describe("Fact id to soft-delete"),
  project_vault: z.boolean().optional(),
});

export const StatusSchema = z.object({}).strict().optional();

function json(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function maybeProject(store: Store, flag?: boolean): string | undefined {
  if (!flag) return undefined;
  return projectVault(store);
}

export function createToolHandlers(store: Store) {
  return {
    remember(args: z.infer<typeof RememberSchema>) {
      const fact = store.remember({
        content: args.content,
        kind: args.kind,
        tags: args.tags,
        namespace: args.namespace,
        agent_id: args.agent_id,
        source: args.source,
        idempotency_key: args.idempotency_key,
      });
      const vault = maybeProject(store, args.project_vault);
      return {
        content: [
          {
            type: "text" as const,
            text: json({ ok: true, fact, vault }),
          },
        ],
      };
    },

    recall(args: z.infer<typeof RecallSchema>) {
      const fact = store.recall(args.id);
      if (!fact) {
        return {
          content: [
            {
              type: "text" as const,
              text: json({ ok: false, error: `not found: ${args.id}` }),
            },
          ],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: json({ ok: true, fact }) }],
      };
    },

    supersede(args: z.infer<typeof SupersedeSchema>) {
      try {
        const result = store.supersede(args.id, {
          content: args.content,
          kind: args.kind,
          tags: args.tags,
          namespace: args.namespace,
          agent_id: args.agent_id,
          source: args.source,
          idempotency_key: args.idempotency_key,
        });
        const vault = maybeProject(store, args.project_vault);
        return {
          content: [
            {
              type: "text" as const,
              text: json({
                ok: true,
                superseded: result.old,
                fact: result.neu,
                vault,
              }),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text" as const, text: json({ ok: false, error: message }) },
          ],
          isError: true,
        };
      }
    },

    search(args: z.infer<typeof SearchSchema>) {
      const facts = store.search({
        query: args.query,
        namespace: args.namespace,
        kind: args.kind,
        limit: args.limit,
        includeForgotten: args.include_forgotten,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: json({ ok: true, count: facts.length, facts }),
          },
        ],
      };
    },

    list_recent(args: z.infer<typeof ListRecentSchema>) {
      const facts = store.listRecent({
        limit: args.limit,
        namespace: args.namespace,
        kind: args.kind,
        agent_id: args.agent_id,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: json({ ok: true, count: facts.length, facts }),
          },
        ],
      };
    },

    forget(args: z.infer<typeof ForgetSchema>) {
      const fact = store.forget(args.id);
      if (!fact) {
        return {
          content: [
            {
              type: "text" as const,
              text: json({ ok: false, error: `not found: ${args.id}` }),
            },
          ],
          isError: true,
        };
      }
      const vault = maybeProject(store, args.project_vault);
      return {
        content: [
          { type: "text" as const, text: json({ ok: true, fact, vault }) },
        ],
      };
    },

    status(_args?: z.infer<typeof StatusSchema>) {
      const status = store.status();
      return {
        content: [
          { type: "text" as const, text: json({ ok: true, ...status }) },
        ],
      };
    },
  };
}

export type ToolHandlers = ReturnType<typeof createToolHandlers>;
