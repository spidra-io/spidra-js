export type ScrapeLogStatus = "success" | "error" | "in_progress";

export interface ScrapeLogsParams {
  status?: ScrapeLogStatus | "all";
  searchTerm?: string;
  limit?: number;
  page?: number;
  /** Filter by channel: "api" or "playground" */
  channel?: string;
  /** ISO date string — only return logs on or after this date */
  dateStart?: string;
  /** ISO date string — only return logs on or before this date */
  dateEnd?: string;
}

export interface ScrapeLog {
  uuid: string;
  urls: Array<{ url: string }>;
  extraction_prompt: string | null;
  status: ScrapeLogStatus;
  credits_used: number | null;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  tokens_used: number | null;
  latency_ms: number | null;
  ai_output_format: string | null;
  use_proxy: number | null;
  proxy_country: string | null;
}

export interface ScrapeLogsResponse {
  logs: ScrapeLog[];
  total: number;
}

/** Single log entry with the full AI extraction result included. */
export interface ScrapeLogDetail extends ScrapeLog {
  result_data: unknown;
}

// ---- Search logs ---------------------------------------------------------

export interface LogListParams<Status extends string> {
  status?: Status | "all";
  /** Matches the query, URL or file name. */
  searchTerm?: string;
  page?: number;
  limit?: number;
  /** ISO date: only logs on or after this day. */
  dateStart?: string;
  /** ISO date: only logs on or before this day. */
  dateEnd?: string;
}

export type SearchLogStatus = "success" | "error" | "in_progress" | "cancelled";

/** A past search. Snake_case, like the other older logs. Further pages loaded with `pageTokens` are folded in. */
export interface SearchLog {
  uuid: string;
  status: SearchLogStatus;
  started_at: string;
  finished_at: string | null;
  query: string;
  /** Comma-separated sources, such as "web,news". */
  sources: string | null;
  country: string | null;
  include_domains: string | null;
  exclude_domains: string | null;
  scrape_content_enabled: 0 | 1;
  scrape_max_results: number | null;
  result_limit: number | null;
  page: number | null;
  time_range: string | null;
  filetype: string | null;
  result_data: Record<string, unknown> | null;
  error_message: string | null;
  latency_ms: number | null;
  credits_used: number;
  scraping_channel?: "api" | "playground" | null;
}

export interface SearchLogsResponse {
  logs: SearchLog[];
  total: number;
}

// ---- Map logs ------------------------------------------------------------

export type MapLogStatus = "success" | "empty" | "error";

export interface MapLog {
  uuid: string;
  status: MapLogStatus;
  url: string;
  search: string | null;
  sitemap_mode: "include" | "skip" | "only";
  url_limit: number;
  include_subdomains: boolean;
  respect_robots: boolean;
  total: number;
  scanned: number;
  sitemap_count: number;
  pages_count: number;
  message: string | null;
  latency_ms: number;
  credits_used: number;
  scraping_channel: "api" | "playground";
  created_at: string;
}

export interface MapLogsResponse {
  logs: MapLog[];
  total: number;
}

/** One map log, with the links it returned. */
export interface MapLogDetail extends MapLog {
  links: Array<{ url: string; title?: string }>;
}

// ---- Parse logs ----------------------------------------------------------

export type ParseLogStatus = "queued" | "running" | "completed" | "failed";

/** A parsed document. Unlike the other logs, parse logs are camelCase. Open the result with `getParse(jobId)`. */
export interface ParseLog {
  jobId: string;
  status: ParseLogStatus;
  fileName: string;
  sourceUrl: string | null;
  sourceType: "url" | "upload";
  format: string;
  mode: "auto" | "fast" | "ocr";
  pageSelection: string | null;
  totalPages: number;
  pagesParsed: number | null;
  ocrPages: number | null;
  hasPrompt: boolean;
  creditsUsed: number;
  latencyMs: number | null;
  channel: "api" | "playground";
  error: string | null;
  createdAt: string;
}

export interface ParseLogsResponse {
  logs: ParseLog[];
  total: number;
}
