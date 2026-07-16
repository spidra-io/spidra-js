export { SpidraClient } from "./client.js";
export {
  SpidraError,
  SpidraAuthenticationError,
  SpidraPaymentRequiredError,
  SpidraInsufficientCreditsError,
  SpidraNotFoundError,
  SpidraValidationError,
  SpidraRateLimitError,
  SpidraServerError,
  SpidraJobError,
  SpidraTimeoutError,
  isRetryableError,
} from "./lib/errors.js";
export type { RateLimitInfo, SpidraErrorOptions } from "./lib/errors.js";
export { verifySpidraWebhook } from "./lib/webhook.js";
export { CrawlWatcher, BatchWatcher } from "./lib/watcher.js";
export type { WatchOptions, CrawlWatcherEvents, BatchWatcherEvents } from "./lib/watcher.js";

// Types
export type { SpidraConfig } from "./types/client.js";
export type { SchemaInput, InferSchemaOutput, ZodLikeSchema } from "./lib/schema.js";
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
  CrawlStatus,
  CrawlJobPending,
  CrawlJobCompleted,
  CrawlJobFailed,
  CrawlJobCancelled,
  CrawlJobResponse,
  CrawlPage,
  CrawlPagesResponse,
  CrawlPageResult,
  CrawlHistoryParams,
  CrawlHistoryEntry,
  CrawlHistoryResponse,
  CrawlStats,
  CrawlCancelResponse,
} from "./types/crawl.js";
export type {
  ScrapeLogsParams,
  ScrapeLogsResponse,
  ScrapeLog,
  ScrapeLogDetail,
} from "./types/logs.js";
export type { UsageRange, UsageStatRow } from "./types/usage.js";
export type { PollOptions } from "./lib/poll.js";
