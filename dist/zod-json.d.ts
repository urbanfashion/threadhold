import type { z } from "zod";
/**
 * Minimal Zod → JSON Schema converter for MCP tool inputSchema.
 * Covers the object / string / number / boolean / array shapes we use.
 */
export declare function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown>;
//# sourceMappingURL=zod-json.d.ts.map