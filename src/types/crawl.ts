import type { ProxyCountry } from "./scrape.js";

export interface CrawlParams {
  baseUrl: string;
  crawlInstruction: string;
  /** What to extract from each page, in plain language. When omitted and no `schema` is set, each page's `data` field contains the raw page markdown — no AI is called and no token credits are charged. */
  transformInstruction?: string;
  /** JSON Schema object defining the exact output structure for each page. */
  schema?: Record<string, unknown>;
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
  cookies?: string;
}

export interface CrawlQueued {
  status: "queued";
  jobId: string;
}

export type CrawlStatus = "waiting" | "active" | "running" | "completed" | "failed" | "cancelled";

export interface CrawlPageResult {
  url: string;
  title?: string;
  data?: unknown;
  html?: string | null;
  markdown?: string | null;
}

export interface CrawlJobPending {
  status: "waiting" | "active" | "running" | "delayed";
  progress?: { message: string; pagesCrawled: number; maxPages: number };
}

export interface CrawlJobCompleted {
  status: "completed";
  result: CrawlPageResult[];
}

export interface CrawlJobFailed {
  status: "failed";
  error?: string;
}

export interface CrawlJobCancelled {
  status: "cancelled";
}

export type CrawlJobResponse = CrawlJobPending | CrawlJobCompleted | CrawlJobFailed | CrawlJobCancelled;

export interface CrawlPage {
  id: string;
  url: string;
  title?: string;
  status: "success" | "failed";
  data?: unknown;
  error_message: string | null;
  html: string | null;
  markdown: string | null;
  created_at: string;
}

export interface CrawlPagesResponse {
  pages: CrawlPage[];
}

export interface CrawlHistoryParams {
  page?: number;
  limit?: number;
}

export interface CrawlHistoryEntry {
  id: string;
  base_url: string;
  crawl_instruction: string;
  transform_instruction: string;
  max_pages: number;
  status: CrawlStatus;
  created_at: string;
  updated_at: string;
  pages_crawled: number;
  credits_used: number | null;
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
