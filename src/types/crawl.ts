import type { ProxyCountry } from "./scrape.js";

export interface CrawlParams {
  baseUrl: string;
  crawlInstruction: string;
  transformInstruction: string;
  maxPages?: number;
  useProxy?: boolean;
  proxyCountry?: ProxyCountry;
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
