/**
 * Minimal Zod → JSON Schema converter for MCP tool inputSchema.
 * Covers the object / string / number / boolean / array shapes we use.
 */
export function zodToJsonSchema(schema) {
    return convert(schema);
}
function convert(schema) {
    const def = schema._def;
    const typeName = def.typeName ?? "";
    if (typeName === "ZodOptional") {
        return convert(schema._def.innerType);
    }
    if (typeName === "ZodDefault") {
        return convert(schema._def.innerType);
    }
    if (typeName === "ZodEffects") {
        return convert(schema._def.schema);
    }
    if (typeName === "ZodObject") {
        const shape = schema.shape;
        const properties = {};
        const required = [];
        for (const [key, value] of Object.entries(shape)) {
            properties[key] = convert(value);
            if (!value.isOptional()) {
                required.push(key);
            }
        }
        const out = {
            type: "object",
            properties,
        };
        if (required.length)
            out.required = required;
        if (def.description)
            out.description = def.description;
        return out;
    }
    if (typeName === "ZodString") {
        const out = { type: "string" };
        if (def.description)
            out.description = def.description;
        return out;
    }
    if (typeName === "ZodNumber") {
        const out = { type: "number" };
        if (def.description)
            out.description = def.description;
        return out;
    }
    if (typeName === "ZodBoolean") {
        const out = { type: "boolean" };
        if (def.description)
            out.description = def.description;
        return out;
    }
    if (typeName === "ZodArray") {
        const out = {
            type: "array",
            items: convert(schema._def.type),
        };
        if (def.description)
            out.description = def.description;
        return out;
    }
    return { type: "object", properties: {} };
}
//# sourceMappingURL=zod-json.js.map