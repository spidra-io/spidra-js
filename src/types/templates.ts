export type TemplateTool = "batch" | "search" | "map" | "crawl" | "parse";

export type TemplateCategory =
  | "lead-generation"
  | "reviews"
  | "ecommerce"
  | "jobs"
  | "social-media"
  | "real-estate"
  | "ai-and-documents"
  | "research"
  | "travel";

export interface TemplateSite {
  key: string;
  name: string;
  domain: string;
}

/** A template as listed by `listTemplates()`. */
export interface TemplateSummary {
  slug: string;
  version: number;
  title: string;
  summary: string;
  site: TemplateSite | null;
  categories: TemplateCategory[];
  tool: TemplateTool;
  featured?: boolean;
  gallery?: boolean;
  status?: "active" | "beta";
  /** Names of the fields each row has. */
  fields?: string[];
  usesAi?: boolean;
  /** Set when the template is paused or has a notice, with a message saying why. */
  availability?: { state: "notice" | "off"; message: string | null } | null;
}

/** One field of a template's form. Send its value under `key` in `inputs`. */
export interface TemplateInput {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "list"
    | "boolean"
    | "date"
    | "dateRange"
    | "month"
    | "week"
    | "year"
    | "country"
    | "language"
    | "airport";
  required?: boolean;
  default?: unknown;
  example?: unknown;
  help?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  maxItems?: number;
  multiple?: boolean;
  advanced?: boolean;
  minDate?: string;
  maxDate?: string;
  /** Only shown when another input has a given value. */
  showIf?: { input: string; equals?: unknown; in?: unknown[] };
}

/** Everything needed to run a template, from `getTemplate()`. */
export interface TemplateDetail extends TemplateSummary {
  description?: string;
  inputs: TemplateInput[];
  /** The columns the results table shows. `key` is the path to the value in a row, such as `"socials.instagram"`. */
  columns?: Array<{ key: string; label: string; format?: string; showIf?: { input: string; equals?: unknown } }>;
  /** Limits in plain words, such as how many results a search returns. */
  limits?: string[];
  hasRows?: boolean;
  /** Example rows. */
  sample?: unknown;
  variants?: unknown;
}

export interface ListTemplatesParams {
  category?: TemplateCategory;
  /** A site key, such as `"google-maps"` or `"amazon"`. */
  site?: string;
  /** Words to search titles and summaries for. */
  q?: string;
}

export interface ListTemplatesResponse {
  templates: TemplateSummary[];
  categories: Array<{ key: TemplateCategory; label: string }>;
  sites: TemplateSite[];
}

export interface TemplateEstimate {
  /** Credits a run should cost. `null` when it can't be known in advance, such as for parse templates. */
  credits: number | null;
  /** What can add to the number, such as AI tokens or a second step. */
  note: string | null;
  pages?: number;
}

export type TemplateRunStatus = "running" | "completed" | "partial" | "failed" | "cancelled";

export interface TemplateRun<Row = Record<string, unknown>> {
  runId: string;
  template: string;
  templateVersion: number;
  presetId: string | null;
  tool: TemplateTool;
  status: TemplateRunStatus;
  /** The inputs the run used, with defaults filled in. */
  inputs: Record<string, unknown>;
  createdAt: string;
  finishedAt: string | null;
  creditsUsed: number | null;
  urlCount: number | null;
  rowCount: number | null;
  progress?: { completed: number; failed: number; total: number };
  /** One row per result. Left out while running, or when you ask for `rows: false`. */
  rows?: Row[];
  failures?: Array<{ url: string; error: string }>;
  error?: string;
  /** The optional second step, such as visiting each website for contacts. */
  followStep?: {
    status: "waiting" | "running" | "completed" | "failed";
    sites?: number;
    pagesLoaded?: number;
    pagesFailed?: number;
    pagesWaiting?: number;
    creditsUsed?: number;
    error?: string;
  };
  summary?: Record<string, unknown>;
  /** The job behind the run. For crawl and parse templates, read the full result from that tool with `job.id`. */
  job?: { tool: TemplateTool; id: string | null };
  resultsPath?: string;
}

export interface RunTemplateParams {
  /** The template's inputs by key. See `getTemplate(slug).inputs`. */
  inputs: Record<string, unknown>;
}

export interface ListTemplateRunsParams {
  /** Only runs of this template slug. */
  template?: string;
  page?: number;
  limit?: number;
}

/** A run as listed by `listTemplateRuns()`: no rows or progress, plus the template's title and site. */
export type TemplateRunListItem = Pick<
  TemplateRun,
  "runId" | "template" | "presetId" | "tool" | "status" | "inputs" | "creditsUsed" | "rowCount" | "urlCount" | "createdAt" | "finishedAt"
> & { title: string; site: TemplateSite | null };

export interface ListTemplateRunsResponse {
  runs: TemplateRunListItem[];
  total: number;
  page: number;
}

export interface Airport {
  code: string;
  /** `city` for a code that covers every airport in a city, such as LON. */
  kind: "airport" | "city";
  name: string;
  city?: string;
  /** Two-letter country code. */
  country?: string;
  countryName?: string;
  region?: string;
}

export interface LookupAirportsParams {
  /** A name, city or code to search for. */
  q?: string;
  /** Codes you already have, to look up their details. */
  codes?: string[];
  limit?: number;
}
