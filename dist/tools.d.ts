import { z } from "zod";
import type { Store } from "./store.js";
export declare const RememberSchema: z.ZodObject<{
    content: z.ZodString;
    kind: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    namespace: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodString>;
    idempotency_key: z.ZodOptional<z.ZodString>;
    project_vault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    content: string;
    kind?: string | undefined;
    tags?: string[] | undefined;
    namespace?: string | undefined;
    agent_id?: string | undefined;
    source?: string | undefined;
    idempotency_key?: string | undefined;
    project_vault?: boolean | undefined;
}, {
    content: string;
    kind?: string | undefined;
    tags?: string[] | undefined;
    namespace?: string | undefined;
    agent_id?: string | undefined;
    source?: string | undefined;
    idempotency_key?: string | undefined;
    project_vault?: boolean | undefined;
}>;
export declare const RecallSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const SupersedeSchema: z.ZodObject<{
    id: z.ZodString;
    content: z.ZodString;
    kind: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    namespace: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodString>;
    idempotency_key: z.ZodOptional<z.ZodString>;
    project_vault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    content: string;
    id: string;
    kind?: string | undefined;
    tags?: string[] | undefined;
    namespace?: string | undefined;
    agent_id?: string | undefined;
    source?: string | undefined;
    idempotency_key?: string | undefined;
    project_vault?: boolean | undefined;
}, {
    content: string;
    id: string;
    kind?: string | undefined;
    tags?: string[] | undefined;
    namespace?: string | undefined;
    agent_id?: string | undefined;
    source?: string | undefined;
    idempotency_key?: string | undefined;
    project_vault?: boolean | undefined;
}>;
export declare const SearchSchema: z.ZodObject<{
    query: z.ZodString;
    namespace: z.ZodOptional<z.ZodString>;
    kind: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
    include_forgotten: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    query: string;
    kind?: string | undefined;
    namespace?: string | undefined;
    limit?: number | undefined;
    include_forgotten?: boolean | undefined;
}, {
    query: string;
    kind?: string | undefined;
    namespace?: string | undefined;
    limit?: number | undefined;
    include_forgotten?: boolean | undefined;
}>;
export declare const ListRecentSchema: z.ZodObject<{
    limit: z.ZodOptional<z.ZodNumber>;
    namespace: z.ZodOptional<z.ZodString>;
    kind: z.ZodOptional<z.ZodString>;
    agent_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind?: string | undefined;
    namespace?: string | undefined;
    agent_id?: string | undefined;
    limit?: number | undefined;
}, {
    kind?: string | undefined;
    namespace?: string | undefined;
    agent_id?: string | undefined;
    limit?: number | undefined;
}>;
export declare const ForgetSchema: z.ZodObject<{
    id: z.ZodString;
    project_vault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    project_vault?: boolean | undefined;
}, {
    id: string;
    project_vault?: boolean | undefined;
}>;
export declare const StatusSchema: z.ZodOptional<z.ZodObject<{}, "strict", z.ZodTypeAny, {}, {}>>;
export declare function createToolHandlers(store: Store): {
    remember(args: z.infer<typeof RememberSchema>): {
        content: {
            type: "text";
            text: string;
        }[];
    };
    recall(args: z.infer<typeof RecallSchema>): {
        content: {
            type: "text";
            text: string;
        }[];
        isError: boolean;
    } | {
        content: {
            type: "text";
            text: string;
        }[];
        isError?: undefined;
    };
    supersede(args: z.infer<typeof SupersedeSchema>): {
        content: {
            type: "text";
            text: string;
        }[];
        isError?: undefined;
    } | {
        content: {
            type: "text";
            text: string;
        }[];
        isError: boolean;
    };
    search(args: z.infer<typeof SearchSchema>): {
        content: {
            type: "text";
            text: string;
        }[];
    };
    list_recent(args: z.infer<typeof ListRecentSchema>): {
        content: {
            type: "text";
            text: string;
        }[];
    };
    forget(args: z.infer<typeof ForgetSchema>): {
        content: {
            type: "text";
            text: string;
        }[];
        isError: boolean;
    } | {
        content: {
            type: "text";
            text: string;
        }[];
        isError?: undefined;
    };
    status(_args?: z.infer<typeof StatusSchema>): {
        content: {
            type: "text";
            text: string;
        }[];
    };
};
export type ToolHandlers = ReturnType<typeof createToolHandlers>;
//# sourceMappingURL=tools.d.ts.map