import { SpidraError } from "./errors.js";

/**
 * Structural stand-in for a Zod schema so the SDK stays zero-dependency —
 * Zod v4 instances carry `_zod`, v3 instances carry `_def` + `parse`.
 */
export interface ZodLikeSchema {
  _zod?: unknown;
  _def?: unknown;
  parse?: (...args: never[]) => unknown;
}

/** A `schema` param: either a plain JSON Schema object or a Zod v4 schema. */
export type SchemaInput = Record<string, unknown> | ZodLikeSchema;

/**
 * Infers the extraction output type from a `schema` param — the Zod output
 * type when a Zod schema is passed, `unknown` for plain JSON Schema.
 */
export type InferSchemaOutput<S> = S extends { _zod: { output: infer O } }
  ? O
  : S extends { _output: infer O }
    ? O
    : unknown;

export function isZodSchema(value: unknown): value is ZodLikeSchema {
  if (value == null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return "_zod" in v || ("_def" in v && typeof v.parse === "function");
}

/**
 * If `params.schema` is a Zod schema, returns a copy of `params` with it
 * converted to JSON Schema; otherwise returns `params` unchanged. Also
 * catches the common mistake of passing `MySchema.shape` instead of `MySchema`.
 */
export async function resolveSchemaParam<P extends { schema?: SchemaInput }>(params: P): Promise<P> {
  const { schema } = params;
  if (schema == null) return params;

  if (isZodSchema(schema)) {
    return { ...params, schema: await zodToJsonSchema(schema) };
  }

  // Detect `schema: MySchema.shape` — a plain object whose values are Zod schemas
  if (typeof schema === "object" && Object.values(schema).some(isZodSchema)) {
    throw new SpidraError(
      0,
      "It looks like you passed `MySchema.shape` as the schema. Pass the Zod schema itself, e.g. `schema: MySchema`, not `schema: MySchema.shape`."
    );
  }

  return params;
}

async function zodToJsonSchema(schema: ZodLikeSchema): Promise<Record<string, unknown>> {
  if (!("_zod" in schema) || schema._zod === undefined) {
    throw new SpidraError(
      0,
      "Zod v3 schemas are not supported. Upgrade to zod@^4 (or import from \"zod/v4\"), or pass a plain JSON Schema object instead."
    );
  }

  let mod: unknown;
  try {
    mod = await import("zod");
  } catch {
    throw new SpidraError(
      0,
      "Passing a Zod schema requires zod@^4 to be installed (`npm install zod`). Alternatively, pass a plain JSON Schema object."
    );
  }

  let toJSONSchema = (mod as { toJSONSchema?: unknown }).toJSONSchema;

  if (typeof toJSONSchema !== "function") {
    // zod 3.25+ ships the v4 API under the "zod/v4" subpath
    try {
      mod = await import("zod/v4");
      toJSONSchema = (mod as { toJSONSchema?: unknown }).toJSONSchema;
    } catch {
      /* fall through to the version check below */
    }
  }

  if (typeof toJSONSchema !== "function") {
    throw new SpidraError(
      0,
      "Your installed zod version does not support toJSONSchema. Upgrade to zod@^4, or pass a plain JSON Schema object."
    );
  }

  return (toJSONSchema as (schema: unknown, options?: unknown) => Record<string, unknown>)(schema, {
    io: "output",
  });
}
