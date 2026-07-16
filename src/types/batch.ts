import type { OutputFormat, ProxyCountry } from "./scrape.js";
import type { SchemaInput } from "../lib/schema.js";

export interface BatchScrapeParams<S extends SchemaInput = SchemaInput> {
  urls: string[];
  prompt: string;
  output?: OutputFormat;
  /** JSON Schema object — or a Zod v4 schema, converted automatically. */
  schema?: S;
  useProxy?: boolean;
  proxyCountry?: ProxyCountry;
  extractContentOnly?: boolean;
  screenshot?: boolean;
  fullPageScreenshot?: boolean;
  cookies?: string;
}

export interface BatchScrapeQueued {
  status: "queued";
  batchId: string;
  total: number;
}

export type BatchItemStatus = "pending" | "running" | "completed" | "failed";

export interface BatchItem<T = unknown> {
  uuid: string;
  url: string;
  jobId: string | null;
  status: BatchItemStatus;
  result: T | null;
  error?: string | null;
  creditsUsed: number;
  startedAt: string | null;
  finishedAt: string | null;
  screenshotUrl: string | null;
}

export type BatchStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface BatchScrapeResponse<T = unknown> {
  status: BatchStatus;
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  createdAt: string;
  finishedAt: string | null;
  items: BatchItem<T>[];
}

export interface BatchCancelResponse {
  status: "cancelled";
  cancelledItems: number;
  creditsRefunded: number;
}

export interface BatchListParams {
  page?: number;
  limit?: number;
}

export interface BatchListEntry {
  uuid: string;
  status: BatchStatus;
  totalUrls: number;
  completedCount: number;
  failedCount: number;
  outputFormat: string;
  scrapingChannel: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface BatchListResponse {
  jobs: BatchListEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
