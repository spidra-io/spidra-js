export type OutputFormat = "json" | "markdown" | "text" | "table";
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
  duration?: number;
  to?: string;
  // forEach-specific
  observe?: string;
  mode?: "inline" | "navigate" | "click";
  captureSelector?: string;
  maxItems?: number;
  itemPrompt?: string;
  pagination?: {
    nextSelector: string;
    maxPages: number;
  };
}

export interface ScrapeUrl {
  url: string;
  actions?: BrowserAction[];
}

export interface ScrapeParams {
  urls: ScrapeUrl[];
  prompt: string;
  output?: OutputFormat;
  schema?: Record<string, unknown>;
  useProxy?: boolean;
  proxyCountry?: ProxyCountry;
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
}

export interface ScrapeUrlResult {
  url: string;
  title?: string;
  markdownContent?: string;
  success: boolean;
  screenshotUrl?: string | null;
}

export interface ScrapeResult {
  content: unknown;
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
}

export interface ScrapeJobCompleted {
  status: "completed";
  progress?: { message: string; progress: number };
  result: ScrapeResult;
  error: null;
}

export interface ScrapeJobFailed {
  status: "failed";
  error: string;
}

export type ScrapeJobResponse =
  | ScrapeJobPending
  | ScrapeJobCompleted
  | ScrapeJobFailed;
