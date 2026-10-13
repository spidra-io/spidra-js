import type { ProxyCountry } from "./scrape.js";
import type { SchemaInput } from "../lib/schema.js";

export interface CrawlParams<S extends SchemaInput = SchemaInput> {
  baseUrl: string;
  crawlInstruction: string;
  /** What to extract from each page, in plain language. When omitted and no `schema` is set, each page's `data` field contains the raw page markdown — no AI is called and no token credits are charged. */
  transformInstruction?: string;
  /** JSON Schema object defining the exact output structure for each page — or a Zod v4 schema, converted automatically. */
  schema?: S;
  maxPages?: number;
  maxDepth?: number;
  includePaths?: string[];
  excludePaths?: string[];
  allowSubdomains?: boolean;
  crawlEntireDomain?: boolean;
  ignoreQueryParams?: boolean;
  webhookUrl?: string;
  useProxy?: boolean;
  proxyCountry?: ProxyCountry;
  /** "fast" fetches pages over HTTP first and opens a browser only for pages that need one; "default" uses a browser for every page. */
  scrapeMode?: "fast" | "default";
  cookies?: string;
  /** Follow the site's robots.txt rules (and its Crawl-delay). Default false. */
  respectRobots?: boolean;
  /** Read the site's sitemap to find pages. Default true. */
  useSitemap?: boolean;
}

export interface CrawlQueued {
  status: "queued";
  jobId: string;
}

export type CrawlStatus = "waiting" | "active" | "running" | "completed" | "failed" | "cancelled";

export interface CrawlPageResult<T = unknown> {
  url: string;
  title?: string;
  data?: T;
  html?: string | null;
  markdown?: string | null;
  /** Clicks away from baseUrl. */
  depth?: number;
  /** The page this one was found on. */
  parentUrl?: string | null;
}

export interface CrawlJobPending {
  status: "waiting" | "active" | "running" | "delayed";
  progress?: { status?: string; message?: string; progress?: number };
}

export interface CrawlJobCompleted<T = unknown> {
  status: "completed";
  result: CrawlPageResult<T>[];
}

export interface CrawlJobFailed {
  status: "failed";
  error?: string;
}

export interface CrawlJobCancelled {
  status: "cancelled";
}

export type CrawlJobResponse<T = unknown> =
  | CrawlJobPending
  | CrawlJobCompleted<T>
  | CrawlJobFailed
  | CrawlJobCancelled;

export interface CrawlPage<T = unknown> {
  id: string;
  url: string;
  title?: string;
  status: "success" | "failed";
  data?: T;
  error_message: string | null;
  html: string | null;
  markdown: string | null;
  created_at: string;
}

export interface CrawlPagesResponse<T = unknown> {
  pages: CrawlPage<T>[];
}

export interface CrawlHistoryParams {
  page?: number;
  limit?: number;
}

export interface CrawlHistoryEntry {
  id: string;
  user_uuid: string;
  source_job_id: string | null;
  base_url: string;
  crawl_instruction: string;
  transform_instruction: string;
  output_schema: Record<string, unknown> | null;
  max_pages: number;
  include_paths: string[] | null;
  exclude_paths: string[] | null;
  max_depth: number | null;
  /** mysql2 returns TINYINT(1) columns as 0/1, not a real boolean */
  allow_subdomains: 0 | 1;
  crawl_entire_domain: 0 | 1;
  ignore_query_params: 0 | 1;
  webhook_url: string | null;
  status: CrawlStatus;
  input_tokens: number;
  output_tokens: number;
  /** mysql2 returns DECIMAL columns as strings, e.g. "2.00" -- not a number */
  credits_used: string | null;
  use_proxy: 0 | 1;
  proxy_bandwidth_mb: string | null;
  proxy_billing: "none" | "billed" | "free_auto";
  created_at: string;
  updated_at: string;
  pages_crawled: number;
}

export interface CrawlHistoryResponse {
  jobs: CrawlHistoryEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CrawlStats {
  total: number;
}

export interface CrawlCancelResponse {
  status: "cancelled";
  jobId: string;
}

/** Response shape for `crawl.jobDetails()` — GET /crawl/job/:jobId, a flat snapshot rather than the job-queue poll shape. */
export interface CrawlJobDetails {
  id: string;
  base_url: string;
  crawl_instruction: string;
  transform_instruction: string;
  max_pages: number;
  max_depth: number | null;
  include_paths: string[] | null;
  exclude_paths: string[] | null;
  /** mysql2 returns TINYINT(1) columns as 0/1, not a real boolean */
  allow_subdomains: 0 | 1;
  crawl_entire_domain: 0 | 1;
  ignore_query_params: 0 | 1;
  output_schema: Record<string, unknown> | null;
  webhook_url: string | null;
  status: CrawlStatus;
  created_at: string;
  updated_at: string;
  input_tokens: number;
  output_tokens: number;
  /** mysql2 returns DECIMAL columns as strings, e.g. "2.00" -- not a number */
  credits_used: string | null;
  pages_crawled: number;
}

/** Response shape for `crawl.retryPage()` — POST /crawl/:jobId/retry/:pageId. */
export interface CrawlRetryPageResponse<T = unknown> {
  success: true;
  data: T;
  tokensUsed: number;
  creditsUsed: number;
  message: string;
}

export interface CrawlReportParams {
  /** Only list skipped URLs with this reason, e.g. "not_relevant". */
  reason?: string;
  /** Default 200, maximum 2000. */
  limit?: number;
  offset?: number;
}

export interface CrawlSkipReason {
  /** Machine-readable reason, e.g. "not_relevant", "outside_domain", "robots_txt". */
  reason: string;
  count: number;
  /** The reason in plain language. */
  description: string;
}

export interface CrawlSkippedUrl {
  url: string;
  reason: string;
  /** The page the link was found on. */
  foundOn: string | null;
}

export interface CrawlReport {
  /** How the crawl understood the instruction. */
  understoodAs: string | null;
  /** Pages read only to find the wanted ones (not returned, not billed). */
  navigationPages: number;
  skippedTotal: number;
  skipped: CrawlSkipReason[];
  skippedUrls: CrawlSkippedUrl[];
  skippedUrlsTotal: number;
}

export interface CrawlReportResponse {
  status: "success";
  /** Null for crawls that ran before reports existed, or while a crawl is still running. */
  report: CrawlReport | null;
  message?: string;
}

export interface MapParams {
  /** The website to map. */
  url: string;
  /** Only return URLs related to these words, best matches first. */
  search?: string;
  /** Maximum URLs returned. Default 500, maximum 5000. */
  limit?: number;
  /** "include" (default) reads the sitemap and page links, "only" reads the sitemap only, "skip" reads links only. */
  sitemap?: "include" | "skip" | "only";
  includeSubdomains?: boolean;
  /** Treat URLs that differ only by query string as one. Default true. */
  ignoreQueryParams?: boolean;
  respectRobots?: boolean;
  cookies?: string;
}

export interface MapLink {
  url: string;
  /** The link text the URL was found with, when it came from a page. */
  title?: string;
}

export interface MapResult {
  status: "success";
  links: MapLink[];
  /** URLs that matched (all URLs found when there is no search). */
  total: number;
  /** All URLs found on the site, before the search filter. */
  scanned?: number;
  sources: { sitemap: number; pages: number };
  creditsUsed: number;
  durationMs: number;
  message?: string;
}
