import type { TemplateRun, TemplateSite } from "./templates.js";

export type PresetTool = "scrape" | "batch" | "crawl" | "map" | "search" | "parse";

/**
 * A saved job. A template preset is a template and its inputs; a tool preset is the request body for one tool.
 * Responses also carry older snake_case fields (`uuid`, `urls`, `extraction_prompt` and others) kept for scrape
 * presets saved before October 2026. Use the camelCase fields.
 */
export interface Preset {
  id: string;
  name: string;
  description: string | null;
  kind: "template" | "tool";
  tool: PresetTool | null;
  /** Template presets only. `available` is false when the template was retired, and such a preset can't run. */
  template: { slug: string; version: number; title: string; site: TemplateSite | null; available: boolean } | null;
  /** Template presets: the saved inputs. */
  inputs: Record<string, unknown> | null;
  /** Tool presets: the saved request body. */
  config: Record<string, unknown> | null;
  columns: unknown[] | null;
  /** The inputs in a few words, such as "dentist in Lekki, Lagos". */
  inputsSummary: string | null;
  createdAt: string;
  updatedAt: string;
  [legacyField: string]: unknown;
}

export interface ListPresetsParams {
  page?: number;
  /** 10 by default, up to 50. */
  limit?: number;
}

export interface ListPresetsResponse {
  presets: Preset[];
  total: number;
}

export type CreatePresetParams =
  | {
      kind: "template";
      name: string;
      description?: string;
      /** The template's slug. */
      template: string;
      inputs: Record<string, unknown>;
      columns?: unknown[];
    }
  | {
      kind: "tool";
      name: string;
      description?: string;
      tool: PresetTool;
      /** The request body for that tool, exactly as you'd send it. `cookies` and `wait` are never stored. */
      config: Record<string, unknown>;
    };

export interface UpdatePresetParams {
  name?: string;
  description?: string;
  /** Template presets: replaces the saved inputs. */
  inputs?: Record<string, unknown>;
  columns?: unknown[];
  /** Tool presets: replaces the saved request body. */
  config?: Record<string, unknown>;
}

export interface RunPresetParams {
  /** Replace template inputs, or request fields of a tool preset, for this run only. */
  overrides?: Record<string, unknown>;
  /** Wait for a quick result, as with a template run or a batch scrape. */
  wait?: boolean;
}

/**
 * What running a preset returns: for a template preset, the template run; for a tool preset, that tool's own
 * response (map links, a scrape or crawl job ID to poll, and so on). Both include `presetId`.
 */
export type RunPresetResponse =
  | { presetId: string; run: TemplateRun }
  | ({ presetId: string; tool: PresetTool } & Record<string, unknown>);
