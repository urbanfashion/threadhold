import type { z } from "zod";

/**
 * Minimal Zod → JSON Schema converter for MCP tool inputSchema.
 * Covers the object / string / number / boolean / array shapes we use.
 */
export function zodToJsonSchema(
  schema: z.ZodTypeAny
): Record<string, unknown> {
  return convert(schema);
}

function convert(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def as { typeName?: string; description?: string };
  const typeName = def.typeName ?? "";

  if (typeName === "ZodOptional") {
    return convert((schema as z.ZodOptional<z.ZodTypeAny>)._def.innerType);
  }
  if (typeName === "ZodDefault") {
    return convert((schema as z.ZodDefault<z.ZodTypeAny>)._def.innerType);
  }
  if (typeName === "ZodEffects") {
    return convert((schema as z.ZodEffects<z.ZodTypeAny>)._def.schema);
  }

  if (typeName === "ZodObject") {
    const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = convert(value as z.ZodTypeAny);
      if (!(value as z.ZodTypeAny).isOptional()) {
        required.push(key);
      }
    }
    const out: Record<string, unknown> = {
      type: "object",
      properties,
    };
    if (required.length) out.required = required;
    if (def.description) out.description = def.description;
    return out;
  }

  if (typeName === "ZodString") {
    const out: Record<string, unknown> = { type: "string" };
    if (def.description) out.description = def.description;
    return out;
  }

  if (typeName === "ZodNumber") {
    const out: Record<string, unknown> = { type: "number" };
    if (def.description) out.description = def.description;
    return out;
  }

  if (typeName === "ZodBoolean") {
    const out: Record<string, unknown> = { type: "boolean" };
    if (def.description) out.description = def.description;
    return out;
  }

  if (typeName === "ZodArray") {
    const out: Record<string, unknown> = {
      type: "array",
      items: convert((schema as z.ZodArray<z.ZodTypeAny>)._def.type),
    };
    if (def.description) out.description = def.description;
    return out;
  }

  return { type: "object", properties: {} };
}
