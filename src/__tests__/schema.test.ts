import { describe, expect, it } from "vitest";
import { z } from "zod";
import { catchError } from "./helpers.js";
import { isZodSchema, resolveSchemaParam, type SchemaInput } from "../lib/schema.js";
import { SpidraError } from "../lib/errors.js";

const Product = z.object({
  name: z.string(),
  price: z.number(),
  inStock: z.boolean().optional(),
});

describe("isZodSchema", () => {
  it("detects Zod v4 schemas", () => {
    expect(isZodSchema(Product)).toBe(true);
    expect(isZodSchema(z.string())).toBe(true);
  });

  it("rejects plain objects and JSON Schema", () => {
    expect(isZodSchema({ type: "object", properties: {} })).toBe(false);
    expect(isZodSchema(null)).toBe(false);
    expect(isZodSchema("schema")).toBe(false);
  });
});

describe("resolveSchemaParam", () => {
  it("returns params unchanged when no schema is set", async () => {
    const params: { prompt: string; schema?: SchemaInput } = { prompt: "extract" };
    expect(await resolveSchemaParam(params)).toBe(params);
  });

  it("passes plain JSON Schema through unchanged", async () => {
    const schema = { type: "object", properties: { name: { type: "string" } } };
    const params = { prompt: "extract", schema };
    const resolved = await resolveSchemaParam(params);
    expect(resolved).toBe(params);
    expect(resolved.schema).toBe(schema);
  });

  it("converts a Zod schema to JSON Schema", async () => {
    const resolved = await resolveSchemaParam({ prompt: "extract", schema: Product });
    const schema = resolved.schema as unknown as Record<string, unknown>;
    expect(schema.type).toBe("object");
    const properties = schema.properties as Record<string, { type?: string }>;
    expect(properties.name.type).toBe("string");
    expect(properties.price.type).toBe("number");
    expect(schema.required).toEqual(["name", "price"]);
  });

  it("catches the MySchema.shape mistake with a helpful error", async () => {
    const err = await catchError(resolveSchemaParam({ prompt: "extract", schema: Product.shape }));
    expect(err).toBeInstanceOf(SpidraError);
    expect(err.message).toContain("MySchema.shape");
    expect(err.message).toContain("schema: MySchema");
  });

  it("rejects Zod v3-style schemas with an upgrade hint", async () => {
    // structurally mimic a v3 schema: _def + parse, but no _zod
    const v3Like = { _def: { typeName: "ZodObject" }, parse: () => ({}) };
    const err = await catchError(resolveSchemaParam({ prompt: "x", schema: v3Like }));
    expect(err).toBeInstanceOf(SpidraError);
    expect(err.message).toContain("zod@^4");
  });
});
