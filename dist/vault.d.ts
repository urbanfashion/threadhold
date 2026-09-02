import type { Store } from "./store.js";
export declare function defaultVaultPath(): string;
/**
 * Obsidian-compatible markdown vault is a *projection* of the SQLite store.
 * Never use markdown as the write concurrency surface — regenerate from DB.
 */
export declare class Vault {
    readonly vaultPath: string;
    constructor(vaultPath?: string);
    project(store: Store): void;
    private writeFile;
    /** Append-only activity log — one line per active fact id seen this projection */
    private appendLog;
}
/** Convenience: open store projection into vault */
export declare function projectVault(store: Store, vaultPath?: string): string;
//# sourceMappingURL=vault.d.ts.map