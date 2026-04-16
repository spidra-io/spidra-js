export { SpidraClient } from "./client.js";
export { SpidraError } from "./lib/http.js";

// Types
export type { SpidraConfig } from "./types/client.js";
export type {
  ScrapeParams,
  ScrapeUrl,
  BrowserAction,
  BrowserActionType,
  ScrapeResult,
  ScrapeJobQueued,
  ScrapeJobCompleted,
  ScrapeJobFailed,
  ScrapeJobResponse,
  OutputFormat,
  ProxyCountry,
} from "./types/scrape.js";
export type {
  BatchScrapeParams,
  BatchScrapeQueued,
  BatchScrapeResponse,
  BatchItem,
  BatchItemStatus,
  BatchStatus,
} from "./types/batch.js";
export type {
  CrawlParams,
  CrawlQueued,
  CrawlJobCompleted,
  CrawlJobFailed,
  CrawlJobResponse,
  CrawlPage,
  CrawlPagesResponse,
  CrawlPageResult,
} from "./types/crawl.js";
export type {
  ScrapeLogsParams,
  ScrapeLogsResponse,
  ScrapeLog,
} from "./types/logs.js";
export type { PollOptions } from "./lib/poll.js";
