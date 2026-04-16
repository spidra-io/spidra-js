import type { OutputFormat, ProxyCountry } from "./scrape.js";

export interface BatchScrapeParams {
  urls: string[];
  prompt: string;
  output?: OutputFormat;
  schema?: Record<string, unknown>;
  useProxy?: boolean;
  proxyCountry?: ProxyCountry;
  extractContentOnly?: boolean;
  screenshot?: boolean;
}

export interface BatchScrapeQueued {
  status: "queued";
  batchId: string;
  total: number;
}

export type BatchItemStatus = "pending" | "active" | "completed" | "failed";

export interface BatchItem {
  uuid: string;
  url: string;
  status: BatchItemStatus;
  result: unknown | null;
  error?: string | null;
  creditsUsed: number;
  startedAt: string | null;
  finishedAt: string | null;
  screenshotUrl: string | null;
}

export type BatchStatus = "pending" | "active" | "completed" | "failed" | "cancelled";

export interface BatchScrapeResponse {
  status: BatchStatus;
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  createdAt: string;
  finishedAt: string | null;
  items: BatchItem[];
}
