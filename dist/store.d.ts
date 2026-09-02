import Database from "better-sqlite3";
export type FactStatus = "active" | "forgotten" | "superseded";
export interface Fact {
    id: string;
    content: string;
    kind: string;
    tags: string[];
    namespace: string;
    agent_id: string | null;
    source: string | null;
    created_at: string;
    updated_at: string;
    status: FactStatus;
    supersedes_id: string | null;
    idempotency_key: string | null;
}
export interface RememberInput {
    content: string;
    kind?: string;
    tags?: string[];
    namespace?: string;
    agent_id?: string;
    source?: string;
    idempotency_key?: string;
}
export interface SearchOptions {
    query: string;
    namespace?: string;
    kind?: string;
    limit?: number;
    includeForgotten?: boolean;
}
export interface ListRecentOptions {
    limit?: number;
    namespace?: string;
    kind?: string;
    agent_id?: string;
}
export declare function defaultDbPath(): string;
export declare class Store {
    readonly db: Database.Database;
    readonly dbPath: string;
    constructor(dbPath?: string);
    private migrate;
    close(): void;
    remember(input: RememberInput): Fact;
    recall(id: string): Fact | null;
    search(options: SearchOptions): Fact[];
    listRecent(options?: ListRecentOptions): Fact[];
    forget(id: string): Fact | null;
    supersede(oldId: string, input: RememberInput): {
        old: Fact;
        neu: Fact;
    };
    status(): {
        db_path: string;
        total: number;
        active: number;
        forgotten: number;
        superseded: number;
        schema_version: string;
    };
    /** All active facts, for vault projection */
    listActive(namespace?: string): Fact[];
}
//# sourceMappingURL=store.d.ts.map