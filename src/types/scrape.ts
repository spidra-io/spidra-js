import type { SchemaInput } from "../lib/schema.js";

export type OutputFormat = "json" | "markdown";
export type ProxyCountry =
  | "us" | "gb" | "de" | "fr" | "jp" | "au" | "ca" | "br" | "in"
  | "nl" | "sg" | "es" | "it" | "mx" | "za" | "ng" | "ar" | "be"
  | "ch" | "cl" | "cn" | "co" | "cz" | "dk" | "eg" | "fi" | "gr"
  | "hk" | "hu" | "id" | "ie" | "il" | "kr" | "my" | "no" | "nz"
  | "pe" | "ph" | "pl" | "pt" | "ro" | "sa" | "se" | "th" | "tr"
  | "tw" | "ua" | "vn" | "eu" | "global"
  | (string & {}); // allow unlisted codes without losing autocomplete

export type BrowserActionType =
  | "click"
  | "type"
  | "check"
  | "uncheck"
  | "wait"
  | "scroll"
  | "forEach";

export interface BrowserAction {
  type: BrowserActionType;
  selector?: string;
  value?: string;
  /** Milliseconds to wait — used by the `wait` action */
  duration?: number;
  /** Scroll destination as a percentage 0–100 e.g. `"80%"` — used by the `scroll` action */
  to?: string;
  // forEach-specific fields
  /** Natural language description of which elements to find e.g. `"Find all product cards"` */
  observe?: string;
  /** How to interact with each element (default: `"click"`) */
  mode?: "click" | "inline" | "navigate";
  /** CSS selector of the content container to capture after each interaction */
  captureSelector?: string;
  /** Maximum number of elements to process (default: 50, hard cap: 50) */
  maxItems?: number;
  /** Milliseconds to wait after clicking/navigating before capturing content (default: 2500) */
  waitAfterClick?: number;
  /** Per-element extraction prompt — runs AI on each item individually before combining */
  itemPrompt?: string;
  /** Per-element actions to run after click/navigation */
  actions?: BrowserAction[];
  /** Paginate through "next page" links to collect more elements */
  pagination?: {
    /** CSS selector or description of the "next page" button/link */
    nextSelector: string;
    /** Maximum number of pages to paginate through (default: 5, hard cap: 10) */
    maxPages?: number;
  };
}

export interface ScrapeUrl {
  url: string;
  /** Step-by-step browser actions to run before extraction */
  actions?: BrowserAction[];
  /** AI Navigate mode — a single natural language instruction that handles all interactions automatically. */
  instruction?: string;
}

export interface ScrapeParams<S extends SchemaInput = SchemaInput> {
  urls: ScrapeUrl[];
  /** Optional when `schema` is provided — a schema-only extraction needs no natural-language prompt. */
  prompt?: string;
  output?: OutputFormat;
  /** JSON Schema object — or a Zod v4 schema, converted automatically. */
  schema?: S;
  useProxy?: boolean;
  proxyCountry?: ProxyCountry;
  /** "fast" skips the browser for a plain HTTP fetch; "default" (the default) renders with a real browser. */
  scrapeMode?: "fast" | "default";
  extractContentOnly?: boolean;
  screenshot?: boolean;
  fullPageScreenshot?: boolean;
  cookies?: string;
}

// --- Job status shapes ---

export type JobStatus = "waiting" | "active" | "completed" | "failed";

export interface ScrapeJobQueued {
  status: "queued";
  jobId: string;
  /** Non-fatal issues with the provided `schema` (e.g. unsupported keywords), present only when there were any. */
  schema_warnings?: string[];
}

export interface ScrapeUrlResult {
  url: string;
  title?: string;
  markdownContent?: string;
  success: boolean;
  screenshotUrl?: string | null;
}

export interface ScrapeResult<T = unknown> {
  content: T;
  data: ScrapeUrlResult[];
  screenshots: string[];
  ai_extraction_failed: boolean;
  stats: {
    durationMs: number;
    captchaSolvedCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface ScrapeJobPending {
  status: "waiting" | "active";
  progress?: { message: string; progress: number };
  schema_warnings?: string[];
}

export interface ScrapeJobCompleted<T = unknown> {
  status: "completed";
  progress?: { message: string; progress: number };
  result: ScrapeResult<T>;
  error: null;
  schema_warnings?: string[];
}

export interface ScrapeJobFailed {
  status: "failed";
  error: string;
  schema_warnings?: string[];
}

export type ScrapeJobResponse<T = unknown> =
  | ScrapeJobPending
  | ScrapeJobCompleted<T>
  | ScrapeJobFailed;
