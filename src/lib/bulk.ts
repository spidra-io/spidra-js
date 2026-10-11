import { SpidraValidationError } from "./errors.js";
import type { BulkEstimate, BulkScrapeParams } from "../types/bulk.js";

/** The batch endpoint accepts up to 50 URLs and each user may queue 50 jobs, so 40 leaves headroom. */
export const BATCH_SIZE = 40;
export const DEFAULT_MAX_PAGES = 1000;
const CREDITS_PER_PAGE = 1;

const PLACEHOLDER = /\{(\w+)\}/g;

/** Every combination of the variable values, as URLs. Values are URL-encoded. */
export function expandTemplate(template: string, variables: Record<string, string[]>): string[] {
  const names = [...new Set([...template.matchAll(PLACEHOLDER)].map(m => m[1]))];
  const empty = names.filter(name => !variables[name]?.length);
  if (names.length === 0 || empty.length > 0) {
    throw new SpidraValidationError("Invalid bulk search template.", [
      names.length === 0 ? "The template has no {placeholders}." : `No values for: ${empty.join(", ")}.`,
    ]);
  }
  const combinations = names.reduce<Record<string, string>[]>(
    (partials, name) => partials.flatMap(partial => variables[name].map(value => ({ ...partial, [name]: value }))),
    [{}]
  );
  return combinations.map(values => template.replace(PLACEHOLDER, (_, name: string) => encodeURIComponent(values[name])));
}

/** Reads a dot path such as `jobs` or `data.items`. Undefined when any step is missing. */
export function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => (current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined), value);
}

export function chunk<T>(list: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
}

export function estimateBulk(params: Pick<BulkScrapeParams, "template" | "variables" | "prompt" | "schema">): BulkEstimate {
  const pages = expandTemplate(params.template, params.variables).length;
  return {
    pages,
    batches: Math.ceil(pages / BATCH_SIZE),
    credits: pages * CREDITS_PER_PAGE,
    aiTokensExtra: Boolean(params.prompt || params.schema),
  };
}
