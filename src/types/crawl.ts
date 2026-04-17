import type { ProxyCountry } from "./scrape.js";

export interface CrawlParams {
  baseUrl: string;
  crawlInstruction: string;
  transformInstruction: string;
  maxPages?: number;
  useProxy?: boolean;
  proxyCountry?: ProxyCountry;
  cookies?: string;
}

export interface CrawlQueued {
  status: "queued";
  jobId: string;
}

export type CrawlStatus = "waiting" | "active" | "running" | "completed" | "failed";

export interface CrawlPageResult {
  url: string;
  title?: string;
  data: unknown;
}

export interface CrawlJobPending {
  status: "waiting" | "active" | "running";
  progress?: { message: string; progress: number };
}

export interface CrawlJobCompleted {
  status: "completed";
  result: CrawlPageResult[];
}

export interface CrawlJobFailed {
  status: "failed";
  error?: string;
}

export type CrawlJobResponse = CrawlJobPending | CrawlJobCompleted | CrawlJobFailed;

export interface CrawlPage {
  id: string;
  url: string;
  title?: string;
  status: "success" | "failed";
  data: unknown;
  error_message: string | null;
  html_url: string | null;
  markdown_url: string | null;
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
