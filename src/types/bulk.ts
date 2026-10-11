import type { SchemaInput } from "../lib/schema.js";
import type { BatchScrapeParams } from "./batch.js";

export interface BulkScrapeParams extends Omit<BatchScrapeParams<SchemaInput>, "urls"> {
  /** A URL with `{placeholders}`, for example `https://www.indeed.com/jobs?q={title}&l={location}`. */
  template: string;
  /** The values for each placeholder. Every combination becomes one page. */
  variables: Record<string, string[]>;
  /** Where the list of items sits in each page's result, as a dot path, for example `jobs`. */
  itemsPath: string;
  /** The field that identifies an item. Items sharing this value are kept once, for example `id`. */
  dedupeBy: string;
  /** Stop once this many unique items are collected. Checked after each batch of pages. */
  target?: number;
  /** Safety limit on the number of pages, so a typo cannot spend thousands of credits. Defaults to 1000. */
  maxPages?: number;
  /** Called after each batch of pages finishes. */
  onBatch?: (progress: BulkProgress) => void;
}

export interface BulkEstimate {
  pages: number;
  batches: number;
  /** One credit per page. */
  credits: number;
  /** True when a prompt or schema is set: AI tokens are charged on top, so `credits` is a lower bound. */
  aiTokensExtra: boolean;
}

export interface BulkProgress {
  pagesDone: number;
  pagesTotal: number;
  uniqueItems: number;
  creditsUsed: number;
}

export interface BulkStats {
  pages: number;
  failedPages: number;
  rawItems: number;
  uniqueItems: number;
  duplicatesRemoved: number;
  creditsUsed: number;
}

export interface BulkResult<T = Record<string, unknown>> {
  items: T[];
  stats: BulkStats;
}
