export { SpidraClient } from "./client.js";
export {
  SpidraError,
  SpidraAuthenticationError,
  SpidraInsufficientCreditsError,
  SpidraRateLimitError,
  SpidraServerError,
} from "./lib/http.js";

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
  BatchCancelResponse,
  BatchListParams,
  BatchListEntry,
  BatchListResponse,
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
  CrawlHistoryParams,
  CrawlHistoryEntry,
  CrawlHistoryResponse,
  CrawlStats,
} from "./types/crawl.js";
export type {
  ScrapeLogsParams,
  ScrapeLogsResponse,
  ScrapeLog,
  ScrapeLogDetail,
} from "./types/logs.js";
export type { UsageRange, UsageStatRow } from "./types/usage.js";
export type { PollOptions } from "./lib/poll.js";
