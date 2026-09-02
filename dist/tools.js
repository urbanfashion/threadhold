import { z } from "zod";
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
function json(data) {
    return JSON.stringify(data, null, 2);
}
function maybeProject(store, flag) {
    if (!flag)
        return undefined;
    return projectVault(store);
}
export function createToolHandlers(store) {
    return {
        remember(args) {
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
                        type: "text",
                        text: json({ ok: true, fact, vault }),
                    },
                ],
            };
        },
        recall(args) {
            const fact = store.recall(args.id);
            if (!fact) {
                return {
                    content: [
                        {
                            type: "text",
                            text: json({ ok: false, error: `not found: ${args.id}` }),
                        },
                    ],
                    isError: true,
                };
            }
            return {
                content: [{ type: "text", text: json({ ok: true, fact }) }],
            };
        },
        supersede(args) {
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
                            type: "text",
                            text: json({
                                ok: true,
                                superseded: result.old,
                                fact: result.neu,
                                vault,
                            }),
                        },
                    ],
                };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    content: [
                        { type: "text", text: json({ ok: false, error: message }) },
                    ],
                    isError: true,
                };
            }
        },
        search(args) {
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
                        type: "text",
                        text: json({ ok: true, count: facts.length, facts }),
                    },
                ],
            };
        },
        list_recent(args) {
            const facts = store.listRecent({
                limit: args.limit,
                namespace: args.namespace,
                kind: args.kind,
                agent_id: args.agent_id,
            });
            return {
                content: [
                    {
                        type: "text",
                        text: json({ ok: true, count: facts.length, facts }),
                    },
                ],
            };
        },
        forget(args) {
            const fact = store.forget(args.id);
            if (!fact) {
                return {
                    content: [
                        {
                            type: "text",
                            text: json({ ok: false, error: `not found: ${args.id}` }),
                        },
                    ],
                    isError: true,
                };
            }
            const vault = maybeProject(store, args.project_vault);
            return {
                content: [
                    { type: "text", text: json({ ok: true, fact, vault }) },
                ],
            };
        },
        status(_args) {
            const status = store.status();
            return {
                content: [
                    { type: "text", text: json({ ok: true, ...status }) },
                ],
            };
        },
    };
}
//# sourceMappingURL=tools.js.map